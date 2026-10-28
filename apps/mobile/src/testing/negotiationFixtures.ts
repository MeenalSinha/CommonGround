/** Test-only helpers for the negotiation engine. Fixtures never reach production code. */
import { buildQuerySpecs } from '@/state/negotiation/queries';
import type { NegotiationSession } from '@/state/negotiation/types';
import type { AppAction } from '@/state/store';
import { rootReducer } from '@/state/store';
import type { PartyState } from '@/state/party';
import type { Entity } from '@/types/api';
import { entity, recommendationsPayload, seedParty, type SeedMember } from './fixtures';

export const TARGET = 'urn:entity:movie';
export const NOW = '2026-01-01T00:00:00.000Z';

export const movie = (id: string, name: string, tags: Entity['tags'] = []): Entity => ({
  ...entity(id, name, TARGET),
  tags,
});

export const send = (state: PartyState, ...actions: AppAction[]): PartyState =>
  actions.reduce((s, a) => rootReducer(s, a, () => NOW), state);

export const session = (state: PartyState): NegotiationSession => {
  if (!state.negotiation) throw new Error('no session');
  return state.negotiation;
};

/** Party plus a started negotiation session for the movie category. */
export function started(members: SeedMember[]): PartyState {
  const base = seedParty(members);
  return send(
    base,
    { type: 'discovery/target', targetType: TARGET },
    { type: 'negotiation/start', id: 's1', now: NOW },
  );
}

/** Feeds a successful response into the query with this id, using that query's real current signals. */
export function feed(state: PartyState, queryId: string, items: Entity[]): PartyState {
  const spec = buildQuerySpecs(state.party, session(state).excludedSignals).find(
    (s) => s.id === queryId,
  );
  if (!spec) throw new Error(`no spec ${queryId}`);
  const payload = recommendationsPayload(items);
  return send(state, {
    type: 'negotiation/queryResult',
    queryIds: [queryId],
    signalsKey: spec.signalsKey,
    targetType: TARGET,
    outcome: { status: items.length ? 'ok' : 'empty', items, provenance: payload.provenance },
    now: NOW,
  });
}

export const fail = (state: PartyState, queryId: string): PartyState => {
  const spec = buildQuerySpecs(state.party, session(state).excludedSignals).find(
    (s) => s.id === queryId,
  )!;
  return send(state, {
    type: 'negotiation/queryResult',
    queryIds: [queryId],
    signalsKey: spec.signalsKey,
    targetType: TARGET,
    outcome: { status: 'failed', error: { code: 'qloo_rate_limited', message: 'Slow down.' } },
    now: NOW,
  });
};

export const X = movie('X', 'Xenon');
export const Y = movie('Y', 'Yonder');
export const Z = movie('Z', 'Zephyr');
export const W = movie('W', 'Willow');
export const Q = movie('Q', 'Quill');

/** Ann, Bo, Cy each with one interest; Ann and Bo overlap on Y, Cy alone has Q. */
export function threeFriends(): PartyState {
  let s = started([
    { name: 'Ann', interests: [entity('A1', 'Alpha')] },
    { name: 'Bo', interests: [entity('B1', 'Bravo')] },
    { name: 'Cy', interests: [entity('C1', 'Charlie')] },
  ]);
  s = feed(s, 'member:m1', [X, Y, Z]);
  s = feed(s, 'member:m2', [Y, W, X]);
  s = feed(s, 'member:m3', [Q, Y]);
  s = feed(s, 'group', [Y, X]);
  return s;
}

export const plan = (s: PartyState) => session(s).plan;
export const planIds = (s: PartyState) => plan(s)?.entries.map((e) => e.candidateId) ?? [];
export const gen = (s: PartyState, alternative = false, id = 'plan1') =>
  send(s, { type: 'plan/generate', planId: id, alternative, now: NOW });
export const setLength = (s: PartyState, length: number) =>
  send(s, { type: 'negotiation/planLength', length, now: NOW });
export const feedback = (
  s: PartyState,
  c: string,
  m: string,
  kind: 'interested' | 'unsure' | 'pass' | 'exclude' | null,
) => send(s, { type: 'negotiation/feedback', candidateId: c, memberId: m, kind, now: NOW });
