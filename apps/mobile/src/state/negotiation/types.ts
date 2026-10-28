import type { Entity, Provenance } from '@/types/api';
import type { PlanModeId } from './config';

/** Who a recommendation request was built from. */
export type QueryKind = 'member' | 'group';

/** `not_run`: skipped because an earlier request hit a blocking error. Distinct from `failed` and `empty`. */
export type QueryStatus = 'ok' | 'empty' | 'failed' | 'not_run';

export interface QueryError {
  code: string;
  message: string;
}

/** One recommendation request and what came back. Candidate provenance is derived from these records. */
export interface QueryRecord {
  id: string;
  kind: QueryKind;
  memberId: string | null;
  targetType: string;
  /** The exact Qloo entity ids sent, sorted. */
  entityIds: string[];
  /** Sorted ids joined; two requests with the same key are the same request. */
  signalsKey: string;
  status: QueryStatus;
  error: QueryError | null;
  /** Returned entity ids in response order; position is 1-based. Empty unless status is `ok`. */
  results: { entityId: string; position: number }[];
  retrievedAt: string | null;
  provenance: Provenance | null;
}

/** What a participant said about one candidate. `exclude` is the explicit, non-negotiable one. */
export type FeedbackKind = 'interested' | 'unsure' | 'pass' | 'exclude';

/** Numbers the user typed. Always labelled user-provided; never API-verified. */
export interface UserDetails {
  durationMinutes: number | null;
  cost: number | null;
  note: string;
}

export interface NegotiationCandidate {
  /** The backend-returned entity, unchanged (Qloo id preserved). */
  entity: Entity;
  /** Added by hand from a Qloo search result (a different kind of evidence from a recommendation). */
  manual: boolean;
  /** memberId to what they said. Absent means they have not said anything. */
  feedback: Record<string, FeedbackKind>;
  details: UserDetails;
}

export interface TagRef {
  id: string;
  name: string | null;
}

export interface GroupConstraints {
  /** Group-level hard exclusions (the organizer's "never include this"). */
  excludedCandidateIds: string[];
  /** Hard exclusion of everything carrying one of these Qloo tags. */
  excludedTags: TagRef[];
  /** Applies to user-provided costs only; no prices come from the API. */
  budgetMax: number | null;
  /** Applies to user-provided durations only; no durations come from the API. */
  maxTotalMinutes: number | null;
}

export interface PlanEntry {
  candidateId: string;
  origin: 'planner' | 'user';
  /** Plain-language reasons derived from real evidence when the entry was made. */
  reasons: string[];
}

export type PlanStatus = 'draft' | 'proposed' | 'needs_changes' | 'ready' | 'finalized';

export interface ExperiencePlan {
  id: string;
  partyId: string;
  sessionId: string;
  title: string;
  mode: PlanModeId;
  entries: PlanEntry[];
  requestedLength: number;
  /** Constraints in force when the plan was last built or acknowledged. */
  constraints: GroupConstraints;
  /** `session.inputsVersion` this plan reflects. A mismatch means the inputs changed since. */
  basedOnVersion: number;
  /** Bumped by every edit. */
  revision: number;
  /** The revision the organizer marked ready, if it is still the current one. */
  readyRevision: number | null;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  /** Query records whose results fed this plan (provenance). */
  provenanceQueryIds: string[];
}

export type PlanFailureCode =
  | 'no_session'
  | 'no_members'
  | 'invalid_length'
  | 'no_candidates'
  | 'no_eligible'
  | 'constraints_conflict'
  | 'no_alternative'
  | 'no_replacement'
  | 'not_eligible'
  | 'not_in_plan'
  | 'read_only'
  | 'invalid_plan'
  | 'not_ready'
  | 'not_confirmed';

/** What the last planning action did, in words the UI can show. Never a fake success. */
export type PlanOutcome =
  | { ok: true; messages: string[]; at: string }
  | { ok: false; code: PlanFailureCode; message: string; nextStep: string; at: string };

export interface NegotiationSession {
  id: string;
  partyId: string;
  targetType: string;
  createdAt: string;
  updatedAt: string;
  /** Bumped whenever anything a plan depends on changes. */
  inputsVersion: number;
  /** Fingerprint of the requests the pool was last built from. */
  requestFingerprint: string | null;
  /** scope ("group" or a member id) to entity ids the user deselected for that scope's query. */
  excludedSignals: Record<string, string[]>;
  queries: Record<string, QueryRecord>;
  candidates: Record<string, NegotiationCandidate>;
  constraints: GroupConstraints;
  /** Soft: the group passed. Not a hard exclusion; the organizer can still add it back by hand. */
  rejectedCandidateIds: string[];
  planLength: number;
  plan: ExperiencePlan | null;
  lastOutcome: PlanOutcome | null;
}

/** One candidate-source fact: this query surfaced this entity at this position. Derived, never stored. */
export interface CandidateSource {
  queryId: string;
  kind: QueryKind;
  memberId: string | null;
  position: number;
}

export type EligibilityReason =
  | { code: 'member_exclusion'; memberId: string }
  | { code: 'group_exclusion' }
  | { code: 'excluded_tag'; tag: TagRef }
  | { code: 'rejected' }
  | { code: 'wrong_category' };

export type Eligibility = { eligible: true } | { eligible: false; reasons: EligibilityReason[] };

export type IssueSeverity = 'blocking' | 'warning';

export interface PlanIssue {
  code:
    | 'empty_plan'
    | 'candidate_missing'
    | 'hard_excluded'
    | 'wrong_category'
    | 'budget_exceeded'
    | 'duration_exceeded'
    | 'stale_inputs'
    | 'party_mismatch'
    | 'responses_pending'
    | 'mixed_feedback'
    | 'budget_unverified'
    | 'duration_unverified'
    | 'partial_pool'
    | 'member_not_represented';
  severity: IssueSeverity;
  message: string;
  candidateId?: string;
}
