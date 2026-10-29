/**
 * Every tunable number and mapping for the negotiation engine lives here, with the reason it exists.
 * Nothing below is Qloo data and none of it is presented to the user as a Qloo score.
 */

/** One definition, owned by `party.ts`; mirrors the backend contract (at most 20 entity ids per request). */
export { MAX_SIGNAL_IDS } from '../party';

export const discovery = {
  /** Items requested per recommendation query. The backend allows 1 to 50; 10 keeps lists comparable. */
  itemsPerQuery: 10,
  /** A member needs at least this many resolved interests to get an individual query. */
  minMemberSignals: 1,
  /** A group-level query is offered only when at least this many members contribute a signal. */
  minGroupContributors: 2,
  /** Pause between sequential requests, to stay well inside rate limits (no numeric limit is documented). */
  requestSpacingMs: 250,
  /** After one of these errors, remaining requests are NOT sent: they cannot succeed or would worsen it. */
  stopOnErrorCodes: [
    'qloo_rate_limited',
    'qloo_not_configured',
    'qloo_auth_failed',
    'qloo_unreachable',
    'backend_unreachable',
    'backend_timeout',
  ] as readonly string[],
} as const;

export const ranking = {
  /**
   * Reciprocal Rank Fusion constant (Cormack, Clarke and Buettcher, SIGIR 2009 used k = 60). It damps the
   * advantage of being first so that appearing in several lists matters more than topping one.
   */
  rrfK: 60,
  /** A group-level list counts as one list with this weight (1 = same as one participant's list). */
  groupListWeight: 1,
  /** Weight of the normalised rank-fusion evidence (0 to 1) in the combined score. */
  evidenceWeight: 1,
  /** Weight of explicit feedback. Larger than evidence on purpose: stated opinions beat inferred ones. */
  feedbackWeight: 1.5,
  /** Per-person feedback values, averaged over the party. "Unsure" is mildly positive: not a refusal. */
  feedbackValue: { interested: 1, unsure: 0.25, pass: -1 },
  /** A candidate the organizer added by hand has no recommendation evidence; this stands in for intent. */
  manualBoost: 0.5,
  /**
   * During selection, a candidate that reaches participants not yet represented in the plan gets up to this
   * much extra, so one person's cluster of results cannot crowd out connections to everyone else.
   */
  diversityWeight: 0.6,
} as const;

export const plan = {
  minLength: 1,
  maxLength: 8,
  defaultLength: 3,
  /** Upper bound for user-entered numbers, to reject typos rather than store nonsense. */
  maxUserNumber: 1_000_000,
} as const;

export type PlanModeId = 'outing' | 'cultural_discovery' | 'shared_experience';

/**
 * How a result category is described. A place-like category is an outing sequence; media categories are
 * shared-experience plans, never a route. Unknown categories fall back to the least presumptuous mode.
 */
export const planModes: Record<
  PlanModeId,
  { label: string; types: readonly string[]; note: string }
> = {
  outing: {
    label: 'Outing sequence',
    types: ['urn:entity:place', 'urn:entity:destination'],
    note: 'The order is a suggested sequence. Locations, opening hours, prices and travel times are not verified.',
  },
  cultural_discovery: {
    label: 'Cultural discovery sequence',
    types: [
      'urn:entity:artist',
      'urn:entity:book',
      'urn:entity:podcast',
      'urn:entity:person',
      'urn:entity:brand',
    ],
    note: 'This is a sequence of things to explore together, not a physical route or a schedule.',
  },
  shared_experience: {
    label: 'Shared-experience plan',
    types: ['urn:entity:movie', 'urn:entity:tv_show', 'urn:entity:videogame'],
    note: 'This is an ordered list of things to enjoy together, not a schedule. Availability is not verified.',
  },
};

export function planModeFor(targetType: string): PlanModeId {
  for (const [id, mode] of Object.entries(planModes)) {
    if (mode.types.includes(targetType)) return id as PlanModeId;
  }
  return 'shared_experience';
}

export const persistence = {
  /** Bump when the saved shape changes and add a migration in `persistence.ts`. */
  schemaVersion: 1,
  storageKey: 'commonground.session',
  /** Unreadable or too-new saves are copied here instead of being destroyed. */
  backupKey: 'commonground.session.unreadable',
  /** Writes are coalesced for this long; the latest state always wins. */
  debounceMs: 400,
} as const;
