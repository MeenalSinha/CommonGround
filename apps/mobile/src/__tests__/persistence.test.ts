import AsyncStorage from '@react-native-async-storage/async-storage';
import { asyncStorageAdapter } from '@/state/asyncStorageAdapter';
import { persistence as cfg } from '@/state/negotiation/config';
import {
  createPersistor,
  loadSession,
  memoryStorage,
  pickPersisted,
  restore,
  serialize,
  type SessionStorage,
} from '@/state/persistence';
import {
  NOW,
  feedback,
  gen,
  plan,
  planIds,
  send,
  session,
  threeFriends,
} from '@/testing/negotiationFixtures';

const richState = () => {
  let s = gen(threeFriends());
  s = feedback(s, 'Y', 'm1', 'interested');
  s = feedback(s, 'Z', 'm2', 'pass');
  s = send(
    s,
    { type: 'negotiation/constraint', patch: { budgetMax: 80 }, now: NOW },
    {
      type: 'negotiation/details',
      candidateId: 'Y',
      patch: { cost: 20, note: 'Matinee' },
      now: NOW,
    },
    { type: 'plan/move', candidateId: planIds(s)[0]!, delta: 1, now: NOW },
  );
  return s;
};

const roundTrip = (s: ReturnType<typeof richState>) => {
  const r = restore(serialize(pickPersisted(s), NOW));
  if (r.kind !== 'restored') throw new Error(`not restored: ${JSON.stringify(r)}`);
  return r.state;
};

describe('save and restore', () => {
  it('restores the party, interests with Qloo ids, session, feedback, constraints and plan exactly', () => {
    const before = richState();
    const after = roundTrip(before);
    expect(after.party).toEqual(before.party);
    expect(after.targetType).toBe(before.targetType);
    expect(after.negotiation).toEqual(before.negotiation);
    expect(after.party!.members[0]!.interests[0]!.id).toBe('A1');
  });

  it('preserves plan order, status inputs and provenance', () => {
    const before = richState();
    const after = roundTrip(before);
    expect(plan(after)!.entries.map((e) => e.candidateId)).toEqual(planIds(before));
    expect(plan(after)!.provenanceQueryIds).toEqual(plan(before)!.provenanceQueryIds);
    expect(session(after).queries['member:m1']!.results).toEqual(
      session(before).queries['member:m1']!.results,
    );
  });

  it('does not duplicate anything across repeated restores', () => {
    const once = roundTrip(richState());
    const twice = roundTrip(once);
    expect(twice).toEqual(once);
    expect(twice.party!.members).toHaveLength(3);
    expect(Object.keys(session(twice).candidates)).toHaveLength(5);
  });

  it('saves only the minimum: no raw discovery run, and no credential-like fields', () => {
    const text = serialize(pickPersisted(richState()), NOW);
    expect(Object.keys(JSON.parse(text).data).sort()).toEqual([
      'negotiation',
      'party',
      'targetType',
    ]);
    expect(text).not.toMatch(/api[_-]?key|secret|token|password/i);
    expect(JSON.parse(text).schemaVersion).toBe(cfg.schemaVersion);
  });

  it('treats no saved data as empty', () => {
    expect(restore(null)).toEqual({ kind: 'empty' });
  });
});

describe('unreadable saved data', () => {
  const unreadable = (raw: string) => {
    const r = restore(raw);
    expect(r.kind).toBe('unreadable');
    return r.kind === 'unreadable' ? r.reason : '';
  };
  const mutate = (fn: (d: any) => void) => {
    const env = JSON.parse(serialize(pickPersisted(richState()), NOW));
    fn(env.data);
    return JSON.stringify(env);
  };

  it('rejects invalid JSON and missing schema versions', () => {
    unreadable('{not json');
    unreadable('{"data":{}}');
    unreadable('[]');
  });
  it('rejects an outdated schema with no migration, and a newer one', () => {
    const env = JSON.parse(serialize(pickPersisted(richState()), NOW));
    expect(unreadable(JSON.stringify({ ...env, schemaVersion: 0 }))).toMatch(/No migration/);
    expect(unreadable(JSON.stringify({ ...env, schemaVersion: 99 }))).toMatch(/newer version/);
  });
  it('rejects structurally broken or inconsistent data', () => {
    unreadable(mutate((d) => (d.party.members[0].interests[0].id = 7)));
    unreadable(mutate((d) => (d.party.members[1].id = d.party.members[0].id)));
    unreadable(mutate((d) => (d.negotiation.candidates.Y.feedback.ghost = 'pass')));
    unreadable(mutate((d) => (d.negotiation.candidates.Y.feedback.m1 = 'adore')));
    unreadable(mutate((d) => d.negotiation.plan.entries.push(d.negotiation.plan.entries[0])));
    unreadable(mutate((d) => (d.negotiation.partyId = 'other')));
    unreadable(
      mutate((d) =>
        d.negotiation.queries['member:m1'].results.push({ entityId: 'NOPE', position: 9 }),
      ),
    );
    unreadable(mutate((d) => (d.party = null)));
    unreadable(mutate((d) => (d.negotiation.constraints.budgetMax = 'lots')));
  });
});

