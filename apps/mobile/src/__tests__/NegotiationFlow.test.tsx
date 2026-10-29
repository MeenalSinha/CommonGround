/** MOCKED workflow tests: real screens and state, mocked HTTP. They do not prove live Qloo availability. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useEffect, useState } from 'react';
import { NegotiateScreen } from '@/screens/NegotiateScreen';
import { PlanScreen } from '@/screens/PlanScreen';
import { MAX_SIGNAL_IDS, partyReducer, type PartyState } from '@/state/party';
import { entity, recommendationsPayload, seedParty } from '@/testing/fixtures';
import { envelope, health, jsonResponse, mockBackend, qlooStatus } from '@/testing/mockBackend';
import { Q, TARGET, W, X, Y, Z } from '@/testing/negotiationFixtures';
import { renderWithStatus } from '@/testing/renderWithStatus';

let mockSetRoute: (r: string) => void = () => undefined;
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (r: string) => mockSetRoute(r),
    back: () => mockSetRoute('/negotiate'),
  }),
}));

const HEALTH = 'GET /health';
const STATUS = 'GET /api/v1/integrations/qloo/status';
const REC = 'GET /api/v1/qloo/insights/recommendations';
const ready = () => jsonResponse(qlooStatus({ state: 'ready', configured: true, ready: true }));

/** Stands in for Expo Router: one provider, two screens, navigation by route name. */
function Flow() {
  const [route, setR] = useState('/negotiate');
  useEffect(() => {
    mockSetRoute = setR;
  }, []);
  return route === '/plan' ? <PlanScreen /> : <NegotiateScreen />;
}

const start = (): PartyState =>
  partyReducer(
    seedParty([
      { name: 'Ann', interests: [entity('A1', 'Alpha')] },
      { name: 'Bo', interests: [entity('B1', 'Bravo')] },
      { name: 'Cy', interests: [entity('C1', 'Charlie')] },
    ]),
    { type: 'discovery/target', targetType: TARGET },
  );

const recsByIds = (ids: string | null) =>
  jsonResponse(
    recommendationsPayload(
      ids === 'A1' ? [X, Y, Z] : ids === 'B1' ? [Y, W, X] : ids === 'C1' ? [Q, Y] : [Y, X],
    ),
  );

const recCalls = (mock: jest.Mock) =>
  mock.mock.calls.filter(([u]) => String(u).includes('recommendations')).length;

const press = async (label: string) => fireEvent.press(await screen.findByLabelText(label));

async function gatherAll() {
  await waitFor(() =>
    expect(screen.getByLabelText('Gather suggestions').props.accessibilityState.disabled).toBe(
      false,
    ),
  );
  await press('Gather suggestions');
  await screen.findByText(/Last run: 4 requests sent, 4 returned suggestions/);
  expect(screen.getByText(/Shortlist \(5\)/)).toBeTruthy();
}

