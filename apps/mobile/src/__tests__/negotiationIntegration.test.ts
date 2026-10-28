/**
 * MOCKED integration tests: the real integrationApi + apiClient run against a mocked fetch that mimics the
 * documented backend contract. They prove the mobile side of the contract, NOT live Qloo availability.
 */
import { integrationApi } from '@/services/integrationApi';
import { gatherCandidates } from '@/state/negotiation/orchestrator';
import type { NegotiationAction } from '@/state/negotiation/reducer';
import { rootReducer } from '@/state/store';
import type { PartyState } from '@/state/party';
import { entity, recommendationsPayload } from '@/testing/fixtures';
import { envelope, jsonResponse, mockBackend } from '@/testing/mockBackend';
import {
  NOW,
  W,
  X,
  Y,
  Z,
  TARGET,
  gen,
  planIds,
  send,
  session,
  started,
} from '@/testing/negotiationFixtures';

const REC = 'GET /api/v1/qloo/insights/recommendations';

function harness(initial: PartyState) {
  let state = initial;
  return {
    get: () => state,
    dispatch: (a: NegotiationAction) => {
      state = rootReducer(state, a, () => NOW);
    },
    set: (s: PartyState) => {
      state = s;
    },
  };
}

const run = (h: ReturnType<typeof harness>, extra: { force?: boolean } = {}) =>
  gatherCandidates({
    getState: h.get,
    dispatch: h.dispatch,
    recommend: integrationApi.recommendations,
    wait: async () => undefined,
    now: () => NOW,
    ...extra,
  });

const party3 = () =>
  started([
    { name: 'Ann', interests: [entity('A1', 'Alpha'), entity('A2', 'Alpha2')] },
    { name: 'Bo', interests: [entity('B1', 'Bravo')] },
    { name: 'Cy' }, // no resolved interests: must not borrow anyone else’s
  ]);

