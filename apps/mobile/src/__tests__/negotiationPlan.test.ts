import { ranking as cfg } from '@/state/negotiation/config';
import { rankCandidates } from '@/state/negotiation/ranking';
import { planTotals } from '@/state/negotiation/planner';
import { blockingIssues, planStatus, validatePlan } from '@/state/negotiation/validation';
import { entity } from '@/testing/fixtures';
import {
  NOW,
  Q,
  W,
  X,
  Y,
  Z,
  feed,
  feedback,
  gen,
  plan,
  planIds,
  send,
  session,
  setLength,
  started,
  threeFriends,
} from '@/testing/negotiationFixtures';

const order = (s: ReturnType<typeof threeFriends>) =>
  rankCandidates(session(s), s.party).map((r) => r.candidateId);

describe('ranking', () => {
  it('puts the candidate surfaced by every list first (rank fusion), deterministically', () => {
    const s = threeFriends();
    expect(order(s)[0]).toBe('Y');
    expect(order(s)).toEqual(order(threeFriends())); // same inputs, same order
  });

  it('explicit interest raises a candidate; a pass lowers it; unsure barely moves it', () => {
    const base = threeFriends();
    const rankOf = (s: typeof base, id: string) => order(s).indexOf(id);
    expect(
      rankOf(feedback(feedback(base, 'Q', 'm1', 'interested'), 'Q', 'm2', 'interested'), 'Q'),
    ).toBeLessThan(rankOf(base, 'Q'));
    expect(
      rankOf(feedback(feedback(base, 'Y', 'm1', 'pass'), 'Y', 'm2', 'pass'), 'Y'),
    ).toBeGreaterThan(rankOf(base, 'Y'));
    const unsure = rankCandidates(session(feedback(base, 'W', 'm1', 'unsure')), base.party).find(
      (r) => r.candidateId === 'W',
    )!;
    expect(unsure.feedbackNet).toBeCloseTo(cfg.feedbackValue.unsure / 3);
  });

  it('hard exclusions remove a top-ranked candidate regardless of score', () => {
    const s = feedback(threeFriends(), 'Y', 'm2', 'exclude');
    expect(order(s)).not.toContain('Y');
    expect(
      rankCandidates(session(s), s.party, { includeIneligible: true }).some(
        (r) => r.candidateId === 'Y',
      ),
    ).toBe(true);
  });

  it('queries with identical signals count as one list, so duplicates cannot inflate support', () => {
    const shared = entity('S', 'Shared');
    let s = started([
      { name: 'Ann', interests: [shared] },
      { name: 'Bo', interests: [shared] },
    ]);
    for (const id of ['member:m1', 'member:m2', 'group']) s = feed(s, id, [X, Y]);
    const r = rankCandidates(session(s), s.party);
    expect(r[0]!.evidence).toBeCloseTo(1); // best possible, not 3x
  });

  it('records each candidate’s surfacing participants, group presence and best position', () => {
    const s = threeFriends();
    const y = rankCandidates(session(s), s.party).find((r) => r.candidateId === 'Y')!;
    expect(y.surfacedBy).toEqual(['m1', 'm2', 'm3']);
    expect(y.inGroup).toBe(true);
    expect(y.bestPosition).toBe(1);
    const z = rankCandidates(session(s), s.party).find((r) => r.candidateId === 'Z')!;
    expect(z.surfacedBy).toEqual(['m1']);
    expect(z.inGroup).toBe(false);
  });
});

