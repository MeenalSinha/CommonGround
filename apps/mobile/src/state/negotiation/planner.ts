/**
 * Plan generation and editing. Pure and deterministic: the same session, party and options always give
 * the same plan. Never invents entities: every entry points at a candidate that came from a Qloo response
 * (or a Qloo search result added by hand). Cost and duration constraints use ONLY numbers the user typed.
 */
import { plan as planConfig, planModeFor, planModes, ranking as cfg } from './config';
import { describeIneligible, explainCandidate } from './explain';
import { eligibility } from './pool';
import { rankCandidates, type RankedCandidate } from './ranking';
import type {
  ExperiencePlan,
  GroupConstraints,
  NegotiationSession,
  PlanEntry,
  PlanFailureCode,
  PlanOutcome,
} from './types';
import type { Party } from '../party';

export interface PlanResult {
  session: NegotiationSession;
  outcome: PlanOutcome;
}

export const lengthIsValid = (n: number) =>
  Number.isInteger(n) && n >= planConfig.minLength && n <= planConfig.maxLength;

const nameOf = (session: NegotiationSession, id: string) =>
  session.candidates[id]?.entity.name ?? 'a suggestion that is no longer in the pool';

function fail(
  session: NegotiationSession,
  code: PlanFailureCode,
  message: string,
  nextStep: string,
  now: string,
): PlanResult {
  return {
    session: { ...session, lastOutcome: { ok: false, code, message, nextStep, at: now } },
    outcome: { ok: false, code, message, nextStep, at: now },
  };
}

function succeed(session: NegotiationSession, messages: string[], now: string): PlanResult {
  const outcome: PlanOutcome = { ok: true, messages, at: now };
  return { session: { ...session, lastOutcome: outcome }, outcome };
}

// ---- constraints over user-provided numbers ---------------------------------------------------------

export interface PlanTotals {
  knownCost: number;
  knownMinutes: number;
  /** Entries with no user-provided cost / duration. These are unverified, not zero. */
  unknownCost: number;
  unknownMinutes: number;
}

export function planTotals(session: NegotiationSession, ids: string[]): PlanTotals {
  const totals: PlanTotals = { knownCost: 0, knownMinutes: 0, unknownCost: 0, unknownMinutes: 0 };
  for (const id of ids) {
    const d = session.candidates[id]?.details;
    if (d?.cost != null) totals.knownCost += d.cost;
    else totals.unknownCost += 1;
    if (d?.durationMinutes != null) totals.knownMinutes += d.durationMinutes;
    else totals.unknownMinutes += 1;
  }
  return totals;
}

/** Would adding `candidateId` to `selected` break a hard budget or time limit (on known numbers only)? */
export function fitsConstraints(
  session: NegotiationSession,
  constraints: GroupConstraints,
  selected: string[],
  candidateId: string,
): boolean {
  const totals = planTotals(session, selected);
  const d = session.candidates[candidateId]?.details;
  if (
    constraints.budgetMax != null &&
    d?.cost != null &&
    totals.knownCost + d.cost > constraints.budgetMax
  ) {
    return false;
  }
  if (
    constraints.maxTotalMinutes != null &&
    d?.durationMinutes != null &&
    totals.knownMinutes + d.durationMinutes > constraints.maxTotalMinutes
  ) {
    return false;
  }
  return true;
}

// ---- selection --------------------------------------------------------------------------------------

function coverageOf(r: RankedCandidate, session: NegotiationSession): Set<string> {
  const covered = new Set(r.surfacedBy);
  const fb = session.candidates[r.candidateId]?.feedback ?? {};
  for (const [memberId, kind] of Object.entries(fb))
    if (kind === 'interested') covered.add(memberId);
  return covered;
}

/**
 * Greedy selection. Each step takes the candidate with the best (score + diversity bonus), where the bonus
 * rewards reaching participants nobody in the plan has reached yet. Coverage comes only from real query
 * results and explicit "interested" responses, never from guessed similarity.
 */
