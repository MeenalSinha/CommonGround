/**
 * The planning agent's retrieval step. It coordinates real operations against the existing backend:
 * inspect the party, build the per-participant and group queries, send them ONE AT A TIME, and feed each
 * outcome to the reducer, which deduplicates and guards against stale responses.
 *
 * It never invents results. A failed request is recorded as failed; after an error that cannot succeed
 * (rate limit, missing key, backend down) the remaining requests are recorded as not sent, not as empty.
 */
import { ApiError } from '@/services/apiClient';
import type { RecommendationsResponse } from '@/types/api';
import { discovery } from './config';
import { buildQuerySpecs, requestGroups, type RequestGroup } from './queries';
import type { NegotiationAction } from './reducer';
import type { PartyState } from '../party';

export type GatherPhase = 'requesting' | 'merging' | 'done';

export interface GatherStage {
  phase: GatherPhase;
  /** An accurate stage label. No percentages: progress is not measured, only counted. */
  label: string;
  step: { current: number; total: number } | null;
}

export interface GatherSummary {
  requested: number;
  ok: number;
  empty: number;
  failed: number;
  notSent: number;
  stoppedBecause: string | null;
}

export interface GatherArgs {
  getState: () => PartyState;
  dispatch: (action: NegotiationAction) => void;
  recommend: (type: string, entityIds: string[], limit: number) => Promise<RecommendationsResponse>;
  /** true re-requests everything; false (default) requests only what is missing or failed. */
  force?: boolean;
  onStage?: (stage: GatherStage) => void;
  wait?: (ms: number) => Promise<void>;
  now?: () => string;
  isCancelled?: () => boolean;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function describe(group: RequestGroup, state: PartyState): string {
  const names = group.specs
    .filter((s) => s.kind === 'member')
    .map((s) => state.party?.members.find((m) => m.id === s.memberId)?.displayName)
    .filter((n): n is string => Boolean(n));
  if (names.length === 0) return 'Asking Qloo about the whole group’s interests';
  return `Asking Qloo about ${names.join(' and ')}’s interests`;
}

export async function gatherCandidates(args: GatherArgs): Promise<GatherSummary> {
  const now = args.now ?? (() => new Date().toISOString());
  const wait = args.wait ?? sleep;
  const summary: GatherSummary = {
    requested: 0,
    ok: 0,
    empty: 0,
    failed: 0,
    notSent: 0,
    stoppedBecause: null,
  };

  const start = args.getState();
  const session = start.negotiation;
  if (!session) return summary;
  const targetType = session.targetType;

  const needed = requestGroups(buildQuerySpecs(start.party, session.excludedSignals)).filter(
    (group) =>
      args.force
        ? true
        : group.specs.some((spec) => {
            const record = session.queries[spec.id];
            return (
              !record ||
              record.signalsKey !== spec.signalsKey ||
              record.status === 'failed' ||
              record.status === 'not_run'
            );
          }),
  );

  for (let i = 0; i < needed.length; i += 1) {
    const group = needed[i]!;
    if (args.isCancelled?.()) break;
    args.onStage?.({
      phase: 'requesting',
      label: describe(group, args.getState()),
      step: { current: i + 1, total: needed.length },
    });
    summary.requested += 1;
    const queryIds = group.specs.map((s) => s.id);
    try {
      const response = await args.recommend(targetType, group.entityIds, discovery.itemsPerQuery);
      const status = response.items.length > 0 ? 'ok' : 'empty';
      summary[status] += 1;
      args.dispatch({
        type: 'negotiation/queryResult',
        queryIds,
        signalsKey: group.signalsKey,
        targetType,
        outcome: { status, items: response.items, provenance: response.provenance },
        now: now(),
      });
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'unexpected';
      const message =
        error instanceof ApiError
          ? error.message
          : 'Something unexpected went wrong while asking Qloo.';
      summary.failed += 1;
      args.dispatch({
        type: 'negotiation/queryResult',
        queryIds,
        signalsKey: group.signalsKey,
        targetType,
        outcome: { status: 'failed', error: { code, message } },
        now: now(),
      });
      if (discovery.stopOnErrorCodes.includes(code)) {
        summary.stoppedBecause = code;
        for (const rest of needed.slice(i + 1)) {
          summary.notSent += 1;
          args.dispatch({
            type: 'negotiation/queryResult',
            queryIds: rest.specs.map((s) => s.id),
            signalsKey: rest.signalsKey,
            targetType,
            outcome: {
              status: 'not_run',
              error: { code, message: 'Not sent after an earlier request failed.' },
            },
            now: now(),
          });
        }
        break;
      }
    }
    if (i < needed.length - 1 && discovery.requestSpacingMs > 0)
      await wait(discovery.requestSpacingMs);
  }
  args.onStage?.({ phase: 'merging', label: 'Merging results', step: null });
  args.onStage?.({ phase: 'done', label: 'Done', step: null });
  return summary;
}
