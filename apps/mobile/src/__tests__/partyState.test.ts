import {
  MAX_SIGNAL_IDS,
  discoveryBlockers,
  fingerprint,
  groupInterests,
  initialPartyState,
  memberNamesFor,
  partyReducer,
  snapshotSignals,
  validateMemberName,
  validatePartyName,
  type DiscoveryRun,
  type PartyState,
} from '@/state/party';
import { entity, recommendationsPayload, seedParty } from '@/testing/fixtures';

const A = entity('A', 'Alpha');
const B = entity('B', 'Beta', 'urn:entity:movie');

const ready = (
  state = seedParty([
    { name: 'Ann', interests: [A] },
    { name: 'Bo', interests: [B] },
  ]),
) => ({
  party: state.party,
  searchEnabled: true,
  searchReason: null,
  supportedTypes: ['urn:entity:movie'],
  targetType: 'urn:entity:movie',
  signalIds: ['A', 'B'],
});

describe('validation', () => {
  it('trims, collapses whitespace and rejects empty or overlong names', () => {
    expect(validatePartyName('  Movie   night ')).toEqual({ ok: true, value: 'Movie night' });
    expect(validatePartyName('   ').ok).toBe(false);
    expect(validatePartyName('x'.repeat(41)).ok).toBe(false);
  });

  it('rejects duplicate member names case-insensitively', () => {
    const { party } = seedParty([{ name: 'Ann' }]);
    expect(validateMemberName(party, 'ann').ok).toBe(false);
    expect(validateMemberName(party, 'ann', 'm1').ok).toBe(true); // renaming oneself is fine
  });
});

describe('party reducer', () => {
  it('starts empty: no prepopulated party', () => {
    expect(initialPartyState.party).toBeNull();
  });

  it('creates once; a repeated create is ignored', () => {
    const one = partyReducer(initialPartyState, { type: 'party/create', id: 'p1', name: ' Crew ' });
    expect(one.party?.name).toBe('Crew');
    const two = partyReducer(one, { type: 'party/create', id: 'p2', name: 'Other' });
    expect(two).toBe(one);
  });

  it('adds, renames and removes members; empty and duplicate names are no-ops', () => {
    let s = seedParty([]);
    s = partyReducer(s, { type: 'member/add', id: 'a', name: 'Ann' });
    expect(partyReducer(s, { type: 'member/add', id: 'b', name: ' ' })).toBe(s);
    expect(partyReducer(s, { type: 'member/add', id: 'b', name: 'ANN' })).toBe(s);
    s = partyReducer(s, { type: 'member/rename', id: 'a', name: 'Anna' });
    expect(s.party?.members[0]?.displayName).toBe('Anna');
    s = partyReducer(s, { type: 'member/remove', id: 'a' });
    expect(s.party?.members).toHaveLength(0);
  });

  it('keeps entity ids and metadata, and prevents duplicate selection', () => {
    let s = seedParty([{ name: 'Ann' }]);
    s = partyReducer(s, { type: 'interest/add', memberId: 'm1', entity: A });
    const again = partyReducer(s, { type: 'interest/add', memberId: 'm1', entity: A });
    expect(again).toBe(s);
    expect(s.party?.members[0]?.interests[0]).toEqual(A);
  });

  it('removes interests and invalidates stale discovery results', () => {
    let s = partyReducer(seedParty([{ name: 'Ann', interests: [A] }]), {
      type: 'discovery/target',
      targetType: 'urn:entity:movie',
    });
    const run: DiscoveryRun = {
      fingerprint: fingerprint('urn:entity:movie', ['A']),
      targetType: 'urn:entity:movie',
      signals: snapshotSignals(s.party!, ['A']),
      response: recommendationsPayload([]),
    };
    s = partyReducer(s, { type: 'discovery/run', run });
    expect(s.run).not.toBeNull();
    s = partyReducer(s, { type: 'interest/remove', memberId: 'm1', entityId: 'A' });
    expect(s.run).toBeNull();
    expect(groupInterests(s.party)).toHaveLength(0);
  });

  it('clears results when the target category changes or a member is removed', () => {
    let s = seedParty([{ name: 'Ann', interests: [A] }, { name: 'Bo' }]);
    const run: DiscoveryRun = {
      fingerprint: 'x',
      targetType: 'urn:entity:movie',
      signals: [],
      response: recommendationsPayload([]),
    };
    s = partyReducer({ ...s, targetType: 'urn:entity:movie' }, { type: 'discovery/run', run });
    expect(
      partyReducer(s, { type: 'discovery/target', targetType: 'urn:entity:artist' }).run,
    ).toBeNull();
    expect(partyReducer(s, { type: 'member/remove', id: 'm2' }).run).toBeNull();
  });

  it('stores unresolved text separately from resolved interests', () => {
    let s = seedParty([{ name: 'Ann' }]);
    s = partyReducer(s, { type: 'unresolved/add', memberId: 'm1', id: 'u1', text: ' lo-fi ' });
    const member = s.party?.members[0];
    expect(member?.unresolvedInterests).toEqual([{ id: 'u1', text: 'lo-fi' }]);
    expect(member?.interests).toEqual([]);
    expect(groupInterests(s.party)).toEqual([]);
  });
});

