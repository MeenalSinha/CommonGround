/**
 * Deterministic, explainable ranking. Not a Qloo score, and never shown as a number or a percentage.
 *
 * Method (documented in docs/PHASE_4_IMPLEMENTATION.md):
 * 1. Evidence: Reciprocal Rank Fusion over the distinct recommendation lists that came back OK.
 *    Each list contributes weight / (k + position). Divided by the best possible total, so it lies in (0, 1].
 *    Two queries with identical signals are one list, not two, so duplicates cannot inflate support.
 * 2. Feedback: each person's explicit response is mapped to a value and averaged over the party.
 * 3. Hard constraints are NOT weights. Ineligible candidates are filtered out; ranking cannot override them.
 * 4. Selection (planner.ts) adds a diversity step so results spread across participants.
 *
 * Limitation: "position" is the order Qloo returned. Whether that order means "most relevant first" is not
 * documented in the contract, so it is treated as a weak signal and rank fusion is used for robustness.
 */
import { ranking as cfg } from './config';
import { candidateSources, eligibility, inGroupQuery, surfacingMemberIds } from './pool';
import type {
  CandidateSource,
  Eligibility,
  NegotiationCandidate,
  NegotiationSession,
} from './types';
import type { Party } from '../party';

export interface RankedCandidate {
  candidateId: string;
  /** Internal ordering value only. Never display it; it is not a probability or a Qloo affinity. */
  score: number;
  evidence: number;
  feedbackNet: number;
  sources: CandidateSource[];
  /** Participants whose own interest-driven queries surfaced it. */
  surfacedBy: string[];
  inGroup: boolean;
  bestPosition: number | null;
  eligibility: Eligibility;
}

interface EvidenceList {
  weight: number;
  positions: Map<string, number>;
}

/** Distinct OK lists. Queries with the same signals share one list. */
function evidenceLists(session: NegotiationSession): EvidenceList[] {
  const byKey = new Map<string, EvidenceList>();
  for (const id of Object.keys(session.queries).sort()) {
    const q = session.queries[id];
    if (!q || q.status !== 'ok') continue;
    const weight = q.kind === 'group' ? cfg.groupListWeight : 1;
    const existing = byKey.get(q.signalsKey);
    if (existing) {
      existing.weight = Math.max(existing.weight, weight);
    } else {
      byKey.set(q.signalsKey, {
        weight,
        positions: new Map(q.results.map((r) => [r.entityId, r.position])),
      });
    }
  }
  return [...byKey.values()];
}

export function feedbackNet(candidate: NegotiationCandidate, memberCount: number): number {
  if (memberCount <= 0) return 0;
  let sum = 0;
  for (const kind of Object.values(candidate.feedback)) {
    if (kind === 'interested') sum += cfg.feedbackValue.interested;
    else if (kind === 'unsure') sum += cfg.feedbackValue.unsure;
    else sum += cfg.feedbackValue.pass; // pass and exclude both count against it
  }
  return sum / memberCount;
}

export function rankCandidates(
  session: NegotiationSession,
  party: Party | null,
  opts: { includeIneligible?: boolean } = {},
): RankedCandidate[] {
  const lists = evidenceLists(session);
  const best = lists.reduce((sum, l) => sum + l.weight / (cfg.rrfK + 1), 0);
  const members = party?.members.length ?? 0;

  const ranked: RankedCandidate[] = [];
  for (const id of Object.keys(session.candidates).sort()) {
    const candidate = session.candidates[id]!;
    const elig = eligibility(session, candidate);
    if (!elig.eligible && !opts.includeIneligible) continue;
    let fused = 0;
    for (const list of lists) {
      const pos = list.positions.get(id);
      if (pos !== undefined) fused += list.weight / (cfg.rrfK + pos);
    }
    const evidence = best > 0 ? fused / best : 0;
    const fb = feedbackNet(candidate, members);
    const sources = candidateSources(session, id);
    ranked.push({
      candidateId: id,
      evidence,
      feedbackNet: fb,
      score:
        cfg.evidenceWeight * evidence +
        cfg.feedbackWeight * fb +
        (candidate.manual ? cfg.manualBoost : 0),
      sources,
      surfacedBy: surfacingMemberIds(sources),
      inGroup: inGroupQuery(sources),
      bestPosition: sources.length ? Math.min(...sources.map((s) => s.position)) : null,
      eligibility: elig,
    });
  }
  return ranked.sort((a, b) => compareRanked(a, b, session));
}

/** Total order: score, then breadth across participants, then best position, then name, then id. */
export function compareRanked(
  a: RankedCandidate,
  b: RankedCandidate,
  session: NegotiationSession,
): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.surfacedBy.length !== a.surfacedBy.length) return b.surfacedBy.length - a.surfacedBy.length;
  const pa = a.bestPosition ?? Number.POSITIVE_INFINITY;
  const pb = b.bestPosition ?? Number.POSITIVE_INFINITY;
  if (pa !== pb) return pa - pb;
  const na = session.candidates[a.candidateId]?.entity.name ?? '';
  const nb = session.candidates[b.candidateId]?.entity.name ?? '';
  const byName = na.localeCompare(nb, 'en');
  return byName !== 0
    ? byName
    : a.candidateId < b.candidateId
      ? -1
      : a.candidateId > b.candidateId
        ? 1
        : 0;
}
