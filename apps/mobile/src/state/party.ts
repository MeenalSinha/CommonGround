/**
 * Pure party model: types, validation, reducer and selectors. No React, no network.
 * Everything here is derived from user input or from entities the backend returned.
 */
import type { Entity, RecommendationsResponse } from '@/types/api';
import type { NegotiationSession } from './negotiation/types';

/** Mirrors the backend contract (docs/API_CONTRACT.md): at most 20 entity ids per request. */
export const MAX_SIGNAL_IDS = 20;
export const NAME_MAX_LENGTH = 40;
export const UNRESOLVED_MAX_LENGTH = 60;
/** Avatar colors are keys into the theme palette, assigned by join order. */
export const AVATAR_COLORS = ['sky', 'mint', 'lavender', 'yellow', 'coral'] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

/** Text the user typed that has NOT been resolved to a Qloo entity. Never sent as an entity id. */
export interface UnresolvedInterest {
  id: string;
  text: string;
}

export interface PartyMember {
  id: string;
  displayName: string;
  avatarColor: AvatarColor;
  /** Resolved entities exactly as returned by the backend (Qloo id preserved). */
  interests: Entity[];
  unresolvedInterests: UnresolvedInterest[];
}

export interface Party {
  id: string;
  name: string;
  members: PartyMember[];
}

export interface SignalSnapshot {
  entityId: string;
  name: string;
  type: string | null;
  /** Who contributed this interest, by id. Names are resolved live so a rename cannot go stale. */
  memberIds: string[];
}

/** One completed recommendation request, with the inputs that produced it. */
export interface DiscoveryRun {
  fingerprint: string;
  targetType: string;
  signals: SignalSnapshot[];
  response: RecommendationsResponse;
}

export interface PartyState {
  party: Party | null;
  targetType: string | null;
  run: DiscoveryRun | null;
  /** Phase 4: the group's negotiation and plan. Reconciled with the party by `store.ts`. */
  negotiation: NegotiationSession | null;
}

export const initialPartyState: PartyState = {
  party: null,
  targetType: null,
  run: null,
  negotiation: null,
};

export type PartyAction =
  | { type: 'party/create'; id: string; name: string }
  | { type: 'party/rename'; name: string }
  | { type: 'party/reset' }
  | { type: 'member/add'; id: string; name: string }
  | { type: 'member/rename'; id: string; name: string }
  | { type: 'member/remove'; id: string }
  | { type: 'interest/add'; memberId: string; entity: Entity }
  | { type: 'interest/remove'; memberId: string; entityId: string }
  | { type: 'unresolved/add'; memberId: string; id: string; text: string }
  | { type: 'unresolved/remove'; memberId: string; id: string }
  | { type: 'discovery/target'; targetType: string | null }
  | { type: 'discovery/run'; run: DiscoveryRun };

export type Validation<T = string> = { ok: true; value: T } | { ok: false; error: string };