describe('plan generation', () => {
  it('builds an ordered plan of real candidates with evidence-based reasons', () => {
    const s = gen(threeFriends());
    expect(planIds(s)).toHaveLength(3);
    expect(planIds(s)[0]).toBe('Y');
    const reasons = plan(s)!.entries[0]!.reasons.join(' ');
    expect(reasons).toMatch(/3 participants/);
    expect(reasons).toMatch(/group-level/);
    expect(reasons).not.toMatch(/love|like/i);
    for (const id of planIds(s)) expect(session(s).candidates[id]).toBeDefined();
  });

  it('respects the requested length within the bounds and rejects invalid lengths', () => {
    expect(planIds(gen(setLength(threeFriends(), 2)))).toHaveLength(2);
    expect(planIds(gen(setLength(threeFriends(), 5)))).toHaveLength(5);
    const bad = setLength(threeFriends(), 99);
    expect(session(bad).planLength).toBe(3); // refused
  });

  it('says honestly when fewer candidates exist than requested', () => {
    let s = started([
      { name: 'Ann', interests: [entity('A1', 'A')] },
      { name: 'Bo', interests: [entity('B1', 'B')] },
    ]);
    s = feed(s, 'member:m1', [X, Y]);
    s = gen(setLength(s, 5));
    expect(planIds(s)).toHaveLength(2);
    const out = session(s).lastOutcome;
    expect(out?.ok && out.messages.join(' ')).toMatch(/Only 2 of the requested 5/);
  });

  it('returns an honest no-plan outcome for an empty pool, never fabricating entries', () => {
    const s = gen(
      started([
        { name: 'Ann', interests: [entity('A1', 'A')] },
        { name: 'Bo', interests: [entity('B1', 'B')] },
      ]),
    );
    expect(plan(s)).toBeNull();
    expect(session(s).lastOutcome).toMatchObject({ ok: false, code: 'no_candidates' });
  });

  it('returns no_eligible when every candidate is excluded', () => {
    let s = threeFriends();
    for (const id of Object.keys(session(s).candidates)) {
      s = send(s, { type: 'negotiation/excludeCandidate', candidateId: id, now: NOW });
    }
    s = gen(s);
    expect(session(s).lastOutcome).toMatchObject({ ok: false, code: 'no_eligible' });
    expect(plan(s)).toBeNull();
  });

  it('never includes a hard-excluded candidate, however highly ranked', () => {
    const s = gen(feedback(threeFriends(), 'Y', 'm1', 'exclude'));
    expect(planIds(s)).not.toContain('Y');
  });

  it('is deterministic for identical inputs', () => {
    expect(planIds(gen(threeFriends()))).toEqual(planIds(gen(threeFriends())));
  });

  it('prefers breadth: a candidate reaching a participant nobody else covers gets a place', () => {
    const s = gen(setLength(threeFriends(), 3));
    expect(planIds(s)).toContain('Q'); // only Cy's query surfaced Q; the others cover Ann and Bo
  });
});

describe('constraints use only user-provided numbers', () => {
  const withCosts = () => {
    let s = threeFriends();
    s = send(
      s,
      { type: 'negotiation/details', candidateId: 'Y', patch: { cost: 30 }, now: NOW },
      { type: 'negotiation/details', candidateId: 'X', patch: { cost: 40 }, now: NOW },
    );
    return s;
  };
  it('keeps known costs within the budget and flags the rest as unverified, not zero', () => {
    let s = send(withCosts(), {
      type: 'negotiation/constraint',
      patch: { budgetMax: 50 },
      now: NOW,
    });
    s = gen(s);
    const totals = planTotals(session(s), planIds(s));
    expect(totals.knownCost).toBeLessThanOrEqual(50);
    expect(validatePlan(session(s), s.party).some((i) => i.code === 'budget_unverified')).toBe(
      true,
    );
    expect(
      blockingIssues(validatePlan(session(s), s.party)).some((i) => i.code === 'budget_exceeded'),
    ).toBe(false);
  });
  it('reports a conflict when no candidate fits the limits', () => {
    let s = started([
      { name: 'Ann', interests: [entity('A1', 'A')] },
      { name: 'Bo', interests: [entity('B1', 'B')] },
    ]);
    s = feed(s, 'member:m1', [X]);
    s = send(
      s,
      { type: 'negotiation/details', candidateId: 'X', patch: { cost: 100 }, now: NOW },
      { type: 'negotiation/constraint', patch: { budgetMax: 10 }, now: NOW },
    );
    s = gen(s);
    expect(session(s).lastOutcome).toMatchObject({ ok: false, code: 'constraints_conflict' });
  });
  it('rejects invalid numbers', () => {
    const s = threeFriends();
    const s2 = send(s, {
      type: 'negotiation/details',
      candidateId: 'Y',
      patch: { cost: -5 },
      now: NOW,
    });
    expect(s2).toBe(s);
    const s3 = send(s, {
      type: 'negotiation/constraint',
      patch: { maxTotalMinutes: 1.5 },
      now: NOW,
    });
    expect(s3).toBe(s);
  });
});

