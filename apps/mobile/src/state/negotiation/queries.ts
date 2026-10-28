/**
 * Decides which recommendation requests the party's current inputs call for. Pure: no network, no React.
 * Rules: one query per participant with resolved interests, plus one group-level query when enough people
 * contribute. A query over the 20-id limit is never truncated; it is reported as needing a smaller selection.
 */
import type { Entity } from '@/types/api';
import { discovery, MAX_SIGNAL_IDS } from './config';
import type { NegotiationSession, QueryKind } from './types';
import type { Party, PartyMember } from '../party';

export const GROUP_SCOPE = 'group';

export interface QuerySpec {
  id: string;
  kind: QueryKind;
  memberId: string | null;
  /** Interests that would be sent, sorted by id. */
  entityIds: string[];
  signalsKey: string;
  /** Interests selected for this scope, for display. */
  interests: Entity[];
  /** Greater than 0 means the selection exceeds the request limit; the query cannot run as is. */
  overLimitBy: number;
}

export interface MemberCoverage {
  member: PartyMember;
  /** True when this person has at least one resolved interest to contribute. */
  hasResolvedInterests: boolean;
}

export const memberQueryId = (memberId: string) => `member:${memberId}`;
export const GROUP_QUERY_ID = 'group';

export function signalsKeyOf(ids: string[]): string {
  return [...new Set(ids)].sort().join(',');
}

function selected(interests: Entity[], excluded: string[] | undefined): Entity[] {
  const skip = new Set(excluded ?? []);
  return interests.filter((i) => !skip.has(i.id));
}

function makeSpec(
  id: string,
  kind: QueryKind,
  memberId: string | null,
  interests: Entity[],
): QuerySpec {
  const unique = [...new Map(interests.map((i) => [i.id, i])).values()];
  const entityIds = unique.map((i) => i.id).sort();
  return {
    id,
    kind,
    memberId,
    entityIds,
    signalsKey: signalsKeyOf(entityIds),
    interests: unique,
    overLimitBy: Math.max(0, entityIds.length - MAX_SIGNAL_IDS),
  };
}

/** Every request the current party and selection call for (including ones too large to run). */
export function buildQuerySpecs(
  party: Party | null,
  excludedSignals: NegotiationSession['excludedSignals'],
): QuerySpec[] {
  if (!party) return [];
  const specs: QuerySpec[] = [];
  const groupPool = new Map<string, Entity>();
  const groupContributors = new Set<string>();
  const groupExcluded = new Set(excludedSignals[GROUP_SCOPE] ?? []);

  for (const member of party.members) {
    const chosen = selected(member.interests, excludedSignals[member.id]);
    if (chosen.length >= discovery.minMemberSignals) {
      specs.push(makeSpec(memberQueryId(member.id), 'member', member.id, chosen));
    }
    for (const interest of member.interests) {
      if (groupExcluded.has(interest.id)) continue;
      groupPool.set(interest.id, interest);
      groupContributors.add(member.id);
    }
  }
  if (groupContributors.size >= discovery.minGroupContributors) {
    specs.push(makeSpec(GROUP_QUERY_ID, 'group', null, [...groupPool.values()]));
  }
  return specs;
}

/** People with no resolved interests: they are NOT represented in discovery and must never borrow others'. */
export function unrepresentedMembers(party: Party | null): PartyMember[] {
  return (party?.members ?? []).filter((m) => m.interests.length === 0);
}

/** One real HTTP request can serve several specs when their signals are identical. */
export interface RequestGroup {
  signalsKey: string;
  entityIds: string[];
  specs: QuerySpec[];
}

export function requestGroups(specs: QuerySpec[]): RequestGroup[] {
  const byKey = new Map<string, RequestGroup>();
  for (const spec of specs) {
    if (spec.overLimitBy > 0) continue;
    const existing = byKey.get(spec.signalsKey);
    if (existing) existing.specs.push(spec);
    else
      byKey.set(spec.signalsKey, {
        signalsKey: spec.signalsKey,
        entityIds: spec.entityIds,
        specs: [spec],
      });
  }
  return [...byKey.values()];
}

/** A short, stable description of the inputs behind the pool. */
export function poolFingerprint(targetType: string, specs: QuerySpec[]): string {
  const parts = specs
    .filter((s) => s.overLimitBy === 0)
    .map((s) => `${s.id}=${s.signalsKey}`)
    .sort();
  return `${targetType}|${parts.join(';')}`;
}

export type PoolProgress = {
  ok: number;
  empty: number;
  failed: number;
  notRun: number;
  /** Specs with no record yet. */
  waiting: number;
  overLimit: number;
};

/** Where each current query stands, matched against its stored record by id and signals. */
export function poolProgress(specs: QuerySpec[], session: NegotiationSession | null): PoolProgress {
  const progress: PoolProgress = {
    ok: 0,
    empty: 0,
    failed: 0,
    notRun: 0,
    waiting: 0,
    overLimit: 0,
  };
  for (const spec of specs) {
    if (spec.overLimitBy > 0) {
      progress.overLimit += 1;
      continue;
    }
    const record = session?.queries[spec.id];
    if (!record || record.signalsKey !== spec.signalsKey) progress.waiting += 1;
    else if (record.status === 'ok') progress.ok += 1;
    else if (record.status === 'empty') progress.empty += 1;
    else if (record.status === 'failed') progress.failed += 1;
    else progress.notRun += 1;
  }
  return progress;
}

/** Reasons candidate gathering cannot start. Empty means it can. */
export function gatherBlockers(
  party: Party | null,
  specs: QuerySpec[],
  opts: { available: boolean; unavailableReason: string | null },
): string[] {
  if (!party) return ['Create a party first.'];
  const blockers: string[] = [];
  if (party.members.length < 2) blockers.push('Add at least two people to the party.');
  if (specs.length === 0) {
    blockers.push('Add at least one interest found through Qloo to someone’s profile.');
  }
  for (const spec of specs) {
    if (spec.overLimitBy > 0) {
      const who =
        spec.kind === 'group'
          ? 'the group list'
          : (party.members.find((m) => m.id === spec.memberId)?.displayName ?? 'someone');
      blockers.push(
        `Qloo accepts up to ${MAX_SIGNAL_IDS} interests per request. Deselect ${spec.overLimitBy} for ${who}.`,
      );
    }
  }
  if (!opts.available) blockers.push(opts.unavailableReason ?? 'Qloo is not available right now.');
  return blockers;
}
