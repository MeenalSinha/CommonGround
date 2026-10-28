/**
 * Candidate pool: merging recommendation results, deriving provenance, deciding eligibility and
 * invalidating stale evidence. Pure functions over `NegotiationSession`.
 *
 * Evidence kinds are kept apart on purpose. A candidate being SURFACED by someone's query is not
 * evidence that they like it; that comes only from explicit feedback.
 */
import type { Entity, Provenance } from '@/types/api';
import { plan as planConfig } from './config';
import { buildQuerySpecs, poolFingerprint } from './queries';
import type {
  CandidateSource,
  Eligibility,
  EligibilityReason,
  NegotiationCandidate,
  NegotiationSession,
  QueryError,
  QueryRecord,
  UserDetails,
} from './types';
import type { Party } from '../party';

export const emptyDetails = (): UserDetails => ({ durationMinutes: null, cost: null, note: '' });

export function newSession(args: {
  id: string;
  partyId: string;
  targetType: string;
  now: string;
}): NegotiationSession {
  return {
    id: args.id,
    partyId: args.partyId,
    targetType: args.targetType,
    createdAt: args.now,
    updatedAt: args.now,
    inputsVersion: 1,
    requestFingerprint: null,
    excludedSignals: {},
    queries: {},
    candidates: {},
    constraints: {
      excludedCandidateIds: [],
      excludedTags: [],
      budgetMax: null,
      maxTotalMinutes: null,
    },
    rejectedCandidateIds: [],
    planLength: planConfig.defaultLength,
    plan: null,
    lastOutcome: null,
  };
}

export type QueryOutcome =
  | { status: 'ok' | 'empty'; items: Entity[]; provenance: Provenance }
  | { status: 'failed'; error: QueryError }
  | { status: 'not_run'; error: QueryError | null };

/**
 * Stores one query's outcome and merges its entities into the pool, deduplicating by Qloo entity id.
 * Re-applying a query replaces its own record (its old results are dropped first), so a retry or a
 * refresh can never duplicate a candidate or double count a source.
 */
export function applyQueryOutcome(
  session: NegotiationSession,
  base: Pick<QueryRecord, 'id' | 'kind' | 'memberId' | 'entityIds' | 'signalsKey'>,
  outcome: QueryOutcome,
  now: string,
): NegotiationSession {
  const record: QueryRecord = {
    ...base,
    targetType: session.targetType,
    status: outcome.status,
    error: outcome.status === 'failed' || outcome.status === 'not_run' ? outcome.error : null,
    results: [],
    retrievedAt: null,
    provenance: null,
  };
  const candidates = { ...session.candidates };

  if (outcome.status === 'ok' || outcome.status === 'empty') {
    record.provenance = outcome.provenance;
    record.retrievedAt = outcome.provenance.retrieved_at;
    const seen = new Set<string>();
    for (const entity of outcome.items) {
      if (seen.has(entity.id)) continue; // a repeated id inside one response keeps its first position
      seen.add(entity.id);
      record.results.push({ entityId: entity.id, position: record.results.length + 1 });
      const existing = candidates[entity.id];
      candidates[entity.id] = existing
        ? { ...existing, entity }
        : { entity, manual: false, feedback: {}, details: emptyDetails() };
    }
  }
  const queries = { ...session.queries, [record.id]: record };
  // A retry can return different results: drop candidates that no query surfaces any more.
  const surfaced = new Set<string>();
  for (const q of Object.values(queries)) for (const r of q.results) surfaced.add(r.entityId);
  for (const [id, candidate] of Object.entries(candidates)) {
    if (!surfaced.has(id) && !candidate.manual) delete candidates[id];
  }
  const next = {
    ...session,
    queries,
    candidates,
    rejectedCandidateIds: session.rejectedCandidateIds.filter((id) => id in candidates),
    constraints: {
      ...session.constraints,
      excludedCandidateIds: session.constraints.excludedCandidateIds.filter(
        (id) => id in candidates,
      ),
    },
  };
  return { ...next, ...touch(next, now) };
}

function touch(session: NegotiationSession, now: string) {
  return { inputsVersion: session.inputsVersion + 1, updatedAt: now };
}

export function bump(session: NegotiationSession, now: string): NegotiationSession {
  return { ...session, ...touch(session, now) };
}

/** Which queries surfaced this entity, and at what position. Derived from the query records. */
export function candidateSources(session: NegotiationSession, entityId: string): CandidateSource[] {
  const sources: CandidateSource[] = [];
  for (const id of Object.keys(session.queries).sort()) {
    const q = session.queries[id];
    if (!q || q.status !== 'ok') continue;
    const hit = q.results.find((r) => r.entityId === entityId);
    if (hit) {
      sources.push({ queryId: q.id, kind: q.kind, memberId: q.memberId, position: hit.position });
    }
  }
  return sources;
}

/** Members whose own interest-driven queries surfaced the entity (group queries are not attributed). */
export function surfacingMemberIds(sources: CandidateSource[]): string[] {
  return [
    ...new Set(sources.filter((s) => s.kind === 'member' && s.memberId).map((s) => s.memberId!)),
  ];
}

export function inGroupQuery(sources: CandidateSource[]): boolean {
  return sources.some((s) => s.kind === 'group');
}

