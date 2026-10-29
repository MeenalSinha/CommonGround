import { MAX_SIGNAL_IDS } from '@/state/party';
import {
  buildQuerySpecs,
  gatherBlockers,
  poolProgress,
  requestGroups,
  unrepresentedMembers,
} from '@/state/negotiation/queries';
import { candidateSources, eligibility } from '@/state/negotiation/pool';
import { entity, seedParty } from '@/testing/fixtures';
import {
  NOW,
  W,
  X,
  Y,
  Z,
  fail,
  feed,
  feedback,
  send,
  session,
  started,
  threeFriends,
} from '@/testing/negotiationFixtures';

describe('query planning', () => {
  it('makes one query per person with interests plus a group query, using real resolved ids', () => {
    const s = threeFriends();
    const specs = buildQuerySpecs(s.party, {});
    expect(specs.map((q) => q.id)).toEqual(['member:m1', 'member:m2', 'member:m3', 'group']);
    expect(specs[0]!.entityIds).toEqual(['A1']);
    expect(specs[3]!.entityIds).toEqual(['A1', 'B1', 'C1']);
  });

  it('marks people without resolved interests as not represented and never lends them others interests', () => {
    const party = seedParty([
      { name: 'Ann', interests: [entity('A1', 'Alpha')] },
      { name: 'Bo' },
    ]).party;
    expect(buildQuerySpecs(party, {}).map((q) => q.id)).toEqual(['member:m1']); // no group query: only one contributor
    expect(unrepresentedMembers(party).map((m) => m.displayName)).toEqual(['Bo']);
  });

  it('reports an over-limit selection instead of truncating it', () => {
    const many = Array.from({ length: MAX_SIGNAL_IDS + 3 }, (_, i) => entity(`E${i}`, `E${i}`));
    const party = seedParty([
      { name: 'Ann', interests: many },
      { name: 'Bo', interests: [entity('B1', 'B')] },
    ]).party;
    const spec = buildQuerySpecs(party, {}).find((q) => q.id === 'member:m1')!;
    expect(spec.entityIds).toHaveLength(MAX_SIGNAL_IDS + 3); // nothing dropped
    expect(spec.overLimitBy).toBe(3);
    expect(requestGroups([spec])).toHaveLength(0); // cannot be sent as is
    const blockers = gatherBlockers(party, [spec], { available: true, unavailableReason: null });
    expect(blockers.join(' ')).toMatch(/Deselect 3 for Ann/);
    // Deselecting 3 makes it runnable.
    const excluded = { m1: many.slice(0, 3).map((e) => e.id) };
    expect(buildQuerySpecs(party, excluded).find((q) => q.id === 'member:m1')!.overLimitBy).toBe(0);
  });

  it('sends one HTTP request when two queries have identical signals', () => {
    const shared = entity('S', 'Shared');
    const party = seedParty([
      { name: 'Ann', interests: [shared] },
      { name: 'Bo', interests: [shared] },
    ]).party;
    const specs = buildQuerySpecs(party, {});
    expect(specs).toHaveLength(3); // m1, m2, group
    expect(requestGroups(specs)).toHaveLength(1);
    expect(requestGroups(specs)[0]!.specs).toHaveLength(3);
  });

  it('blocks when Qloo is unavailable and says why', () => {
    const s = threeFriends();
    const b = gatherBlockers(s.party, buildQuerySpecs(s.party, {}), {
      available: false,
      unavailableReason: 'No key.',
    });
    expect(b).toEqual(['No key.']);
  });
});

