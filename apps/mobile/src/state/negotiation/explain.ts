/**
 * Human-readable explanations. Each sentence is built from real evidence (query provenance, explicit
 * feedback, recorded constraints). Wording is deliberately precise: a recommendation surfaced from
 * someone's interests is NOT described as something they like.
 */
import type { Party } from '../party';
import type { RankedCandidate } from './ranking';
import type { EligibilityReason, FeedbackKind, NegotiationCandidate } from './types';

export function nameList(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function namesFor(party: Party | null, ids: string[]): string[] {
  return ids
    .map((id) => party?.members.find((m) => m.id === id)?.displayName)
    .filter((n): n is string => Boolean(n));
}

const possessive = (name: string) => `${name}’s`;

export const FEEDBACK_LABELS: Record<FeedbackKind, string> = {
  interested: 'Interested',
  unsure: 'Unsure',
  pass: 'Prefer to pass',
  exclude: 'Hard exclusion',
};

function feedbackIds(candidate: NegotiationCandidate, kind: FeedbackKind): string[] {
  return Object.keys(candidate.feedback)
    .filter((id) => candidate.feedback[id] === kind)
    .sort();
}

/** Why a candidate is on the shortlist or in the plan, from evidence only. */
export function explainCandidate(
  ranked: RankedCandidate,
  candidate: NegotiationCandidate,
  party: Party | null,
): string[] {
  const lines: string[] = [];
  const surfaced = namesFor(party, ranked.surfacedBy);
  if (surfaced.length === 1) {
    lines.push(`Surfaced from ${possessive(surfaced[0]!)} selected interests.`);
  } else if (surfaced.length > 1) {
    lines.push(
      `Appeared in recommendation lists built from interests selected by ${surfaced.length} participants (${nameList(surfaced)}).`,
    );
  }
  if (ranked.inGroup) lines.push('Also returned by the group-level discovery query.');
  if (candidate.manual) lines.push('Added by hand from a Qloo search result.');

  const interested = namesFor(party, feedbackIds(candidate, 'interested'));
  const unsure = namesFor(party, feedbackIds(candidate, 'unsure'));
  const passed = namesFor(party, feedbackIds(candidate, 'pass'));
  if (interested.length) lines.push(`${nameList(interested)} marked interested.`);
  if (unsure.length)
    lines.push(`${nameList(unsure)} ${unsure.length === 1 ? 'is' : 'are'} unsure.`);
  if (passed.length) lines.push(`${nameList(passed)} would rather pass.`);
  if (interested.length && passed.length) {
    lines.push('Mixed feedback: the group has not agreed on this one.');
  }
  if (ranked.eligibility.eligible) lines.push('No participant has explicitly excluded it.');
  return lines;
}

export function describeIneligible(reasons: EligibilityReason[], party: Party | null): string[] {
  return reasons.map((r) => {
    switch (r.code) {
      case 'member_exclusion': {
        const who = namesFor(party, [r.memberId])[0];
        return who
          ? `${who} marked this as a hard exclusion, so it has been removed from the plan.`
          : 'A participant marked this as a hard exclusion, so it has been removed from the plan.';
      }
      case 'group_exclusion':
        return 'The organizer excluded this for the whole group.';
      case 'excluded_tag':
        return `It carries the tag “${r.tag.name ?? r.tag.id}”, which the group excluded.`;
      case 'rejected':
        return 'The group passed on this suggestion.';
      case 'wrong_category':
        return 'It does not match the category being planned.';
    }
  });
}

/** Honest notes about whose interests the pool actually reflects. */
export function representationNotes(args: {
  party: Party | null;
  unrepresentedIds: string[];
  failedMemberIds: string[];
  groupFailed: boolean;
  notRunCount: number;
}): string[] {
  const notes: string[] = [];
  const none = namesFor(args.party, args.unrepresentedIds);
  if (none.length) {
    notes.push(
      `${nameList(none)} ${none.length === 1 ? 'has' : 'have'} no Qloo interests yet, so the group is not fully considered. Add interests to their profile${none.length === 1 ? '' : 's'}.`,
    );
  }
  const failed = namesFor(args.party, args.failedMemberIds);
  if (failed.length) {
    notes.push(
      `The request for ${nameList(failed)} failed, so the candidates below do not represent ${failed.length === 1 ? 'that person' : 'those people'} equally. Retry to include them.`,
    );
  }
  if (args.groupFailed) notes.push('The group-level request failed. Retry to include it.');
  if (args.notRunCount > 0) {
    notes.push(
      `${args.notRunCount} request${args.notRunCount === 1 ? ' was' : 's were'} not sent after an earlier problem. Retry to send them.`,
    );
  }
  return notes;
}