let counter = 0;
export function makeId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}${counter}`;
}

function cleanText(raw: string, max: number, what: string): Validation {
  const value = raw.replace(/\s+/g, ' ').trim();
  if (!value) return { ok: false, error: `Please enter ${what}.` };
  if (value.length > max) return { ok: false, error: `Keep it to ${max} characters or fewer.` };
  return { ok: true, value };
}

export function validatePartyName(raw: string): Validation {
  return cleanText(raw, NAME_MAX_LENGTH, 'a party name');
}

/** Names must be unique within a party (case-insensitive) so people are distinguishable. */
export function validateMemberName(
  party: Party | null,
  raw: string,
  exceptId?: string,
): Validation {
  const result = cleanText(raw, NAME_MAX_LENGTH, 'a name');
  if (!result.ok || !party) return result;
  const taken = party.members.some(
    (m) => m.id !== exceptId && m.displayName.toLowerCase() === result.value.toLowerCase(),
  );
  return taken ? { ok: false, error: 'Someone in the party already has that name.' } : result;
}

export function validateUnresolvedText(raw: string): Validation {
  return cleanText(raw, UNRESOLVED_MAX_LENGTH, 'an interest');
}

function withMember(
  party: Party,
  memberId: string,
  update: (m: PartyMember) => PartyMember,
): Party | null {
  const index = party.members.findIndex((m) => m.id === memberId);
  const current = party.members[index];
  if (!current) return null;
  const members = party.members.slice();
  members[index] = update(current);
  return { ...party, members };
}

export function partyReducer(state: PartyState, action: PartyAction): PartyState {
  const { party } = state;
  switch (action.type) {
    case 'party/create': {
      const name = validatePartyName(action.name);
      if (party || !name.ok) return state;
      return { ...initialPartyState, party: { id: action.id, name: name.value, members: [] } };
    }
    case 'party/rename': {
      const name = validatePartyName(action.name);
      if (!party || !name.ok) return state;
      return { ...state, party: { ...party, name: name.value } };
    }
    case 'party/reset':
      return initialPartyState;
    case 'member/add': {
      const name = validateMemberName(party, action.name);
      if (!party || !name.ok) return state;
      const color = AVATAR_COLORS[party.members.length % AVATAR_COLORS.length] ?? 'sky';
      const member: PartyMember = {
        id: action.id,
        displayName: name.value,
        avatarColor: color,
        interests: [],
        unresolvedInterests: [],
      };
      return { ...state, party: { ...party, members: [...party.members, member] } };
    }
    case 'member/rename': {
      const name = validateMemberName(party, action.name, action.id);
      if (!party || !name.ok) return state;
      const next = withMember(party, action.id, (m) => ({ ...m, displayName: name.value }));
      return next ? { ...state, party: next } : state;
    }
    case 'member/remove': {
      if (!party || !party.members.some((m) => m.id === action.id)) return state;
      const members = party.members.filter((m) => m.id !== action.id);
      return { ...state, party: { ...party, members }, run: null };
    }
    case 'interest/add': {
      if (!party) return state;
      const next = withMember(party, action.memberId, (m) =>
        m.interests.some((i) => i.id === action.entity.id)
          ? m
          : { ...m, interests: [...m.interests, action.entity] },
      );
      if (!next || next === party) return state;
      const changed = next.members !== party.members && !sameInterests(party, next);
      return changed ? { ...state, party: next, run: null } : state;
    }
    case 'interest/remove': {
      if (!party) return state;
      const next = withMember(party, action.memberId, (m) => ({
        ...m,
        interests: m.interests.filter((i) => i.id !== action.entityId),
      }));
      if (!next || sameInterests(party, next)) return state;
      return { ...state, party: next, run: null };
    }
    case 'unresolved/add': {
      const text = validateUnresolvedText(action.text);
      if (!party || !text.ok) return state;
      const next = withMember(party, action.memberId, (m) =>
        m.unresolvedInterests.some((u) => u.text.toLowerCase() === text.value.toLowerCase())
          ? m
          : {
              ...m,
              unresolvedInterests: [...m.unresolvedInterests, { id: action.id, text: text.value }],
            },
      );
      return next ? { ...state, party: next } : state;
    }
    case 'unresolved/remove': {
      if (!party) return state;
      const next = withMember(party, action.memberId, (m) => ({
        ...m,
        unresolvedInterests: m.unresolvedInterests.filter((u) => u.id !== action.id),
      }));
      return next ? { ...state, party: next } : state;
    }
    case 'discovery/target':
      if (state.targetType === action.targetType) return state;
      return { ...state, targetType: action.targetType, run: null };
    case 'discovery/run':
      // A late response must not overwrite state it was not built from (defect repaired in Phase 4 audit).
      return runIsCurrent(state, action.run) ? { ...state, run: action.run } : state;
  }
}

/** A run is accepted only for the current category and only if every signal is still in the party. */
export function runIsCurrent(state: PartyState, run: DiscoveryRun): boolean {
  if (!state.party || state.targetType !== run.targetType) return false;
  const current = new Map(groupInterests(state.party).map((g) => [g.entity.id, g.memberIds]));
  return run.signals.every((s) => {
    const ids = current.get(s.entityId);
    return (
      ids !== undefined &&
      ids.length === s.memberIds.length &&
      ids.every((id) => s.memberIds.includes(id))
    );
  });
}

function sameInterests(a: Party, b: Party): boolean {
  const ids = (p: Party) => p.members.map((m) => m.interests.map((i) => i.id).join(',')).join('|');
  return ids(a) === ids(b);
}

// ---- selectors ----------------------------------------------------------------------------

export interface GroupInterest {
  entity: Entity;
  memberIds: string[];
}

/** Unique resolved entities across the party, keeping who selected each (by Qloo id). */
export function groupInterests(party: Party | null): GroupInterest[] {
  const byId = new Map<string, GroupInterest>();
  for (const member of party?.members ?? []) {
    for (const entity of member.interests) {
      const existing = byId.get(entity.id);
      if (existing) existing.memberIds.push(member.id);
      else byId.set(entity.id, { entity, memberIds: [member.id] });
    }
  }
  return [...byId.values()];
}

export function totalInterestCount(party: Party | null): number {
  return (party?.members ?? []).reduce((n, m) => n + m.interests.length, 0);
}

export function fingerprint(targetType: string, entityIds: string[]): string {
  return `${targetType}|${[...entityIds].sort().join(',')}`;
}

export function snapshotSignals(party: Party, entityIds: string[]): SignalSnapshot[] {
  const wanted = new Set(entityIds);
  return groupInterests(party)
    .filter((g) => wanted.has(g.entity.id))
    .map((g) => ({
      entityId: g.entity.id,
      name: g.entity.name,
      type: g.entity.type,
      memberIds: [...g.memberIds],
    }));
}

/** Resolves member ids to their current display names, skipping anyone no longer in the party. */
export function memberNamesFor(party: Party | null, memberIds: string[]): string[] {
  return memberIds
    .map((id) => party?.members.find((m) => m.id === id)?.displayName)
    .filter((n): n is string => Boolean(n));
}

export interface DiscoveryInputs {
  party: Party | null;
  searchEnabled: boolean;
  searchReason: string | null;
  supportedTypes: string[] | null;
  targetType: string | null;
  signalIds: string[];
}

/** Every reason a discovery request must not be sent. Empty means the request is valid. */
export function discoveryBlockers(input: DiscoveryInputs): string[] {
  const blockers: string[] = [];
  const { party } = input;
  if (!party) return ['Create a party first.'];
  if (party.members.length < 2) blockers.push('Add at least two people to the party.');
  if (groupInterests(party).length === 0) {
    blockers.push('Add at least one interest found through Qloo to a profile.');
  }
  if (!input.searchEnabled) {
    blockers.push(input.searchReason ?? 'Qloo is not available right now.');
  }
  if (input.supportedTypes === null) blockers.push('Categories have not loaded yet.');
  else if (input.targetType === null) blockers.push('Choose what to discover.');
  else if (!input.supportedTypes.includes(input.targetType)) {
    blockers.push('That category is not supported.');
  }
  if (input.signalIds.length === 0 && groupInterests(party).length > 0) {
    blockers.push('Select at least one interest to use.');
  }
  if (input.signalIds.length > MAX_SIGNAL_IDS) {
    const extra = input.signalIds.length - MAX_SIGNAL_IDS;
    blockers.push(`Qloo accepts up to ${MAX_SIGNAL_IDS} interests per request. Deselect ${extra}.`);
  }
  return blockers;
}