export function selectCandidates(args: {
  session: NegotiationSession;
  party: Party | null;
  ranked: RankedCandidate[];
  length: number;
  start?: string[];
  avoid?: Set<string>;
}): string[] {
  const { session, party, ranked, length } = args;
  const memberCount = Math.max(1, party?.members.length ?? 1);
  const chosen = [...(args.start ?? [])];
  const byId = new Map(ranked.map((r) => [r.candidateId, r]));
  const covered = new Set<string>();
  for (const id of chosen) {
    const r = byId.get(id);
    if (r) coverageOf(r, session).forEach((m) => covered.add(m));
  }
  const pool = (allowAvoided: boolean) =>
    ranked.filter(
      (r) =>
        !chosen.includes(r.candidateId) &&
        (allowAvoided || !args.avoid?.has(r.candidateId)) &&
        fitsConstraints(session, session.constraints, chosen, r.candidateId),
    );
  for (const allowAvoided of args.avoid && args.avoid.size > 0 ? [false, true] : [true]) {
    while (chosen.length < length) {
      let best: RankedCandidate | null = null;
      let bestValue = Number.NEGATIVE_INFINITY;
      for (const r of pool(allowAvoided)) {
        const gain =
          [...coverageOf(r, session)].filter((m) => !covered.has(m)).length / memberCount;
        const value = r.score + cfg.diversityWeight * gain;
        if (value > bestValue) {
          best = r;
          bestValue = value;
        }
      }
      if (!best) break;
      chosen.push(best.candidateId);
      coverageOf(best, session).forEach((m) => covered.add(m));
    }
  }
  return chosen;
}

function toEntry(
  session: NegotiationSession,
  party: Party | null,
  ranked: RankedCandidate[],
  id: string,
  origin: PlanEntry['origin'],
): PlanEntry {
  const r = ranked.find((x) => x.candidateId === id);
  const candidate = session.candidates[id];
  const reasons = r && candidate ? explainCandidate(r, candidate, party) : [];
  return {
    candidateId: id,
    origin,
    reasons: origin === 'user' ? ['Added by the organizer.', ...reasons] : reasons,
  };
}

function provenanceFor(session: NegotiationSession, ids: string[]): string[] {
  const used = new Set<string>();
  for (const q of Object.values(session.queries)) {
    if (q.status === 'ok' && q.results.some((r) => ids.includes(r.entityId))) used.add(q.id);
  }
  return [...used].sort();
}

export function defaultTitle(session: NegotiationSession, party: Party | null): string {
  const mode = planModes[planModeFor(session.targetType)];
  return `${party?.name ?? 'Your party'}: ${mode.label.toLowerCase()}`;
}

function buildPlan(args: {
  session: NegotiationSession;
  party: Party | null;
  entries: PlanEntry[];
  previous: ExperiencePlan | null;
  planId: string;
  now: string;
}): ExperiencePlan {
  const { session, previous } = args;
  return {
    id: previous?.id ?? args.planId,
    partyId: session.partyId,
    sessionId: session.id,
    title: previous?.title ?? defaultTitle(session, args.party),
    mode: planModeFor(session.targetType),
    entries: args.entries,
    requestedLength: session.planLength,
    constraints: session.constraints,
    basedOnVersion: session.inputsVersion,
    revision: (previous?.revision ?? 0) + 1,
    readyRevision: null,
    createdAt: previous?.createdAt ?? args.now,
    updatedAt: args.now,
    finalizedAt: null,
    provenanceQueryIds: provenanceFor(
      session,
      args.entries.map((e) => e.candidateId),
    ),
  };
}

// ---- change explanation -----------------------------------------------------------------------------

export function describeChange(
  previous: ExperiencePlan | null,
  next: ExperiencePlan,
  session: NegotiationSession,
  party: Party | null,
): string[] {
  const nextIds = next.entries.map((e) => e.candidateId);
  const lines: string[] = [];
  if (!previous) {
    lines.push(`Built a ${nextIds.length}-entry plan from the current candidate pool.`);
  } else {
    const prevIds = previous.entries.map((e) => e.candidateId);
    const removed = prevIds.filter((id) => !nextIds.includes(id));
    const added = nextIds.filter((id) => !prevIds.includes(id));
    const paired = Math.min(removed.length, added.length);
    for (let i = 0; i < paired; i += 1) {
      const out = removed[i]!;
      lines.push(`${nameOf(session, added[i]!)} replaced ${nameOf(session, out)}.`);
      const c = session.candidates[out];
      if (c) {
        const e = eligibility(session, c);
        if (!e.eligible) lines.push(...describeIneligible(e.reasons, party));
      } else lines.push(`${nameOf(session, out)}.`);
    }
    for (const id of removed.slice(paired)) {
      const c = session.candidates[id];
      const e = c ? eligibility(session, c) : null;
      lines.push(
        e && !e.eligible
          ? `Removed ${nameOf(session, id)}. ${describeIneligible(e.reasons, party).join(' ')}`
          : `Removed ${nameOf(session, id)}.`,
      );
    }
    for (const id of added.slice(paired)) lines.push(`Added ${nameOf(session, id)}.`);
    if (!removed.length && !added.length && prevIds.join() !== nextIds.join())
      lines.push('The order changed.');
    if (prevIds.length !== nextIds.length) {
      lines.push(
        `The plan now has ${nextIds.length} ${nextIds.length === 1 ? 'entry' : 'entries'}.`,
      );
    }
  }
  if (nextIds.length < next.requestedLength) {
    lines.push(
      `Only ${nextIds.length} of the requested ${next.requestedLength} could be filled from eligible candidates that fit your limits. Add more interests or retry discovery when Qloo is available.`,
    );
  }
  if (lines.length === 0) lines.push('Nothing changed.');
  return lines;
}