/** Hard exclusions come from explicit `exclude` feedback, the group list, or an excluded tag. */
export function eligibility(
  session: NegotiationSession,
  candidate: NegotiationCandidate,
  options: { ignoreRejected?: boolean } = {},
): Eligibility {
  const reasons: EligibilityReason[] = [];
  const id = candidate.entity.id;
  if (candidate.entity.type !== session.targetType) reasons.push({ code: 'wrong_category' });
  for (const memberId of Object.keys(candidate.feedback).sort()) {
    if (candidate.feedback[memberId] === 'exclude')
      reasons.push({ code: 'member_exclusion', memberId });
  }
  if (session.constraints.excludedCandidateIds.includes(id))
    reasons.push({ code: 'group_exclusion' });
  const tagIds = new Set(candidate.entity.tags.map((t) => t.id));
  for (const tag of session.constraints.excludedTags) {
    if (tagIds.has(tag.id)) reasons.push({ code: 'excluded_tag', tag });
  }
  if (!options.ignoreRejected && session.rejectedCandidateIds.includes(id)) {
    reasons.push({ code: 'rejected' });
  }
  return reasons.length === 0 ? { eligible: true } : { eligible: false, reasons };
}

/** True when a hard constraint (not merely a soft rejection) rules the candidate out. */
export function isHardExcluded(
  session: NegotiationSession,
  candidate: NegotiationCandidate,
): boolean {
  const e = eligibility(session, candidate, { ignoreRejected: true });
  return !e.eligible && e.reasons.some((r) => r.code !== 'wrong_category');
}

/**
 * Brings a session back in line with the party. Called after every party or category change, so no
 * derived result can outlive the inputs that produced it:
 * - a different party or an unusable session is dropped;
 * - a different category clears the pool and plan but keeps the group's own constraints and plan length;
 * - removed people lose their feedback and queries; edited interests invalidate only the affected query;
 * - candidates with no remaining evidence (and not added by hand) leave the pool.
 * Returns the same object when nothing changed.
 */
export function reconcileSession(
  session: NegotiationSession | null,
  party: Party | null,
  targetType: string | null,
  now: string,
): NegotiationSession | null {
  if (!session) return null;
  if (!party || party.id !== session.partyId) return null;

  let next = session;
  let changed = false;
  const mark = () => {
    changed = true;
  };

  if (targetType !== null && targetType !== session.targetType) {
    next = {
      ...next,
      targetType,
      queries: {},
      candidates: {},
      rejectedCandidateIds: [],
      excludedSignals: {},
      requestFingerprint: null,
      plan: null,
      constraints: { ...next.constraints, excludedCandidateIds: [] },
      lastOutcome: null,
    };
    mark();
  }

  const memberIds = new Set(party.members.map((m) => m.id));
  const specs = buildQuerySpecs(party, next.excludedSignals);
  const specById = new Map(specs.map((s) => [s.id, s]));

  const queries = { ...next.queries };
  for (const [id, record] of Object.entries(queries)) {
    const spec = specById.get(id);
    const memberGone = record.memberId !== null && !memberIds.has(record.memberId);
    if (memberGone || !spec || spec.signalsKey !== record.signalsKey) {
      delete queries[id];
      mark();
    }
  }

  const excludedSignals = { ...next.excludedSignals };
  for (const scope of Object.keys(excludedSignals)) {
    if (scope !== 'group' && !memberIds.has(scope)) {
      delete excludedSignals[scope];
      mark();
    }
  }

  const stillSurfaced = new Set<string>();
  for (const q of Object.values(queries)) for (const r of q.results) stillSurfaced.add(r.entityId);

  const candidates: Record<string, NegotiationCandidate> = {};
  for (const [id, candidate] of Object.entries(next.candidates)) {
    if (!stillSurfaced.has(id) && !candidate.manual) {
      mark();
      continue;
    }
    const feedback = Object.fromEntries(
      Object.entries(candidate.feedback).filter(([memberId]) => memberIds.has(memberId)),
    );
    if (Object.keys(feedback).length !== Object.keys(candidate.feedback).length) {
      candidates[id] = { ...candidate, feedback };
      mark();
    } else candidates[id] = candidate;
  }

  const rejected = next.rejectedCandidateIds.filter((id) => id in candidates);
  const excluded = next.constraints.excludedCandidateIds.filter((id) => id in candidates);
  if (
    rejected.length !== next.rejectedCandidateIds.length ||
    excluded.length !== next.constraints.excludedCandidateIds.length
  ) {
    mark();
  }

  if (!changed) return session;
  const reconciled: NegotiationSession = {
    ...next,
    queries,
    candidates,
    excludedSignals,
    rejectedCandidateIds: rejected,
    constraints: { ...next.constraints, excludedCandidateIds: excluded },
    requestFingerprint: poolFingerprint(
      next.targetType,
      specs.filter((s) => queries[s.id]),
    ),
  };
  // A finalized plan cannot stay final once the inputs underneath it have changed.
  const plan = reconciled.plan?.finalizedAt
    ? { ...reconciled.plan, finalizedAt: null, readyRevision: null }
    : reconciled.plan;
  return bump({ ...reconciled, plan }, now);
}
