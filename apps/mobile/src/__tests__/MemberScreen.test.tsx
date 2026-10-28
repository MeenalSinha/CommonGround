import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { MemberScreen } from '@/screens/MemberScreen';
import { ENTITY_TYPES, entity, seedParty } from '@/testing/fixtures';
import { envelope, health, jsonResponse, mockBackend, qlooStatus } from '@/testing/mockBackend';
import { renderWithStatus } from '@/testing/renderWithStatus';

const mockBack = jest.fn();
let mockId = 'm1';
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => ({ id: mockId }),
}));

const HEALTH = 'GET /health';
const STATUS = 'GET /api/v1/integrations/qloo/status';
const TYPES = 'GET /api/v1/qloo/entity-types';
const SEARCH = 'GET /api/v1/qloo/entities/search';

const configured = () => jsonResponse(qlooStatus({ state: 'ready', configured: true, ready: true }));
const typesRoute = () => jsonResponse({ types: ENTITY_TYPES });

function searchPayload(items: unknown[]) {
  return {
    items,
    count: items.length,
    page: 1,
    limit: 8,
    empty: items.length === 0,
    provenance: {
      source: 'qloo',
      endpoint: '/search',
      retrieved_at: '2026-01-01T00:00:00Z',
      upstream_duration_ms: null,
      parameters: {},
    },
  };
}

beforeEach(() => {
  mockId = 'm1';
  mockBack.mockClear();
});
afterEach(() => jest.restoreAllMocks());

async function waitForSearchReady() {
  await waitFor(() =>
    expect(screen.getByLabelText('Search Qloo entities').props.editable).toBe(true),
  );
}

describe('MemberScreen', () => {
  it('shows an empty profile state', async () => {
    mockBackend({ [HEALTH]: () => jsonResponse(health), [STATUS]: configured, [TYPES]: typesRoute });
    await renderWithStatus(<MemberScreen />, seedParty([{ name: 'Ann' }]));
    expect(screen.getByText('No interests yet')).toBeTruthy();
  });

  it('shows a not-found state for a removed person', async () => {
    mockId = 'gone';
    mockBackend({ [HEALTH]: () => jsonResponse(health), [STATUS]: configured, [TYPES]: typesRoute });
    await renderWithStatus(<MemberScreen />, seedParty([{ name: 'Ann' }]));
    expect(screen.getByText('Profile not found')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Back to party'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('searches with a category filter, adds a result with its Qloo id, and blocks duplicates', async () => {
    const calls: URL[] = [];
    mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: configured,
      [TYPES]: typesRoute,
      [SEARCH]: (url) => {
        calls.push(url);
        return jsonResponse(searchPayload([entity('Q42', 'Returned Band')]));
      },
    });
    await renderWithStatus(<MemberScreen />, seedParty([{ name: 'Ann' }]));
    await waitForSearchReady();
    await fireEvent.press(await screen.findByLabelText('Artist'));
    await fireEvent.changeText(screen.getByLabelText('Search Qloo entities'), ' band ');
    await fireEvent.press(screen.getByLabelText('Search'));
    expect(await screen.findByText('Returned Band')).toBeTruthy();
    expect(calls[0]?.searchParams.get('query')).toBe('band');
    expect(calls[0]?.searchParams.get('types')).toBe('urn:entity:artist');

    await fireEvent.press(screen.getByLabelText('Add Returned Band'));
    expect(screen.getByLabelText('Added Returned Band').props.accessibilityState.disabled).toBe(
      true,
    );
    expect(screen.getByLabelText('Remove Returned Band')).toBeTruthy();
    expect(screen.getAllByLabelText(/Returned Band, Artist/)).toHaveLength(1);

    await fireEvent.press(screen.getByLabelText('Remove Returned Band'));
    expect(screen.queryByLabelText('Remove Returned Band')).toBeNull();
    expect(screen.getByLabelText('Add Returned Band')).toBeTruthy();
  });

  it('distinguishes empty results from failures and retries with a real request', async () => {
    let attempts = 0;
    mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: configured,
      [TYPES]: typesRoute,
      [SEARCH]: () => {
        attempts += 1;
        return attempts === 1
          ? envelope('qloo_upstream_error', 'Qloo had a problem. Try again.', 502)
          : jsonResponse(searchPayload([]));
      },
    });
    await renderWithStatus(<MemberScreen />, seedParty([{ name: 'Ann' }]));
    await waitForSearchReady();
    await fireEvent.changeText(screen.getByLabelText('Search Qloo entities'), 'zzz');
    await fireEvent.press(screen.getByLabelText('Search'));
    expect(await screen.findByText('Qloo had a problem. Try again.')).toBeTruthy();
    expect(screen.queryByText('Nothing found')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Try again'));
    expect(await screen.findByText('Nothing found')).toBeTruthy();
    expect(attempts).toBe(2);
  });

  it('without a Qloo key: search is unavailable, no search request is made, notes stay unverified', async () => {
    const fetchMock = mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: () => jsonResponse(qlooStatus()),
      [TYPES]: typesRoute,
    });
    await renderWithStatus(<MemberScreen />, seedParty([{ name: 'Ann' }]));
    expect(await screen.findByText(/until a Qloo key is configured/i)).toBeTruthy();
    expect(screen.getByLabelText('Search').props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(screen.getByLabelText('Interest note'), ' lo-fi beats ');
    await fireEvent.press(screen.getByLabelText('Save note'));
    expect(await screen.findByLabelText('lo-fi beats, Not verified')).toBeTruthy();
    expect(fetchMock.mock.calls.map((c) => new URL(c[0]).pathname)).not.toContain(
      '/api/v1/qloo/entities/search',
    );

    await fireEvent.changeText(screen.getByLabelText('Interest note'), '   ');
    await fireEvent.press(screen.getByLabelText('Save note'));
    expect(await screen.findByText('Please enter an interest.')).toBeTruthy();
  });

  it('renames the person and rejects a duplicate name', async () => {
    mockBackend({ [HEALTH]: () => jsonResponse(health), [STATUS]: configured, [TYPES]: typesRoute });
    await renderWithStatus(<MemberScreen />, seedParty([{ name: 'Ann' }, { name: 'Bo' }]));
    await fireEvent.press(screen.getByLabelText('Edit name'));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'bo');
    await fireEvent.press(screen.getByLabelText('Save name'));
    expect(await screen.findByText(/already has that name/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Anna');
    await fireEvent.press(screen.getByLabelText('Save name'));
    expect(await screen.findByText('Anna')).toBeTruthy();
  });
});
