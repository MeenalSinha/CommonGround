/**
 * Plan validation, status and finalization. Deterministic and independent of the UI.
 * Blocking issues stop a plan from being marked ready or finalized; warnings are shown but never hidden.
 */
import { describeIneligible, nameList, namesFor } from './explain';
import { eligibility, isHardExcluded } from './pool';
import { planTotals } from './planner';
import { unrepresentedMembers } from './queries';
import type {
  ExperiencePlan,
  NegotiationSession,
  PlanFailureCode,
  PlanIssue,
  PlanOutcome,
  PlanStatus,
} from './types';
import type { Party } from '../party';

export function validatePlan(session: NegotiationSession, party: Party | null): PlanIssue[] {
  const plan = session.plan;
  if (!plan) return [];
  const issues: PlanIssue[] = [];
  const block = (i: Omit<PlanIssue, 'severity'>) => issues.push({ ...i, severity: 'blocking' });
  const warn = (i: Omit<PlanIssue, 'severity'>) => issues.push({ ...i, severity: 'warning' });

  if (!party || party.id !== plan.partyId || party.id !== session.partyId) {
    block({ code: 'party_mismatch', message: 'This plan belongs to a different party.' });
    return issues;
  }
  if (plan.entries.length === 0) {
    block({ code: 'empty_plan', message: 'The plan has no entries yet.' });
  }
  if (plan.basedOnVersion !== session.inputsVersion) {
    block({
      code: 'stale_inputs',
      message:
        'Feedback, constraints, candidates or the requested length changed since this plan was made. Regenerate it, or confirm it still works.',
    });
  }

  const ids = plan.entries.map((e) => e.candidateId);
  for (const id of ids) {
    const candidate = session.candidates[id];
    if (!candidate) {
      block({
        code: 'candidate_missing',
        candidateId: id,
        message: 'An entry is no longer in the candidate pool. Remove or replace it.',
      });
      continue;
    }
    if (candidate.entity.type !== session.targetType) {
      block({
        code: 'wrong_category',
        candidateId: id,
        message: `${candidate.entity.name} does not match the category being planned.`,
      });
    }
    if (isHardExcluded(session, candidate)) {
      const e = eligibility(session, candidate, { ignoreRejected: true });
      const why = e.eligible
        ? ''
        : describeIneligible(
            e.reasons.filter((r) => r.code !== 'wrong_category'),
            party,
          ).join(' ');
      block({
        code: 'hard_excluded',
        candidateId: id,
        message: `${candidate.entity.name}: ${why}`,
      });
    }
    const feedback = candidate.feedback;
    const passed = namesFor(
      party,
      Object.keys(feedback).filter((m) => feedback[m] === 'pass'),
    );
    if (passed.length) {
      warn({
        code: 'mixed_feedback',
        candidateId: id,
        message: `${candidate.entity.name}: ${nameList(passed)} would rather pass.`,
      });
    }
  }

  const totals = planTotals(session, ids);
  const { budgetMax, maxTotalMinutes } = session.constraints;
  if (budgetMax != null && totals.knownCost > budgetMax) {
    block({
      code: 'budget_exceeded',
      message: `The user-provided costs add up to ${totals.knownCost}, over the budget of ${budgetMax}.`,
    });
  }
  if (maxTotalMinutes != null && totals.knownMinutes > maxTotalMinutes) {
    block({
      code: 'duration_exceeded',
      message: `The user-provided durations add up to ${totals.knownMinutes} minutes, over the limit of ${maxTotalMinutes}.`,
    });
  }
  if (budgetMax != null && totals.unknownCost > 0) {
    warn({
      code: 'budget_unverified',
      message: `${totals.unknownCost} ${totals.unknownCost === 1 ? 'entry has' : 'entries have'} no cost you entered, so the budget cannot be checked for ${totals.unknownCost === 1 ? 'it' : 'them'}. No prices come from Qloo.`,
    });
  }
  if (maxTotalMinutes != null && totals.unknownMinutes > 0) {
    warn({
      code: 'duration_unverified',
      message: `${totals.unknownMinutes} ${totals.unknownMinutes === 1 ? 'entry has' : 'entries have'} no duration you entered, so the time limit cannot be checked for ${totals.unknownMinutes === 1 ? 'it' : 'them'}.`,
    });
  }

  const memberIds = party.members.map((m) => m.id);
  const waiting = new Set<string>();
  for (const id of ids) {
    const fb = session.candidates[id]?.feedback ?? {};
    for (const m of memberIds) if (!fb[m]) waiting.add(m);
  }
  if (waiting.size) {
    warn({
      code: 'responses_pending',
      message: `Still waiting on a response from ${nameList(namesFor(party, [...waiting]))} for at least one entry. This plan is not approved by everyone.`,
    });
  }
  const none = unrepresentedMembers(party);
  if (none.length) {
    warn({
      code: 'member_not_represented',
      message: `${nameList(none.map((m) => m.displayName))} ${none.length === 1 ? 'has' : 'have'} no Qloo interests, so discovery did not consider ${none.length === 1 ? 'them' : 'them'}.`,
    });
  }
  if (Object.values(session.queries).some((q) => q.status === 'failed' || q.status === 'not_run')) {
    warn({
      code: 'partial_pool',
      message:
        'Some recommendation requests failed or were not sent, so the candidates do not reflect everyone equally.',
    });
  }
  return issues;
}

export const blockingIssues = (issues: PlanIssue[]) =>
  issues.filter((i) => i.severity === 'blocking');

/**
 * draft: no entries. needs_changes: a blocking issue exists. ready: the organizer confirmed this exact
 * revision. proposed: valid, awaiting that confirmation. finalized: explicitly confirmed and locked.
 */
