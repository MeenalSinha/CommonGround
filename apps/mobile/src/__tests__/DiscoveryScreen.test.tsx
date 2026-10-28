import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { DiscoveryScreen } from '@/screens/DiscoveryScreen';
import { ENTITY_TYPES, entity, recommendationsPayload, seedParty } from '@/testing/fixtures';
import { envelope, health, jsonResponse, mockBackend, qlooStatus } from '@/testing/mockBackend';
import { renderWithStatus } from '@/testing/renderWithStatus';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }));

const HEALTH = 'GET /health';
const STATUS = 'GET /api/v1/integrations/qloo/status';
const TYPES = 'GET /api/v1/qloo/entity-types';
const RECS = 'GET /api/v1/qloo/insights/recommendations';

const ready = () => jsonResponse(qlooStatus({ state: 'ready', configured: true, ready: true }));
const typesRoute = () => jsonResponse({ types: ENTITY_TYPES });

const A = entity('A', 'Alpha Band');
const B = entity('B', 'Beta Film', 'urn:entity:movie');
const party = () => seedParty([{ name: 'Ann', interests: [A] }, { name: 'Bo', interests: [A, B] }]);

afterEach(() => jest.restoreAllMocks());

async function pickMovie() {
  await fireEvent.press(await screen.findByLabelText('Movie'));
}

describe('DiscoveryScreen', () => {
  it('asks for a party when none exists', async () => {
    mockBackend({ [HEALTH]: () => jsonResponse(health), [STATUS]: ready, [TYPES]: typesRoute });
    await renderWithStatus(<DiscoveryScreen />);
    expect(screen.getByText('No party yet')).toBeTruthy();
  });

  it('is blocked, with reasons, for one person or no resolved interests', async () => {
    mockBackend({ [HEALTH]: () => jsonResponse(health), [STATUS]: ready, [TYPES]: typesRoute });
    await renderWithStatus(<DiscoveryScreen />, seedParty([{ name: 'Ann' }]));
    expect(await screen.findByText(/at least two people/i)).toBeTruthy();
    expect(screen.getByText(/at least one interest/i)).toBeTruthy();
    expect(screen.getByLabelText('Find shared experiences').props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('is blocked when Qloo is not configured and makes no recommendation request', async () => {
    const fetchMock = mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: () => jsonResponse(qlooStatus()),
      [TYPES]: typesRoute,
    });
    await renderWithStatus(<DiscoveryScreen />, party());
    expect(await screen.findByText(/until a Qloo key is configured/i)).toBeTruthy();
    await pickMovie();
    expect(screen.getByLabelText('Find shared experiences').props.accessibilityState.disabled).toBe(
      true,
    );
    expect(screen.getByLabelText('Refresh status')).toBeTruthy();
    expect(fetchMock.mock.calls.map((c) => new URL(c[0]).pathname)).not.toContain(
      '/api/v1/qloo/insights/recommendations',
    );
  });

  it('shows categories only from the backend, and an error when they cannot load', async () => {
    mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: ready,
      [TYPES]: () => envelope('internal_error', 'Could not list categories.', 500),
    });
    await renderWithStatus(<DiscoveryScreen />, party());
    expect(await screen.findByText('Could not list categories.')).toBeTruthy();
    expect(screen.queryByLabelText('Movie')).toBeNull();
  });

  it('sends each unique real entity id once with the chosen category and renders the response', async () => {
    const calls: URL[] = [];
    mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: ready,
      [TYPES]: typesRoute,
      [RECS]: (url) => {
        calls.push(url);
        return jsonResponse(recommendationsPayload([entity('R1', 'Suggested Film', 'urn:entity:movie')]));
      },
    });
    await renderWithStatus(<DiscoveryScreen />, party());
    await pickMovie();
    await waitFor(() =>
      expect(screen.getByLabelText('Find shared experiences').props.accessibilityState.disabled).toBe(
        false,
      ),
    );
    await fireEvent.press(screen.getByLabelText('Find shared experiences'));
    expect(await screen.findByText('Suggested Film')).toBeTruthy();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.searchParams.get('type')).toBe('urn:entity:movie');
    expect(calls[0]?.searchParams.get('entity_ids')).toBe('A,B');
    expect(screen.getByText(/Based on 2 interests from 2 people/)).toBeTruthy();
    expect(screen.getByText(/Alpha Band \(Ann, Bo\)/)).toBeTruthy();
    expect(screen.queryByText(/%|compatib|match score/i)).toBeNull();

    await fireEvent.press(screen.getByLabelText('Show source details'));
    expect(screen.getByText('Source: qloo')).toBeTruthy();
    expect(screen.getByText('Endpoint: /v2/insights')).toBeTruthy();
  });

  it('honest empty result and honest failure', async () => {
    let fail = true;
    mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: ready,
      [TYPES]: typesRoute,
      [RECS]: () =>
        fail
          ? envelope('qloo_rate_limited', 'Qloo is rate limiting requests.', 429)
          : jsonResponse(recommendationsPayload([])),
    });
    await renderWithStatus(<DiscoveryScreen />, party());
    await pickMovie();
    await waitFor(() =>
      expect(screen.getByLabelText('Find shared experiences').props.accessibilityState.disabled).toBe(
        false,
      ),
    );
    await fireEvent.press(screen.getByLabelText('Find shared experiences'));
    expect(await screen.findByText('Qloo is rate limiting requests.')).toBeTruthy();
    expect(screen.queryByText(/suggestions from Qloo/)).toBeNull();

    fail = false;
    await fireEvent.press(screen.getByLabelText('Try again'));
    expect(await screen.findByText(/returned no suggestions/i)).toBeTruthy();
    expect(screen.queryByText('Qloo is rate limiting requests.')).toBeNull();
  });

  it('hides results when the selection changes, and excludes deselected interests from the request', async () => {
    const calls: URL[] = [];
    mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: ready,
      [TYPES]: typesRoute,
      [RECS]: (url) => {
        calls.push(url);
        return jsonResponse(recommendationsPayload([entity('R1', 'Suggested Film', 'urn:entity:movie')]));
      },
    });
    await renderWithStatus(<DiscoveryScreen />, party());
    await pickMovie();
    await waitFor(() =>
      expect(screen.getByLabelText('Find shared experiences').props.accessibilityState.disabled).toBe(
        false,
      ),
    );
    await fireEvent.press(screen.getByLabelText('Find shared experiences'));
    await screen.findByText('Suggested Film');

    await fireEvent.press(screen.getByLabelText('Beta Film, from Bo'));
    expect(screen.queryByText('Suggested Film')).toBeNull();
    expect(screen.getByText('Selection changed')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Find shared experiences'));
    await screen.findByText('Suggested Film');
    expect(calls[1]?.searchParams.get('entity_ids')).toBe('A');
  });

  it('refuses more than 20 interests instead of silently truncating', async () => {
    const many = Array.from({ length: 21 }, (_, i) => entity(`E${i}`, `Thing ${i}`));
    mockBackend({ [HEALTH]: () => jsonResponse(health), [STATUS]: ready, [TYPES]: typesRoute });
    await renderWithStatus(<DiscoveryScreen />, seedParty([{ name: 'Ann', interests: many }, { name: 'Bo' }]));
    await pickMovie();
    expect(await screen.findByText(/Deselect 1/)).toBeTruthy();
    expect(screen.getByLabelText('Find shared experiences').props.accessibilityState.disabled).toBe(
      true,
    );
    await fireEvent.press(screen.getByLabelText('Thing 0, from Ann'));
    await waitFor(() => expect(screen.queryByText(/Deselect/)).toBeNull());
  });
});
