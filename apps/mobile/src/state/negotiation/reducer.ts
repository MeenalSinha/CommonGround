/**
 * Negotiation and plan actions. Operates on the shared `PartyState` (one source of truth); see `store.ts`.
 * The reducer is pure: ids and timestamps arrive inside actions.
 */
import type { Entity } from '@/types/api';
import { plan as planConfig } from './config';
import { cleanDetails } from './inputs';
import { acknowledgeInputs, finalizePlan, markReady, reopenPlan } from './validation';
import {
  addEntry,
  generatePlan,
  moveEntry,
  removeEntry,
  replaceEntry,
  lengthIsValid,
  type PlanResult,
} from './planner';
import { applyQueryOutcome, bump, emptyDetails, newSession, type QueryOutcome } from './pool';
import { buildQuerySpecs, poolFingerprint } from './queries';
import type {
  FeedbackKind,
  GroupConstraints,
  NegotiationSession,
  PlanOutcome,
  TagRef,
  UserDetails,
} from './types';
import type { PartyState } from '../party';

export type NegotiationAction =
  | { type: 'negotiation/start'; id: string; now: string }
  | { type: 'negotiation/reset' }
  | { type: 'negotiation/signal'; scope: string; entityId: string; included: boolean; now: string }
  | {
      type: 'negotiation/queryResult';
      queryIds: string[];
      signalsKey: string;
      targetType: string;
      outcome: QueryOutcome;
      now: string;
    }
  | {
      type: 'negotiation/feedback';
      candidateId: string;
      memberId: string;
      kind: FeedbackKind | null;
      now: string;
    }
  | {
      type: 'negotiation/constraint';
      patch: Partial<Pick<GroupConstraints, 'budgetMax' | 'maxTotalMinutes'>>;
      now: string;
    }
  | { type: 'negotiation/excludeTag'; tag: TagRef; now: string }
  | { type: 'negotiation/includeTag'; tagId: string; now: string }
  | { type: 'negotiation/excludeCandidate'; candidateId: string; now: string }
  | { type: 'negotiation/unexcludeCandidate'; candidateId: string; now: string }
  | { type: 'negotiation/reject'; candidateId: string; now: string }
  | { type: 'negotiation/unreject'; candidateId: string; now: string }
  | { type: 'negotiation/details'; candidateId: string; patch: Partial<UserDetails>; now: string }
  | { type: 'negotiation/addManual'; entity: Entity; now: string }
  | { type: 'negotiation/planLength'; length: number; now: string }
  | { type: 'plan/generate'; planId: string; alternative: boolean; now: string }
  | { type: 'plan/add'; candidateId: string; planId: string; now: string }
  | { type: 'plan/remove'; candidateId: string; now: string }
  | { type: 'plan/replace'; candidateId: string; now: string }
  | { type: 'plan/move'; candidateId: string; delta: -1 | 1; now: string }
  | { type: 'plan/reject'; candidateId: string; now: string }
  | { type: 'plan/exclude'; candidateId: string; now: string }
  | { type: 'plan/rename'; title: string; now: string }
  | { type: 'plan/ready'; now: string }
  | { type: 'plan/acknowledge'; now: string }
  | { type: 'plan/finalize'; confirmed: boolean; now: string }
  | { type: 'plan/reopen'; now: string };

const READ_ONLY: Omit<Extract<PlanOutcome, { ok: false }>, 'at'> = {
  ok: false,
  code: 'read_only',
  message: 'This plan is finalized, so its inputs are locked.',
  nextStep: 'Reopen the plan to change feedback, limits or candidates.',
};

function withSession(state: PartyState, session: NegotiationSession): PartyState {
  return { ...state, negotiation: session };
}

function applyResult(state: PartyState, result: PlanResult): PartyState {
  return withSession(state, result.session);
}