export function planStatus(session: NegotiationSession, party: Party | null): PlanStatus | null {
  const plan = session.plan;
  if (!plan) return null;
  if (plan.finalizedAt) return 'finalized';
  if (plan.entries.length === 0) return 'draft';
  if (blockingIssues(validatePlan(session, party)).length > 0) return 'needs_changes';
  return plan.readyRevision === plan.revision ? 'ready' : 'proposed';
}

export const STATUS_LABELS: Record<PlanStatus, string> = {
  draft: 'Draft',
  proposed: 'Proposed',
  needs_changes: 'Needs changes',
  ready: 'Ready for confirmation',
  finalized: 'Finalized',
};

export const STATUS_MEANINGS: Record<PlanStatus, string> = {
  draft: 'The plan has no entries yet.',
  proposed: 'A valid plan that the organizer has not confirmed yet.',
  needs_changes:
    'Something blocks it: an exclusion, a limit, a stale input or a missing candidate.',
  ready: 'The organizer confirmed this version. One more explicit step finalizes it.',
  finalized: 'Confirmed and locked on this device. Reopen it to change anything.',
};

interface Planned {
  session: NegotiationSession;
  outcome: PlanOutcome;
}

function fail(
  session: NegotiationSession,
  code: PlanFailureCode,
  message: string,
  nextStep: string,
  now: string,
): Planned {
  const outcome: PlanOutcome = { ok: false, code, message, nextStep, at: now };
  return { session: { ...session, lastOutcome: outcome }, outcome };
}

function ok(session: NegotiationSession, messages: string[], now: string): Planned {
  const outcome: PlanOutcome = { ok: true, messages, at: now };
  return { session: { ...session, lastOutcome: outcome }, outcome };
}

function replacePlan(session: NegotiationSession, plan: ExperiencePlan): NegotiationSession {
  return { ...session, plan };
}

/** Organizer confirms the current revision as ready. Refused while anything blocks the plan. */
export function markReady(session: NegotiationSession, party: Party | null, now: string): Planned {
  const plan = session.plan;
  if (!plan)
    return fail(session, 'invalid_plan', 'There is no plan yet.', 'Build a plan first.', now);
  if (plan.finalizedAt)
    return fail(session, 'read_only', 'This plan is finalized.', 'Reopen it first.', now);
  const blocking = blockingIssues(validatePlan(session, party));
  if (blocking.length)
    return fail(
      session,
      'invalid_plan',
      blocking[0]!.message,
      'Fix the blocking issues first.',
      now,
    );
  return ok(
    replacePlan(session, { ...plan, readyRevision: plan.revision, updatedAt: now }),
    ['Marked ready for your confirmation.'],
    now,
  );
}

/** Accepts that the plan still works after the inputs changed. Only possible if nothing else blocks it. */
export function acknowledgeInputs(
  session: NegotiationSession,
  party: Party | null,
  now: string,
): Planned {
  const plan = session.plan;
  if (!plan)
    return fail(session, 'invalid_plan', 'There is no plan yet.', 'Build a plan first.', now);
  if (plan.finalizedAt)
    return fail(session, 'read_only', 'This plan is finalized.', 'Reopen it first.', now);
  const others = blockingIssues(validatePlan(session, party)).filter(
    (i) => i.code !== 'stale_inputs',
  );
  if (others.length)
    return fail(
      session,
      'invalid_plan',
      others[0]!.message,
      'Fix that first, or regenerate the plan.',
      now,
    );
  const next: ExperiencePlan = {
    ...plan,
    basedOnVersion: session.inputsVersion,
    constraints: session.constraints,
    requestedLength: session.planLength,
    revision: plan.revision + 1,
    readyRevision: null,
    updatedAt: now,
  };
  return ok(
    replacePlan(session, next),
    ['Confirmed that the plan still reflects the current inputs.'],
    now,
  );
}

/**
 * Finalizes only when the organizer explicitly confirms, the plan is ready, and validation passes again
 * right now. Unresolved responses remain warnings; finalizing never claims everyone approved.
 */
export function finalizePlan(
  session: NegotiationSession,
  party: Party | null,
  args: { confirmed: boolean; now: string },
): Planned {
  const { now } = args;
  const plan = session.plan;
  if (!plan)
    return fail(
      session,
      'invalid_plan',
      'There is no plan to finalize.',
      'Build a plan first.',
      now,
    );
  if (plan.finalizedAt) return ok(session, ['This plan is already finalized.'], now);
  if (!args.confirmed)
    return fail(
      session,
      'not_confirmed',
      'Finalizing needs your explicit confirmation.',
      'Confirm to finalize.',
      now,
    );
  const blocking = blockingIssues(validatePlan(session, party));
  if (blocking.length)
    return fail(
      session,
      'invalid_plan',
      blocking[0]!.message,
      'Fix the blocking issues first.',
      now,
    );
  if (plan.readyRevision !== plan.revision) {
    return fail(
      session,
      'not_ready',
      'Mark the current version ready before finalizing.',
      'Review the plan, then mark it ready.',
      now,
    );
  }
  return ok(
    replacePlan(session, { ...plan, finalizedAt: now, updatedAt: now }),
    ['Plan finalized on this device. It is not shared with anyone else.'],
    now,
  );
}

export function reopenPlan(session: NegotiationSession, now: string): Planned {
  const plan = session.plan;
  if (!plan?.finalizedAt)
    return fail(session, 'invalid_plan', 'The plan is not finalized.', 'Nothing to reopen.', now);
  return ok(
    replacePlan(session, {
      ...plan,
      finalizedAt: null,
      readyRevision: null,
      revision: plan.revision + 1,
      updatedAt: now,
    }),
    ['Plan reopened for changes.'],
    now,
  );
}