// ---- operations -------------------------------------------------------------------------------------

export function generatePlan(
  session: NegotiationSession,
  party: Party | null,
  opts: { planId: string; now: string; alternative?: boolean },
): PlanResult {
  const { now } = opts;
  if (!party || party.members.length === 0) {
    return fail(
      session,
      'no_members',
      'There is no one in the party to plan for.',
      'Add people to the party first.',
      now,
    );
  }
  if (!lengthIsValid(session.planLength)) {
    return fail(
      session,
      'invalid_length',
      `Plans can have ${planConfig.minLength} to ${planConfig.maxLength} entries.`,
      'Choose a length in that range.',
      now,
    );
  }
  if (session.plan?.finalizedAt) {
    return fail(
      session,
      'read_only',
      'This plan is finalized.',
      'Reopen it before changing it.',
      now,
    );
  }
  if (Object.keys(session.candidates).length === 0) {
    return fail(
      session,
      'no_candidates',
      'There are no candidates yet, so there is nothing to plan with.',
      'Gather candidates from Qloo (needs a configured key and interests), or add one by hand from a search.',
      now,
    );
  }
  const ranked = rankCandidates(session, party);
  if (ranked.length === 0) {
    return fail(
      session,
      'no_eligible',
      'Every candidate has been excluded or passed on, so none can be planned.',
      'Undo an exclusion, or add interests and retry discovery to find more options.',
      now,
    );
  }

  const previous = session.plan;
  const locked = (previous?.entries ?? [])
    .filter((e) => e.origin === 'user' && ranked.some((r) => r.candidateId === e.candidateId))
    .map((e) => e.candidateId)
    .filter((id, i, all) => fitsConstraints(session, session.constraints, all.slice(0, i), id));
  const avoid = opts.alternative
    ? new Set((previous?.entries ?? []).map((e) => e.candidateId))
    : undefined;
  const ids = selectCandidates({
    session,
    party,
    ranked,
    length: session.planLength,
    start: locked,
    avoid,
  });

  if (ids.length === 0) {
    return fail(
      session,
      'constraints_conflict',
      'No eligible candidate fits the budget and time limits you entered.',
      'Raise a limit, clear a user-provided cost or duration, or add more options.',
      now,
    );
  }
  if (
    opts.alternative &&
    previous &&
    previous.entries.map((e) => e.candidateId).join() === ids.join()
  ) {
    return fail(
      session,
      'no_alternative',
      'The candidate pool does not contain a different valid plan.',
      'Add more interests, retry discovery when Qloo is available, or relax a constraint.',
      now,
    );
  }
  const origins = new Map((previous?.entries ?? []).map((e) => [e.candidateId, e.origin]));
  const entries = ids.map((id) =>
    toEntry(
      session,
      party,
      ranked,
      id,
      locked.includes(id) ? (origins.get(id) ?? 'user') : 'planner',
    ),
  );
  const plan = buildPlan({ session, party, entries, previous, planId: opts.planId, now });
  const messages = describeChange(previous, plan, session, party);
  return succeed({ ...session, plan }, messages, now);
}

function withEntries(
  session: NegotiationSession,
  entries: PlanEntry[],
  now: string,
  party: Party | null,
  planId: string,
): NegotiationSession {
  const previous = session.plan;
  const base = buildPlan({ session, party, entries, previous, planId, now });
  // Editing entries does not change which inputs the plan reflects.
  const plan: ExperiencePlan = previous
    ? {
        ...base,
        basedOnVersion: previous.basedOnVersion,
        constraints: previous.constraints,
        requestedLength: previous.requestedLength,
      }
    : base;
  return { ...session, plan };
}

export function removeEntry(
  session: NegotiationSession,
  party: Party | null,
  candidateId: string,
  now: string,
): PlanResult {
  const plan = session.plan;
  if (!plan?.entries.some((e) => e.candidateId === candidateId)) {
    return fail(
      session,
      'not_in_plan',
      'That entry is not in the plan.',
      'Pick an entry that is in the plan.',
      now,
    );
  }
  if (plan.finalizedAt)
    return fail(
      session,
      'read_only',
      'This plan is finalized.',
      'Reopen it before changing it.',
      now,
    );
  const entries = plan.entries.filter((e) => e.candidateId !== candidateId);
  return succeed(
    withEntries(session, entries, now, party, plan.id),
    [`Removed ${nameOf(session, candidateId)}.`],
    now,
  );
}