describe('candidate merging and provenance', () => {
  it('deduplicates by Qloo id across queries and keeps every source with its position', () => {
    const s = threeFriends();
    const ids = Object.keys(session(s).candidates).sort();
    expect(ids).toEqual(['Q', 'W', 'X', 'Y', 'Z']); // 5 unique from 10 returned rows
    const y = candidateSources(session(s), 'Y');
    expect(y.map((x) => [x.queryId, x.position])).toEqual([
      ['group', 1],
      ['member:m1', 2],
      ['member:m2', 1],
      ['member:m3', 2],
    ]);
  });

  it('distinguishes surfacing from liking: no feedback is created by a query', () => {
    const s = threeFriends();
    expect(session(s).candidates.Y!.feedback).toEqual({});
  });

  it('a retry replaces the query record and never duplicates candidates or sources', () => {
    let s = threeFriends();
    s = feed(s, 'member:m1', [X, Y, Z]);
    s = feed(s, 'member:m1', [X, Y, Z]);
    expect(candidateSources(session(s), 'X').filter((x) => x.queryId === 'member:m1')).toHaveLength(
      1,
    );
    expect(Object.keys(session(s).candidates)).toHaveLength(5);
  });

  it('drops candidates that only the old results surfaced when a retry returns different items', () => {
    let s = threeFriends();
    s = feed(s, 'member:m3', [Y]); // Q no longer surfaced anywhere
    expect(session(s).candidates.Q).toBeUndefined();
  });

  it('keeps successes after a partial failure and records the failure as failed, not empty', () => {
    let s = threeFriends();
    s = fail(s, 'member:m3');
    expect(session(s).queries['member:m3']!.status).toBe('failed');
    expect(session(s).queries['member:m3']!.error?.code).toBe('qloo_rate_limited');
    expect(session(s).queries['member:m1']!.status).toBe('ok');
    expect(session(s).candidates.X).toBeDefined();
    const specs = buildQuerySpecs(s.party, {});
    expect(poolProgress(specs, session(s))).toMatchObject({ ok: 3, failed: 1, empty: 0 });
  });

  it('records a genuinely empty result as empty, distinct from a failure', () => {
    let s = threeFriends();
    s = feed(s, 'member:m3', []);
    expect(session(s).queries['member:m3']!.status).toBe('empty');
    expect(poolProgress(buildQuerySpecs(s.party, {}), session(s))).toMatchObject({
      empty: 1,
      failed: 0,
    });
  });

  it('ignores a late result whose signals no longer match, or whose category changed', () => {
    let s = threeFriends();
    const before = s;
    s = send(s, {
      type: 'negotiation/queryResult',
      queryIds: ['member:m1'],
      signalsKey: 'OLD',
      targetType: 'urn:entity:movie',
      outcome: { status: 'ok', items: [W], provenance: session(s).queries['group']!.provenance! },
      now: NOW,
    });
    expect(s).toBe(before);
    s = send(s, {
      type: 'negotiation/queryResult',
      queryIds: ['member:m1'],
      signalsKey: 'A1',
      targetType: 'urn:entity:book',
      outcome: { status: 'empty', items: [], provenance: session(s).queries['group']!.provenance! },
      now: NOW,
    });
    expect(s).toBe(before);
  });

  it('stores nothing from a failed query as a candidate', () => {
    let s = started([
      { name: 'Ann', interests: [entity('A1', 'A')] },
      { name: 'Bo', interests: [entity('B1', 'B')] },
    ]);
    s = fail(s, 'member:m1');
    expect(session(s).candidates).toEqual({});
  });
});