describe('loadSession', () => {
  it('quarantines corrupt data under a backup key instead of deleting it, then starts fresh', async () => {
    const storage = memoryStorage({ [cfg.storageKey]: '{broken' });
    const r = await loadSession(storage);
    expect(r.kind).toBe('unreadable');
    expect(storage.dump()[cfg.backupKey]).toBe('{broken');
    expect(storage.dump()[cfg.storageKey]).toBeUndefined();
  });
  it('restores good data', async () => {
    const storage = memoryStorage({ [cfg.storageKey]: serialize(pickPersisted(richState()), NOW) });
    expect((await loadSession(storage)).kind).toBe('restored');
  });
  it('reports a storage read failure instead of throwing', async () => {
    const storage: SessionStorage = {
      getItem: () => Promise.reject(new Error('disk')),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    expect(await loadSession(storage)).toMatchObject({ kind: 'storage_error' });
  });
});

describe('persistor', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  const data = (n: number) => ({ ...pickPersisted(richState()), targetType: `t${n}` });

  it('coalesces rapid changes into one write of the latest state', async () => {
    const storage = memoryStorage();
    const spy = jest.spyOn(storage, 'setItem');
    const p = createPersistor(storage, { debounceMs: 100, now: () => NOW });
    p.schedule(data(1));
    p.schedule(data(2));
    p.schedule(data(3));
    await jest.advanceTimersByTimeAsync(150);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.dump()[cfg.storageKey]!).data.targetType).toBe('t3');
  });

  it('never lets a slow older write overwrite a newer one', async () => {
    const stored: string[] = [];
    let first = true;
    const storage: SessionStorage = {
      getItem: async () => null,
      removeItem: async () => undefined,
      setItem: async (_k, v) => {
        if (first) {
          first = false;
          await new Promise((r) => setTimeout(r, 500)); // slow first write
        }
        stored.push(JSON.parse(v).data.targetType);
      },
    };
    const p = createPersistor(storage, { debounceMs: 0, now: () => NOW });
    p.schedule(data(1));
    const f1 = p.flush();
    p.schedule(data(2));
    const f2 = p.flush();
    await jest.advanceTimersByTimeAsync(600);
    await Promise.all([f1, f2]);
    expect(stored).toEqual(['t1', 't2']); // in order; the last write is the newest
  });

  it('reports a save failure and recovers on the next save', async () => {
    let fail = true;
    const storage = memoryStorage();
    const real = storage.setItem;
    storage.setItem = async (k, v) => {
      if (fail) throw new Error('quota');
      return real(k, v);
    };
    const onError = jest.fn();
    const p = createPersistor(storage, { debounceMs: 0, now: () => NOW, onError });
    p.schedule(data(1));
    await p.flush();
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/could not be saved/));
    fail = false;
    p.schedule(data(2));
    await p.flush();
    expect(JSON.parse(storage.dump()[cfg.storageKey]!).data.targetType).toBe('t2');
  });

  it('clear removes the saved session and cancels pending writes', async () => {
    const storage = memoryStorage({ [cfg.storageKey]: 'x' });
    const p = createPersistor(storage, { debounceMs: 100, now: () => NOW });
    p.schedule(data(1));
    await p.clear();
    await jest.advanceTimersByTimeAsync(500);
    expect(storage.dump()[cfg.storageKey]).toBeUndefined();
  });

  it('removes the saved key instead of saving an empty session', async () => {
    const storage = memoryStorage({ [cfg.storageKey]: 'x' });
    const p = createPersistor(storage, { debounceMs: 0, now: () => NOW });
    p.schedule({ party: null, targetType: null, negotiation: null });
    await p.flush();
    expect(storage.dump()[cfg.storageKey]).toBeUndefined();
  });
});

describe('AsyncStorage adapter (library mock, not a device)', () => {
  beforeEach(() => AsyncStorage.clear());
  it('round-trips a real saved session through the AsyncStorage API', async () => {
    const before = richState();
    const p = createPersistor(asyncStorageAdapter, { debounceMs: 0, now: () => NOW });
    p.schedule(pickPersisted(before));
    await p.flush();
    const r = await loadSession(asyncStorageAdapter);
    expect(r.kind).toBe('restored');
    if (r.kind === 'restored') expect(r.state.negotiation).toEqual(before.negotiation);
  });
});