export function moveEntry(
  session: NegotiationSession,
  party: Party | null,
  candidateId: string,
  delta: -1 | 1,
  now: string,
): PlanResult {
  const plan = session.plan;
  const index = plan?.entries.findIndex((e) => e.candidateId === candidateId) ?? -1;
  if (!plan || index < 0)
    return fail(
      session,
      'not_in_plan',
      'That entry is not in the plan.',
      'Pick an entry that is in the plan.',
      now,
    );
  if (plan.finalizedAt)
    return fail(
      session,
      'read_only',
      'This plan is finalized.',
      'Reopen it before changing it.',
      now,
    );
  const target = index + delta;
  if (target < 0 || target >= plan.entries.length)
    return succeed(session, ['It is already at the end of the list.'], now);
  const entries = plan.entries.slice();
  [entries[index], entries[target]] = [entries[target]!, entries[index]!];
  return succeed(
    withEntries(session, entries, now, party, plan.id),
    [`Moved ${nameOf(session, candidateId)} ${delta < 0 ? 'earlier' : 'later'}.`],
    now,
  );
}

/** Adds an eligible candidate by hand. Hard exclusions and known-number limits still apply. */
export function addEntry(
  session: NegotiationSession,
  party: Party | null,
  candidateId: string,
  opts: { planId: string; now: string },
): PlanResult {
  const { now } = opts;
  const candidate = session.candidates[candidateId];
  if (!candidate)
    return fail(
      session,
      'not_eligible',
      'That candidate is not in the pool.',
      'Pick a candidate from the shortlist.',
      now,
    );
  if (session.plan?.finalizedAt)
    return fail(
      session,
      'read_only',
      'This plan is finalized.',
      'Reopen it before changing it.',
      now,
    );
  const e = eligibility(session, candidate, { ignoreRejected: true });
  if (!e.eligible) {
    return fail(
      session,
      'not_eligible',
      describeIneligible(e.reasons, party).join(' '),
      'Remove the exclusion first if that was a mistake.',
      now,
    );
  }
  const current = session.plan?.entries ?? [];
  if (current.some((x) => x.candidateId === candidateId)) {
    return succeed(session, [`${candidate.entity.name} is already in the plan.`], now);
  }
  const ids = current.map((x) => x.candidateId);
  if (!fitsConstraints(session, session.constraints, ids, candidateId)) {
    return fail(
      session,
      'constraints_conflict',
      `${candidate.entity.name} would break the budget or time limit you entered.`,
      'Raise the limit or remove another entry first.',
      now,
    );
  }
  const unrejected = {
    ...session,
    rejectedCandidateIds: session.rejectedCandidateIds.filter((id) => id !== candidateId),
  };
  const ranked = rankCandidates(unrejected, party, { includeIneligible: true });
  const entry = toEntry(unrejected, party, ranked, candidateId, 'user');
  const next = withEntries(unrejected, [...current, entry], now, party, opts.planId);
  return succeed(next, [`Added ${candidate.entity.name}.`], now);
}

/** Swaps one entry for the best other eligible candidate. Never fabricates a replacement. */
export function replaceEntry(
  session: NegotiationSession,
  party: Party | null,
  candidateId: string,
  now: string,
): PlanResult {
  const plan = session.plan;
  const index = plan?.entries.findIndex((e) => e.candidateId === candidateId) ?? -1;
  if (!plan || index < 0)
    return fail(
      session,
      'not_in_plan',
      'That entry is not in the plan.',
      'Pick an entry that is in the plan.',
      now,
    );
  if (plan.finalizedAt)
    return fail(
      session,
      'read_only',
      'This plan is finalized.',
      'Reopen it before changing it.',
      now,
    );
  const ranked = rankCandidates(session, party);
  const remaining = plan.entries
    .filter((e) => e.candidateId !== candidateId)
    .map((e) => e.candidateId);
  const pick = selectCandidates({
    session,
    party,
    ranked,
    length: remaining.length + 1,
    start: remaining,
    avoid: new Set([candidateId]),
  });
  const replacement = pick[pick.length - 1];
  if (!replacement || remaining.includes(replacement) || replacement === candidateId) {
    return fail(
      session,
      'no_replacement',
      'The candidate pool has no other eligible option that fits your limits.',
      'Add more interests or retry discovery when Qloo is available.',
      now,
    );
  }
  const entries = plan.entries.slice();
  entries[index] = toEntry(session, party, ranked, replacement, 'planner');
  return succeed(
    withEntries(session, entries, now, party, plan.id),
    [`${nameOf(session, replacement)} replaced ${nameOf(session, candidateId)}.`],
    now,
  );
}