describe('replanning', () => {
  it('an alternative differs from the previous plan and explains what changed', () => {
    const first = gen(setLength(threeFriends(), 2));
    const alt = gen(first, true);
    expect(planIds(alt)).not.toEqual(planIds(first));
    const out = session(alt).lastOutcome;
    expect(out?.ok).toBe(true);
    expect(out?.ok && out.messages.length).toBeGreaterThan(0);
  });

  it('says so when the pool has no different valid plan', () => {
    let s = started([
      { name: 'Ann', interests: [entity('A1', 'A')] },
      { name: 'Bo', interests: [entity('B1', 'B')] },
    ]);
    s = feed(s, 'member:m1', [X, Y]);
    s = gen(setLength(s, 2));
    const before = planIds(s);
    s = gen(s, true);
    expect(planIds(s)).toEqual(before);
    expect(session(s).lastOutcome).toMatchObject({ ok: false, code: 'no_alternative' });
  });

  it('rejecting an entry removes it, keeps unrelated feedback, and a replacement is real', () => {
    let s = feedback(threeFriends(), 'Z', 'm2', 'interested');
    s = gen(setLength(s, 2));
    const victim = planIds(s)[0]!;
    s = send(s, { type: 'plan/replace', candidateId: victim, now: NOW });
    expect(planIds(s)).not.toContain(victim);
    for (const id of planIds(s)) expect(session(s).candidates[id]).toBeDefined();
    expect(session(s).candidates.Z!.feedback.m2).toBe('interested');
  });

  it('plan/reject drops the entry, never re-suggests it, and keeps the plan valid', () => {
    let s = gen(threeFriends());
    s = send(s, { type: 'plan/reject', candidateId: 'Y', now: NOW });
    expect(planIds(s)).not.toContain('Y');
    expect(planStatus(session(s), s.party)).toBe('proposed');
    s = gen(s, true);
    expect(planIds(s)).not.toContain('Y');
  });

  it('plan/exclude makes it a hard group exclusion', () => {
    let s = gen(threeFriends());
    s = send(s, { type: 'plan/exclude', candidateId: 'Y', now: NOW });
    expect(session(s).constraints.excludedCandidateIds).toContain('Y');
    expect(session(s).lastOutcome).toMatchObject({ ok: true });
  });

  it('adding a hard-excluded candidate by hand is refused', () => {
    let s = gen(threeFriends());
    s = feedback(s, 'Z', 'm3', 'exclude');
    s = send(s, { type: 'plan/add', candidateId: 'Z', planId: 'p', now: NOW });
    expect(session(s).lastOutcome).toMatchObject({ ok: false, code: 'not_eligible' });
    expect(planIds(s)).not.toContain('Z');
  });

  it('a hand-added entry survives an alternative; a soft-rejected one can be added back', () => {
    let s = gen(setLength(threeFriends(), 2));
    s = send(s, { type: 'negotiation/reject', candidateId: 'W', now: NOW });
    s = send(s, { type: 'plan/add', candidateId: 'W', planId: 'p', now: NOW });
    expect(planIds(s)).toContain('W');
    expect(session(s).rejectedCandidateIds).not.toContain('W');
    s = gen(s, true);
    expect(planIds(s)).toContain('W');
    expect(plan(s)!.entries.find((e) => e.candidateId === 'W')!.origin).toBe('user');
  });

  it('reorders with move up/down and ignores moves past the ends', () => {
    let s = gen(threeFriends());
    const [a, b] = planIds(s);
    s = send(s, { type: 'plan/move', candidateId: a!, delta: 1, now: NOW });
    expect(planIds(s).slice(0, 2)).toEqual([b, a]);
    const before = planIds(s);
    s = send(s, { type: 'plan/move', candidateId: before[0]!, delta: -1, now: NOW });
    expect(planIds(s)).toEqual(before);
  });

  it('changing the length makes the old plan stale rather than silently valid', () => {
    let s = gen(threeFriends());
    s = setLength(s, 2);
    expect(planStatus(session(s), s.party)).toBe('needs_changes');
    expect(validatePlan(session(s), s.party).some((i) => i.code === 'stale_inputs')).toBe(true);
    s = gen(s);
    expect(planIds(s)).toHaveLength(2);
    expect(planStatus(session(s), s.party)).toBe('proposed');
  });

  it('a new hard exclusion invalidates a plan that contains the candidate until it is regenerated', () => {
    let s = gen(threeFriends());
    s = feedback(s, 'Y', 'm2', 'exclude');
    expect(planStatus(session(s), s.party)).toBe('needs_changes');
    expect(validatePlan(session(s), s.party).some((i) => i.code === 'hard_excluded')).toBe(true);
    s = send(s, { type: 'plan/acknowledge', now: NOW });
    expect(session(s).lastOutcome).toMatchObject({ ok: false, code: 'invalid_plan' }); // cannot wave a hard exclusion through
    s = gen(s);
    expect(planIds(s)).not.toContain('Y');
    expect(planStatus(session(s), s.party)).toBe('proposed');
    const out = session(s).lastOutcome;
    expect(out?.ok && out.messages.join(' ')).toMatch(/hard exclusion/);
  });

  it('deleting the removed candidate’s source invalidates a plan that used it', () => {
    let s = gen(threeFriends());
    s = send(s, { type: 'member/remove', id: 'm3' });
    expect(planStatus(session(s), s.party)).toBe('needs_changes'); // stale inputs at minimum
  });
});

