/** Pure view-model for the negotiation screens. Everything shown is derived from state; nothing is invented. */
import { representationNotes } from './explain';
import { buildQuerySpecs, gatherBlockers, poolProgress, unrepresentedMembers } from './queries';
import { rankCandidates } from './ranking';
import { blockingIssues, planStatus, validatePlan } from './validation';
import type { PartyState } from '../party';

export function buildNegotiationView(
  state: PartyState,
  availability: { available: boolean; reason: string | null },
) {
  const { party, negotiation: session } = state;
  const specs = session ? buildQuerySpecs(party, session.excludedSignals) : [];
  const progress = poolProgress(specs, session);
  const blockers = gatherBlockers(party, specs, {
    available: availability.available,
    unavailableReason: availability.reason,
  });
  const all = session ? rankCandidates(session, party, { includeIneligible: true }) : [];
  const ranked = all.filter((r) => r.eligibility.eligible);
  const setAside = all.filter((r) => !r.eligibility.eligible);

  const recordFor = (id: string) => {
    const spec = specs.find((s) => s.id === id);
    const record = session?.queries[id];
    return spec && record && record.signalsKey === spec.signalsKey ? record : null;
  };
  const failedMemberIds = specs
    .filter((s) => s.kind === 'member' && recordFor(s.id)?.status === 'failed')
    .map((s) => s.memberId!);
  const notRunCount = specs.filter((s) => recordFor(s.id)?.status === 'not_run').length;
  const notes = representationNotes({
    party,
    unrepresentedIds: unrepresentedMembers(party).map((m) => m.id),
    failedMemberIds,
    groupFailed: recordFor('group')?.status === 'failed',
    notRunCount,
  });
  const issues = session ? validatePlan(session, party) : [];
  return {
    session,
    specs,
    progress,
    blockers,
    ranked,
    setAside,
    notes,
    issues,
    blocking: blockingIssues(issues),
    status: session ? planStatus(session, party) : null,
    retryable: progress.failed + progress.notRun,
    recordFor,
  };
}

export type NegotiationView = ReturnType<typeof buildNegotiationView>;