describe('group interests and discovery signals', () => {
  it('de-duplicates shared entities but remembers who chose them', () => {
    const s = seedParty([
      { name: 'Ann', interests: [A] },
      { name: 'Bo', interests: [A, B] },
    ]);
    const grouped = groupInterests(s.party);
    expect(grouped.map((g) => g.entity.id)).toEqual(['A', 'B']);
    expect(grouped[0]?.memberIds).toEqual(['m1', 'm2']);
    expect(snapshotSignals(s.party!, ['A'])[0]?.memberIds).toEqual(['m1', 'm2']);
  });

  it('excludes removed participants from signals', () => {
    let s = seedParty([
      { name: 'Ann', interests: [A] },
      { name: 'Bo', interests: [B] },
    ]);
    s = partyReducer(s, { type: 'member/remove', id: 'm2' });
    expect(groupInterests(s.party).map((g) => g.entity.id)).toEqual(['A']);
  });

  it('never counts unresolved text as a signal', () => {
    let s = seedParty([{ name: 'Ann' }, { name: 'Bo' }]);
    s = partyReducer(s, { type: 'unresolved/add', memberId: 'm1', id: 'u', text: 'jazz' });
    expect(groupInterests(s.party)).toEqual([]);
  });

  it('is valid only when every requirement is met', () => {
    expect(discoveryBlockers(ready())).toEqual([]);
  });

  it('blocks: no party, one person, no interests, unavailable Qloo, bad category', () => {
    expect(discoveryBlockers({ ...ready(), party: null })).not.toEqual([]);
    expect(
      discoveryBlockers(ready(seedParty([{ name: 'Ann', interests: [A] }]))).join(' '),
    ).toMatch(/two people/);
    expect(
      discoveryBlockers(ready(seedParty([{ name: 'Ann' }, { name: 'Bo' }]))).join(' '),
    ).toMatch(/at least one interest/i);
    expect(
      discoveryBlockers({ ...ready(), searchEnabled: false, searchReason: 'Qloo is off' }),
    ).toContain('Qloo is off');
    expect(discoveryBlockers({ ...ready(), targetType: 'urn:entity:nope' }).join(' ')).toMatch(
      /not supported/,
    );
    expect(discoveryBlockers({ ...ready(), supportedTypes: null }).join(' ')).toMatch(/not loaded/);
  });

  it('rejects more than the signal limit instead of truncating', () => {
    const ids = Array.from({ length: MAX_SIGNAL_IDS + 2 }, (_, i) => `E${i}`);
    const blockers = discoveryBlockers({ ...ready(), signalIds: ids });
    expect(blockers.join(' ')).toMatch(/Deselect 2/);
  });
});

describe('stale discovery runs (Phase 3 audit repair)', () => {
  const run = (targetType: string, entityId: string, memberIds: string[]): DiscoveryRun => ({
    fingerprint: `${targetType}|${entityId}`,
    targetType,
    signals: [{ entityId, name: 'Alpha', type: null, memberIds }],
    response: recommendationsPayload([]),
  });
  const base = (): PartyState =>
    partyReducer(seedParty([{ name: 'Ann', interests: [A] }, { name: 'Bo' }]), {
      type: 'discovery/target',
      targetType: 'urn:entity:movie',
    });

  it('accepts a run that matches the current category and contributors', () => {
    const s = partyReducer(base(), {
      type: 'discovery/run',
      run: run('urn:entity:movie', 'A', ['m1']),
    });
    expect(s.run).not.toBeNull();
  });

  it('rejects a late run for a category that is no longer selected', () => {
    const s = partyReducer(base(), {
      type: 'discovery/run',
      run: run('urn:entity:book', 'A', ['m1']),
    });
    expect(s.run).toBeNull();
  });

  it('rejects a run whose contributor set no longer matches the party', () => {
    const s = partyReducer(base(), {
      type: 'discovery/run',
      run: run('urn:entity:movie', 'A', ['m1', 'm2']),
    });
    expect(s.run).toBeNull();
  });

  it('rejects a run built from an interest that was removed', () => {
    const removed = partyReducer(base(), {
      type: 'interest/remove',
      memberId: 'm1',
      entityId: 'A',
    });
    const s = partyReducer(removed, {
      type: 'discovery/run',
      run: run('urn:entity:movie', 'A', ['m1']),
    });
    expect(s.run).toBeNull();
  });

  it('keeps contributor names current after a rename', () => {
    const renamed = partyReducer(base(), { type: 'member/rename', id: 'm1', name: 'Annie' });
    const snap = snapshotSignals(renamed.party!, ['A'])[0]!;
    expect(memberNamesFor(renamed.party, snap.memberIds)).toEqual(['Annie']);
  });
});