describe('negotiation workflow (mocked backend)', () => {
  it('goes from gathered candidates to a finalized plan, respecting exclusions and limits', async () => {
    const mock = mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: ready,
      [REC]: (url) => recsByIds(url.searchParams.get('entity_ids')),
    });
    await renderWithStatus(<Flow />, start());
    await gatherAll();
    expect(recCalls(mock)).toBe(4); // 3 people + group
    expect(screen.getAllByText(/Surfaced from/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/compatibility score/i)).toBeNull();

    // Ann is interested in Yonder; Bo hard-excludes Xenon. Pass/unsure would not do that.
    await press('Interested: Yonder');
    await press('Record responses for Bo');
    await press('Hard exclusion: Xenon');
    expect(await screen.findByText(/Set aside \(1\)/)).toBeTruthy();
    expect(screen.getByText(/Bo marked this as a hard exclusion/)).toBeTruthy();

    // Build the plan: Xenon must not appear.
    await press('Build the plan');
    expect(await screen.findByText('Test party: shared-experience plan')).toBeTruthy();
    expect(screen.getByText('Proposed')).toBeTruthy();
    expect(screen.queryByText(/\. Xenon$/)).toBeNull();
    expect(screen.getByText(/1\. Yonder/)).toBeTruthy();
    expect(screen.getByText(/Saved on this device only/)).toBeTruthy();

    // Reject the first entry for the group, then ask for an alternative.
    await press('Pass for the group: Yonder');
    expect(await screen.findByText(/was removed and will not be suggested again/)).toBeTruthy();
    expect(screen.queryByText(/1\. Yonder/)).toBeNull();
    await press('Suggest an alternative plan');
    await waitFor(() => expect(screen.getByText(/What changed|That did not work/)).toBeTruthy());

    // A cost the user typed plus a budget: the over-budget candidate must stay out of a rebuilt plan.
    await press('Back to negotiation');
    await press('Add your own cost and duration: Willow');
    await fireEvent.changeText(
      await screen.findByLabelText('Cost for Willow (your estimate)'),
      '100',
    );
    await press('Save details: Willow');
    await fireEvent.changeText(screen.getByLabelText('Budget limit (optional)'), '50');
    await press('Save limits');
    await press('Rebuild the plan from current responses');
    await screen.findByText('Test party: shared-experience plan');
    expect(screen.queryByText(/\. Willow$/)).toBeNull();
    expect(screen.getByText(/Your numbers/)).toBeTruthy();

    // Mark ready, then finalize only after explicit confirmation. Unresolved responses are still shown.
    expect(screen.getByText(/Still unresolved/)).toBeTruthy();
    await press('Mark ready for confirmation');
    expect(await screen.findByText('Ready for confirmation')).toBeTruthy();
    await press('Finalize plan');
    expect(screen.queryByText('Finalized')).toBeNull(); // not final yet
    await press('Yes, finalize this plan');
    expect(await screen.findByText('Finalized')).toBeTruthy();
    expect(screen.getByText(/not a record that everyone approved/)).toBeTruthy();
    await press('Reopen plan to change it');
    expect(await screen.findByText('Proposed')).toBeTruthy();
  });

  it('keyless: Qloo unavailable sends no request, shows why, and never invents candidates', async () => {
    const mock = mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: () => jsonResponse(qlooStatus()),
      [REC]: () => {
        throw new Error('must not be called');
      },
    });
    await renderWithStatus(<Flow />, start());
    expect(
      (await screen.findAllByText(/Qloo key|not available|connected/i)).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText('Gather suggestions').props.accessibilityState.disabled).toBe(
      true,
    );
    expect(screen.getByLabelText('Build the plan').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(/Nothing is made up/)).toBeTruthy();
    expect(screen.queryByText(/Shortlist/)).toBeNull();
    expect(mock.mock.calls.some(([u]) => String(u).includes('recommendations'))).toBe(false);
  });

  it('partial failure: keeps the successes, says who is not represented, and a retry fixes only that request', async () => {
    let failBo = true;
    const mock = mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: ready,
      [REC]: (url) => {
        const ids = url.searchParams.get('entity_ids');
        if (ids === 'B1' && failBo) return envelope('qloo_timeout', 'Qloo took too long.', 504);
        return recsByIds(ids);
      },
    });
    await renderWithStatus(<Flow />, start());
    await waitFor(() =>
      expect(screen.getByLabelText('Gather suggestions').props.accessibilityState.disabled).toBe(
        false,
      ),
    );
    await press('Gather suggestions');
    await screen.findByText(
      /Last run: 4 requests sent, 3 returned suggestions, 0 returned none, 1 failed/,
    );
    expect(screen.getByText('Request failed')).toBeTruthy();
    expect(
      screen.getByText(/request for Bo failed.*do not represent that person equally/i),
    ).toBeTruthy();
    expect(screen.getByText(/Shortlist/)).toBeTruthy(); // successes kept
    const before = recCalls(mock);
    failBo = false;
    await press('Retry 1 failed or unsent request');
    await waitFor(() => expect(screen.queryByText('Request failed')).toBeNull());
    await screen.findByText(/Last run: 1 request sent/);
    expect(recCalls(mock)).toBe(before + 1); // only the failed one was re-sent
    expect(screen.queryByText(/request for Bo failed/i)).toBeNull();
  });

  it('an over-limit selection is reported and blocks gathering until the user chooses', async () => {
    mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: ready,
      [REC]: () => jsonResponse(recommendationsPayload([X])),
    });
    const many = Array.from({ length: MAX_SIGNAL_IDS + 1 }, (_, i) =>
      entity(`E${i}`, `Interest ${i}`),
    );
    const s = partyReducer(
      seedParty([
        { name: 'Ann', interests: many },
        { name: 'Bo', interests: [entity('B1', 'Bravo')] },
      ]),
      {
        type: 'discovery/target',
        targetType: TARGET,
      },
    );
    await renderWithStatus(<Flow />, s);
    expect(await screen.findByText(/Deselect 1 for Ann/)).toBeTruthy();
    expect(screen.getByLabelText('Gather suggestions').props.accessibilityState.disabled).toBe(
      true,
    );
    await press('Interest 0 for Ann');
    await waitFor(() => expect(screen.queryByText(/Deselect 1 for Ann/)).toBeNull());
  });

  it('shows an honest no-plan outcome instead of an empty success when the pool is empty', async () => {
    mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: ready,
      [REC]: () => jsonResponse(recommendationsPayload([])),
    });
    await renderWithStatus(<Flow />, start());
    await waitFor(() =>
      expect(screen.getByLabelText('Gather suggestions').props.accessibilityState.disabled).toBe(
        false,
      ),
    );
    await press('Gather suggestions');
    await waitFor(() => expect(screen.getAllByText('Qloo returned none').length).toBe(3));
    expect(screen.queryByText(/Shortlist/)).toBeNull();
    expect(screen.getByLabelText('Build the plan').props.accessibilityState.disabled).toBe(true);
  });

  it('asks for a party before anything else', async () => {
    mockBackend({ [HEALTH]: () => jsonResponse(health), [STATUS]: ready });
    await renderWithStatus(<Flow />);
    expect(screen.getByText('No party yet')).toBeTruthy();
  });

  it('asks for a category when a party exists but none is chosen', async () => {
    mockBackend({ [HEALTH]: () => jsonResponse(health), [STATUS]: ready });
    await renderWithStatus(<Flow />, seedParty([{ name: 'Ann' }]));
    expect(screen.getByText('Pick a category first')).toBeTruthy();
  });

  it('the plan screen says so when there is no plan', async () => {
    mockBackend({ [HEALTH]: () => jsonResponse(health), [STATUS]: ready });
    mockSetRoute = () => undefined;
    await renderWithStatus(<PlanScreen />, start());
    expect(screen.getByText('No negotiation yet')).toBeTruthy();
  });
});