describe('status and finalization', () => {
  it('walks proposed → ready → finalized only through explicit steps', () => {
    let s = gen(threeFriends());
    expect(planStatus(session(s), s.party)).toBe('proposed');
    s = send(s, { type: 'plan/finalize', confirmed: true, now: NOW });
    expect(session(s).lastOutcome).toMatchObject({ ok: false, code: 'not_ready' });
    s = send(s, { type: 'plan/ready', now: NOW });
    expect(planStatus(session(s), s.party)).toBe('ready');
    s = send(s, { type: 'plan/finalize', confirmed: false, now: NOW });
    expect(session(s).lastOutcome).toMatchObject({ ok: false, code: 'not_confirmed' });
    s = send(s, { type: 'plan/finalize', confirmed: true, now: NOW });
    expect(planStatus(session(s), s.party)).toBe('finalized');
    expect(plan(s)!.finalizedAt).toBe(NOW);
  });

  it('any edit after “ready” drops the plan back to proposed', () => {
    let s = send(gen(threeFriends()), { type: 'plan/ready', now: NOW });
    s = send(s, { type: 'plan/move', candidateId: planIds(s)[0]!, delta: 1, now: NOW });
    expect(planStatus(session(s), s.party)).toBe('proposed');
  });

  it('a finalized plan is read-only until reopened, and feedback is refused meanwhile', () => {
    let s = send(gen(threeFriends()), { type: 'plan/ready', now: NOW });
    s = send(s, { type: 'plan/finalize', confirmed: true, now: NOW });
    const before = planIds(s);
    s = send(s, { type: 'plan/remove', candidateId: before[0]!, now: NOW });
    expect(planIds(s)).toEqual(before);
    const fb = feedback(s, 'Z', 'm1', 'pass');
    expect(session(fb).candidates.Z!.feedback).toEqual({});
    expect(session(fb).lastOutcome).toMatchObject({ ok: false, code: 'read_only' });
    s = send(s, { type: 'plan/reopen', now: NOW });
    expect(planStatus(session(s), s.party)).toBe('proposed');
  });

  it('an upstream party change reopens a finalized plan', () => {
    let s = send(gen(threeFriends()), { type: 'plan/ready', now: NOW });
    s = send(s, { type: 'plan/finalize', confirmed: true, now: NOW });
    s = send(s, { type: 'interest/remove', memberId: 'm3', entityId: 'C1' });
    expect(plan(s)!.finalizedAt).toBeNull();
  });

  it('does not claim approval: unresolved responses stay visible as a warning even when finalized', () => {
    let s = send(gen(threeFriends()), { type: 'plan/ready', now: NOW });
    s = send(s, { type: 'plan/finalize', confirmed: true, now: NOW });
    const w = validatePlan(session(s), s.party)
      .filter((i) => i.severity === 'warning')
      .map((i) => i.code);
    expect(w).toContain('responses_pending');
  });

  it('a planned candidate that left the pool (only Cy’s query surfaced Q) blocks readiness', () => {
    let s = gen(threeFriends());
    s = send(s, { type: 'member/remove', id: 'm3' });
    s = send(s, { type: 'plan/acknowledge', now: NOW });
    const codes = blockingIssues(validatePlan(session(s), s.party)).map((i) => i.code);
    expect(codes).toContain('candidate_missing');
    s = send(s, { type: 'plan/ready', now: NOW });
    expect(session(s).lastOutcome).toMatchObject({ ok: false });
  });

  it('is a draft when all entries are removed', () => {
    let s = gen(setLength(threeFriends(), 1));
    s = send(s, { type: 'plan/remove', candidateId: planIds(s)[0]!, now: NOW });
    expect(planStatus(session(s), s.party)).toBe('draft');
  });

  it('plan modes distinguish places from media', () => {
    expect(plan(gen(threeFriends()))!.mode).toBe('shared_experience');
  });

  it('party renaming updates the default plan title automatically', () => {
    const s = gen(threeFriends());
    expect(plan(s)!.title).toBe('Test party: shared-experience plan');
    const renamed = send(s, { type: 'party/rename', name: 'Nomads' });
    expect(plan(renamed)!.title).toBe('Nomads: shared-experience plan');
  });

  it('party renaming preserves custom plan title if user renamed the plan', () => {
    let s = gen(threeFriends());
    s = send(s, { type: 'plan/rename', title: 'Epic Weekend Plan', now: NOW });
    expect(plan(s)!.title).toBe('Epic Weekend Plan');
    const renamed = send(s, { type: 'party/rename', name: 'Nomads' });
    expect(plan(renamed)!.title).toBe('Epic Weekend Plan');
  });
});
void Q;
void W;
void X;
void Y;
void Z;