describe('gatherCandidates over the real API client (mocked HTTP)', () => {
  it('sends each participant’s own real ids, the group’s union, the category and the limit', async () => {
    const calls: Record<string, string>[] = [];
    mockBackend({
      [REC]: (url) => {
        calls.push(Object.fromEntries(url.searchParams));
        return jsonResponse(recommendationsPayload([X]));
      },
    });
    const h = harness(party3());
    const summary = await run(h);
    expect(calls.map((c) => c.entity_ids)).toEqual(['A1,A2', 'B1', 'A1,A2,B1']);
    for (const c of calls) {
      expect(c.type).toBe(TARGET);
      expect(c.limit).toBe('10');
    }
    expect(summary).toMatchObject({ requested: 3, ok: 3, failed: 0 });
    expect(Object.keys(session(h.get()).candidates)).toEqual(['X']); // merged, not tripled
    expect(Object.keys(session(h.get()).queries)).toEqual(['member:m1', 'member:m2', 'group']);
  });

  it('never sends anything on behalf of a participant with no interests', async () => {
    const mock = mockBackend({ [REC]: () => jsonResponse(recommendationsPayload([X])) });
    await run(harness(party3()));
    const ids = mock.mock.calls.map(([u]) => new URL(u as string).searchParams.get('entity_ids'));
    expect(ids).not.toContain('');
    expect(session(harness(party3()).get()).queries['member:m3']).toBeUndefined();
  });

  it('keeps successes after a partial failure, flags the failed query, and a retry fixes only that one', async () => {
    let failB = true;
    const mock = mockBackend({
      [REC]: (url) => {
        const ids = url.searchParams.get('entity_ids');
        if (ids === 'B1' && failB) return envelope('qloo_timeout', 'Qloo took too long.', 504);
        return jsonResponse(recommendationsPayload(ids === 'B1' ? [Y, Z] : [X, Y]));
      },
    });
    const h = harness(party3());
    const first = await run(h);
    expect(first).toMatchObject({ failed: 1, ok: 2 });
    expect(session(h.get()).queries['member:m2']).toMatchObject({
      status: 'failed',
      error: { code: 'qloo_timeout' },
    });
    expect(session(h.get()).candidates.X).toBeDefined();
    const callsBefore = mock.mock.calls.length;

    failB = false;
    const retry = await run(h); // default mode: only missing or failed
    expect(retry.requested).toBe(1);
    expect(mock.mock.calls.length).toBe(callsBefore + 1);
    expect(session(h.get()).queries['member:m2']!.status).toBe('ok');
    expect(Object.keys(session(h.get()).candidates).sort()).toEqual(['X', 'Y', 'Z']); // no duplicates
  });

  it('makes no requests at all when everything is already gathered (no duplicate calls)', async () => {
    const mock = mockBackend({ [REC]: () => jsonResponse(recommendationsPayload([X])) });
    const h = harness(party3());
    await run(h);
    const n = mock.mock.calls.length;
    expect((await run(h)).requested).toBe(0);
    expect(mock.mock.calls.length).toBe(n);
    expect((await run(h, { force: true })).requested).toBe(3); // explicit refresh does re-request
  });

  it('stops after a rate limit: remaining requests are recorded as not sent, not as empty', async () => {
    const mock = mockBackend({
      [REC]: () => envelope('qloo_rate_limited', 'Too many requests.', 429),
    });
    const h = harness(party3());
    const s = await run(h);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(s).toMatchObject({
      requested: 1,
      failed: 1,
      notSent: 2,
      stoppedBecause: 'qloo_rate_limited',
    });
    const q = session(h.get()).queries;
    expect(q['member:m1']!.status).toBe('failed');
    expect(q['member:m2']!.status).toBe('not_run');
    expect(q.group!.status).toBe('not_run');
    expect(session(h.get()).candidates).toEqual({}); // no fabricated pool
  });

  it('keyless: a 503 qloo_not_configured yields no candidates and an honest no-plan outcome', async () => {
    mockBackend({ [REC]: () => envelope('qloo_not_configured', 'Not configured.', 503) });
    const h = harness(party3());
    const s = await run(h);
    expect(s.stoppedBecause).toBe('qloo_not_configured');
    h.set(gen(h.get()));
    expect(session(h.get()).plan).toBeNull();
    expect(session(h.get()).lastOutcome).toMatchObject({ ok: false, code: 'no_candidates' });
  });

  it('treats a non-API error as a failure with a friendly message and no stack details', async () => {
    mockBackend({ [REC]: () => Promise.reject(new TypeError('boom at /secret/path.js:12')) });
    const h = harness(party3());
    await run(h);
    const q = session(h.get()).queries['member:m1']!;
    expect(q.status).toBe('failed');
    expect(JSON.stringify(q)).not.toMatch(/secret|path\.js/);
  });

  it('one HTTP request serves participants with identical interests, and each keeps its provenance', async () => {
    const shared = entity('S', 'Shared');
    const mock = mockBackend({ [REC]: () => jsonResponse(recommendationsPayload([X, Y])) });
    const h = harness(
      started([
        { name: 'Ann', interests: [shared] },
        { name: 'Bo', interests: [shared] },
      ]),
    );
    await run(h);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(Object.keys(session(h.get()).queries).sort()).toEqual([
      'group',
      'member:m1',
      'member:m2',
    ]);
  });

  it('drops a late response whose inputs changed while it was in flight', async () => {
    let release: (r: Response) => void = () => undefined;
    let first = true;
    const mock = mockBackend({
      [REC]: () => {
        if (!first) return jsonResponse(recommendationsPayload([]));
        first = false; // only the first request is held open
        return new Promise<Response>((r) => (release = r));
      },
    });
    const h = harness(
      started([
        { name: 'Ann', interests: [entity('A1', 'Alpha')] },
        { name: 'Bo', interests: [entity('B1', 'Bravo')] },
      ]),
    );
    const pending = run(h);
    await new Promise((r) => setTimeout(r, 0)); // let the request actually start
    expect(mock).toHaveBeenCalledTimes(1);
    h.set(send(h.get(), { type: 'interest/remove', memberId: 'm1', entityId: 'A1' })); // inputs change mid-flight
    release(jsonResponse(recommendationsPayload([W])));
    await pending;
    expect(session(h.get()).candidates.W).toBeUndefined();
    expect(session(h.get()).queries['member:m1']).toBeUndefined();
  });

  it('end to end: gather, give feedback, plan, exclude, replan; the exclusion is respected', async () => {
    mockBackend({
      [REC]: (url) => {
        const ids = url.searchParams.get('entity_ids');
        return jsonResponse(
          recommendationsPayload(ids === 'A1,A2' ? [X, Y, Z] : ids === 'B1' ? [Y, W] : [Y, X]),
        );
      },
    });
    const h = harness(party3());
    await run(h);
    h.set(gen(h.get()));
    expect(planIds(h.get())[0]).toBe('Y');
    h.set(
      send(h.get(), {
        type: 'negotiation/feedback',
        candidateId: 'Y',
        memberId: 'm2',
        kind: 'exclude',
        now: NOW,
      }),
    );
    h.set(gen(h.get()));
    expect(planIds(h.get())).not.toContain('Y');
    expect(planIds(h.get()).length).toBeGreaterThan(0);
  });
});