/** After a change the plan itself caused (reject, exclude), it already reflects the new inputs. */
function rebase(session: NegotiationSession): NegotiationSession {
  const plan = session.plan;
  if (!plan) return session;
  return {
    ...session,
    plan: {
      ...plan,
      basedOnVersion: session.inputsVersion,
      constraints: session.constraints,
      readyRevision: null,
      revision: plan.revision + 1,
    },
  };
}

export function negotiationReducer(state: PartyState, action: NegotiationAction): PartyState {
  const { party } = state;
  let session = state.negotiation;

  if (action.type === 'negotiation/start') {
    if (session || !party || !state.targetType) return state;
    return withSession(
      state,
      newSession({
        id: action.id,
        partyId: party.id,
        targetType: state.targetType,
        now: action.now,
      }),
    );
  }
  if (action.type === 'negotiation/reset') return { ...state, negotiation: null };
  if (!session) return state;

  const finalized = Boolean(session.plan?.finalizedAt);
  const refuse = (now: string): PartyState =>
    withSession(state, { ...session!, lastOutcome: { ...READ_ONLY, at: now } });

  switch (action.type) {
    case 'negotiation/signal': {
      if (finalized) return refuse(action.now);
      const current = new Set(session.excludedSignals[action.scope] ?? []);
      if (action.included) current.delete(action.entityId);
      else current.add(action.entityId);
      const same =
        [...current].sort().join() ===
        [...(session.excludedSignals[action.scope] ?? [])].sort().join();
      if (same) return state;
      const excludedSignals = { ...session.excludedSignals, [action.scope]: [...current] };
      if (current.size === 0) delete excludedSignals[action.scope];
      // The query for this scope now has different signals; its old record no longer applies.
      const queries = { ...session.queries };
      const specs = buildQuerySpecs(party, excludedSignals);
      for (const [id, record] of Object.entries(queries)) {
        const spec = specs.find((s) => s.id === id);
        if (!spec || spec.signalsKey !== record.signalsKey) delete queries[id];
      }
      const surfaced = new Set(
        Object.values(queries).flatMap((q) => q.results.map((r) => r.entityId)),
      );
      const candidates = Object.fromEntries(
        Object.entries(session.candidates).filter(([id, c]) => c.manual || surfaced.has(id)),
      );
      const next: NegotiationSession = {
        ...session,
        excludedSignals,
        queries,
        candidates,
        rejectedCandidateIds: session.rejectedCandidateIds.filter((id) => id in candidates),
        constraints: {
          ...session.constraints,
          excludedCandidateIds: session.constraints.excludedCandidateIds.filter(
            (id) => id in candidates,
          ),
        },
        requestFingerprint: poolFingerprint(
          session.targetType,
          specs.filter((s) => queries[s.id]),
        ),
      };
      return withSession(state, bump(next, action.now));
    }

    case 'negotiation/queryResult': {
      // Late-response guard: accept only if the session, category and each query's current signals still match.
      if (finalized || action.targetType !== session.targetType) return state;
      const specs = buildQuerySpecs(party, session.excludedSignals);
      let next = session;
      let applied = false;
      for (const id of action.queryIds) {
        const spec = specs.find((s) => s.id === id);
        if (!spec || spec.signalsKey !== action.signalsKey || spec.overLimitBy > 0) continue;
        next = applyQueryOutcome(next, spec, action.outcome, action.now);
        applied = true;
      }
      if (!applied) return state;
      next = {
        ...next,
        requestFingerprint: poolFingerprint(
          next.targetType,
          specs.filter((s) => next.queries[s.id]),
        ),
      };
      return withSession(state, next);
    }

    case 'negotiation/feedback': {
      if (finalized) return refuse(action.now);
      const candidate = session.candidates[action.candidateId];
      if (!candidate || !party?.members.some((m) => m.id === action.memberId)) return state;
      const feedback = { ...candidate.feedback };
      if (action.kind === null) delete feedback[action.memberId];
      else feedback[action.memberId] = action.kind;
      if (feedback[action.memberId] === candidate.feedback[action.memberId]) return state;
      return withSession(
        state,
        bump(
          {
            ...session,
            candidates: { ...session.candidates, [action.candidateId]: { ...candidate, feedback } },
          },
          action.now,
        ),
      );
    }

    case 'negotiation/constraint': {
      if (finalized) return refuse(action.now);
      const { budgetMax, maxTotalMinutes } = action.patch;
      const valid = (v: number | null | undefined, integer: boolean) =>
        v === undefined ||
        v === null ||
        (Number.isFinite(v) &&
          v > 0 &&
          v <= planConfig.maxUserNumber &&
          (!integer || Number.isInteger(v)));
      if (!valid(budgetMax, false) || !valid(maxTotalMinutes, true)) return state;
      const constraints = { ...session.constraints, ...action.patch };
      if (
        constraints.budgetMax === session.constraints.budgetMax &&
        constraints.maxTotalMinutes === session.constraints.maxTotalMinutes
      )
        return state;
      return withSession(state, bump({ ...session, constraints }, action.now));
    }

    case 'negotiation/excludeTag': {
      if (finalized) return refuse(action.now);
      if (session.constraints.excludedTags.some((t) => t.id === action.tag.id)) return state;
      const constraints = {
        ...session.constraints,
        excludedTags: [...session.constraints.excludedTags, action.tag],
      };
      return withSession(state, bump({ ...session, constraints }, action.now));
    }
    case 'negotiation/includeTag': {
      if (finalized) return refuse(action.now);
      const excludedTags = session.constraints.excludedTags.filter((t) => t.id !== action.tagId);
      if (excludedTags.length === session.constraints.excludedTags.length) return state;
      return withSession(
        state,
        bump({ ...session, constraints: { ...session.constraints, excludedTags } }, action.now),
      );
    }

    case 'negotiation/excludeCandidate': {
      if (finalized) return refuse(action.now);
      if (
        !session.candidates[action.candidateId] ||
        session.constraints.excludedCandidateIds.includes(action.candidateId)
      )
        return state;
      const constraints = {
        ...session.constraints,
        excludedCandidateIds: [...session.constraints.excludedCandidateIds, action.candidateId],
      };
      return withSession(state, bump({ ...session, constraints }, action.now));
    }
    case 'negotiation/unexcludeCandidate': {
      if (finalized) return refuse(action.now);
      const ids = session.constraints.excludedCandidateIds.filter(
        (id) => id !== action.candidateId,
      );
      if (ids.length === session.constraints.excludedCandidateIds.length) return state;
      return withSession(
        state,
        bump(
          { ...session, constraints: { ...session.constraints, excludedCandidateIds: ids } },
          action.now,
        ),
      );
    }

    case 'negotiation/reject': {
      if (finalized) return refuse(action.now);
      if (
        !session.candidates[action.candidateId] ||
        session.rejectedCandidateIds.includes(action.candidateId)
      )
        return state;
      return withSession(
        state,
        bump(
          {
            ...session,
            rejectedCandidateIds: [...session.rejectedCandidateIds, action.candidateId],
          },
          action.now,
        ),
      );
    }
    case 'negotiation/unreject': {
      if (finalized) return refuse(action.now);
      const ids = session.rejectedCandidateIds.filter((id) => id !== action.candidateId);
      if (ids.length === session.rejectedCandidateIds.length) return state;
      return withSession(state, bump({ ...session, rejectedCandidateIds: ids }, action.now));
    }

    case 'negotiation/details': {
      if (finalized) return refuse(action.now);
      const candidate = session.candidates[action.candidateId];
      if (!candidate) return state;
      const details = cleanDetails(action.patch, candidate.details);
      if (!details || JSON.stringify(details) === JSON.stringify(candidate.details)) return state;
      return withSession(
        state,
        bump(
          {
            ...session,
            candidates: { ...session.candidates, [action.candidateId]: { ...candidate, details } },
          },
          action.now,
        ),
      );
    }

    case 'negotiation/addManual': {
      if (finalized) return refuse(action.now);
      const { entity } = action;
      if (entity.type !== session.targetType) {
        const outcome: PlanOutcome = {
          ok: false,
          code: 'not_eligible',
          message: 'That result is in a different category from the one being planned.',
          nextStep: 'Search within the planned category.',
          at: action.now,
        };
        return withSession(state, { ...session, lastOutcome: outcome });
      }
      const existing = session.candidates[entity.id];
      const candidate = existing
        ? existing.manual
          ? existing
          : { ...existing, manual: true }
        : { entity, manual: true, feedback: {}, details: emptyDetails() };
      if (existing && existing.manual) return state;
      return withSession(
        state,
        bump(
          { ...session, candidates: { ...session.candidates, [entity.id]: candidate } },
          action.now,
        ),
      );
    }

    case 'negotiation/planLength': {
      if (finalized) return refuse(action.now);
      if (!lengthIsValid(action.length) || action.length === session.planLength) return state;
      return withSession(state, bump({ ...session, planLength: action.length }, action.now));
    }

    case 'plan/generate':
      return applyResult(
        state,
        generatePlan(session, party, {
          planId: action.planId,
          now: action.now,
          alternative: action.alternative,
        }),
      );
    case 'plan/add':
      return applyResult(
        state,
        addEntry(session, party, action.candidateId, { planId: action.planId, now: action.now }),
      );
    case 'plan/remove':
      return applyResult(state, removeEntry(session, party, action.candidateId, action.now));
    case 'plan/replace':
      return applyResult(state, replaceEntry(session, party, action.candidateId, action.now));
    case 'plan/move':
      return applyResult(
        state,
        moveEntry(session, party, action.candidateId, action.delta, action.now),
      );

    case 'plan/reject':
    case 'plan/exclude': {
      if (finalized) return refuse(action.now);
      const entry = session.plan?.entries.find((e) => e.candidateId === action.candidateId);
      if (!entry || !session.plan) return state;
      const name = session.candidates[action.candidateId]?.entity.name ?? 'That entry';
      const removed = removeEntry(session, party, action.candidateId, action.now).session;
      const decided: NegotiationSession =
        action.type === 'plan/reject'
          ? {
              ...removed,
              rejectedCandidateIds: [
                ...new Set([...removed.rejectedCandidateIds, action.candidateId]),
              ],
            }
          : {
              ...removed,
              constraints: {
                ...removed.constraints,
                excludedCandidateIds: [
                  ...new Set([...removed.constraints.excludedCandidateIds, action.candidateId]),
                ],
              },
            };
      const message =
        action.type === 'plan/reject'
          ? `${name} was removed and will not be suggested again unless you add it back by hand.`
          : `${name} is now a hard exclusion for the whole group and was removed from the plan.`;
      const next = rebase(bump(decided, action.now));
      return withSession(state, {
        ...next,
        lastOutcome: { ok: true, messages: [message], at: action.now },
      });
    }

    case 'plan/rename': {
      if (finalized || !session.plan) return finalized ? refuse(action.now) : state;
      const title = action.title.replace(/\s+/g, ' ').trim();
      if (!title || title.length > 60) return state;
      return withSession(state, {
        ...session,
        plan: { ...session.plan, title, updatedAt: action.now },
      });
    }

    case 'plan/ready':
      return applyResult(state, markReady(session, party, action.now));
    case 'plan/acknowledge':
      return applyResult(state, acknowledgeInputs(session, party, action.now));
    case 'plan/finalize':
      return applyResult(
        state,
        finalizePlan(session, party, { confirmed: action.confirmed, now: action.now }),
      );
    case 'plan/reopen':
      return applyResult(state, reopenPlan(session, action.now));
  }
  return state;
}