describe('invalidation (reconcile)', () => {
  it('removing a participant drops their query, their feedback and candidates only they surfaced', () => {
    let s = threeFriends();
    s = feedback(s, 'Y', 'm3', 'interested');
    s = send(s, { type: 'member/remove', id: 'm3' });
    expect(session(s).queries['member:m3']).toBeUndefined();
    expect(session(s).candidates.Q).toBeUndefined();
    expect(session(s).candidates.Y!.feedback).toEqual({});
  });

  it('removing an interest invalidates only that person’s query and keeps unrelated feedback', () => {
    let s = threeFriends();
    s = feedback(s, 'X', 'm1', 'interested');
    s = send(s, { type: 'interest/remove', memberId: 'm3', entityId: 'C1' });
    expect(session(s).queries['member:m3']).toBeUndefined();
    expect(session(s).queries['member:m1']).toBeDefined();
    expect(session(s).queries['group']).toBeUndefined(); // its signals changed too
    expect(session(s).candidates.X!.feedback.m1).toBe('interested');
  });

  it('changing the category clears the pool and plan but keeps the group constraints and length', () => {
    let s = threeFriends();
    s = send(
      s,
      { type: 'negotiation/constraint', patch: { budgetMax: 50 }, now: NOW },
      { type: 'negotiation/planLength', length: 4, now: NOW },
      { type: 'negotiation/excludeTag', tag: { id: 't', name: 'Horror' }, now: NOW },
    );
    s = send(s, { type: 'discovery/target', targetType: 'urn:entity:book' });
    const n = session(s);
    expect(n.targetType).toBe('urn:entity:book');
    expect(n.candidates).toEqual({});
    expect(n.queries).toEqual({});
    expect(n.plan).toBeNull();
    expect(n.constraints.budgetMax).toBe(50);
    expect(n.constraints.excludedTags).toHaveLength(1);
    expect(n.planLength).toBe(4);
  });

  it('is unchanged (same object) when nothing relevant changed', () => {
    const s = threeFriends();
    const s2 = send(s, { type: 'party/rename', name: 'Renamed' });
    expect(s2.negotiation).toBe(s.negotiation);
  });

  it('removing the party discards the session', () => {
    const s = send(threeFriends(), { type: 'party/reset' });
    expect(s.negotiation).toBeNull();
  });
});

describe('session lifecycle', () => {
  it('starting twice keeps the first session (a restored session is never replaced)', () => {
    const s = threeFriends();
    const again = send(s, { type: 'negotiation/start', id: 'other', now: NOW });
    expect(again).toBe(s);
    expect(session(again).id).toBe('s1');
  });
  it('does not start without a category or a party', () => {
    const noTarget = seedParty([{ name: 'Ann' }]);
    expect(send(noTarget, { type: 'negotiation/start', id: 'x', now: NOW }).negotiation).toBeNull();
  });
  it('reset clears the session but keeps the party', () => {
    const s = send(threeFriends(), { type: 'negotiation/reset' });
    expect(s.negotiation).toBeNull();
    expect(s.party?.members).toHaveLength(3);
  });
});

describe('eligibility', () => {
  it('a pass or unsure is not a hard exclusion; an explicit exclude is', () => {
    let s = threeFriends();
    s = feedback(s, 'X', 'm1', 'pass');
    s = feedback(s, 'X', 'm2', 'unsure');
    expect(eligibility(session(s), session(s).candidates.X!).eligible).toBe(true);
    s = feedback(s, 'X', 'm3', 'exclude');
    const e = eligibility(session(s), session(s).candidates.X!);
    expect(e.eligible).toBe(false);
  });
  it('excluded tags exclude by real tag id', () => {
    let s = started([
      { name: 'Ann', interests: [entity('A1', 'A')] },
      { name: 'Bo', interests: [entity('B1', 'B')] },
    ]);
    s = feed(s, 'member:m1', [
      { ...W, tags: [{ id: 'tag:horror', name: 'Horror', type: null }] },
      Z,
    ]);
    s = send(s, {
      type: 'negotiation/excludeTag',
      tag: { id: 'tag:horror', name: 'Horror' },
      now: NOW,
    });
    expect(eligibility(session(s), session(s).candidates.W!).eligible).toBe(false);
    expect(eligibility(session(s), session(s).candidates.Z!).eligible).toBe(true);
  });
  it('a manual add must match the category and is marked manual', () => {
    let s = threeFriends();
    s = send(s, {
      type: 'negotiation/addManual',
      entity: { ...W, type: 'urn:entity:book' },
      now: NOW,
    });
    expect(session(s).lastOutcome).toMatchObject({ ok: false, code: 'not_eligible' });
    const m = movieByName('Manual Pick');
    s = send(s, { type: 'negotiation/addManual', entity: m, now: NOW });
    expect(session(s).candidates[m.id]!.manual).toBe(true);
    expect(candidateSources(session(s), m.id)).toEqual([]);
  });
});

function movieByName(name: string) {
  return { ...entity('MAN', name, 'urn:entity:movie') };
}
void Y;
