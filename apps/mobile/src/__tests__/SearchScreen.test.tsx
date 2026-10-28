import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { SearchScreen } from '@/screens/SearchScreen';
import { envelope, health, jsonResponse, mockBackend, qlooStatus } from '@/testing/mockBackend';
import { renderWithStatus } from '@/testing/renderWithStatus';

const STATUS = 'GET /api/v1/integrations/qloo/status';
const HEALTH = 'GET /health';
const SEARCH = 'GET /api/v1/qloo/entities/search';

afterEach(() => jest.restoreAllMocks());

const configured = () =>
  jsonResponse(qlooStatus({ state: 'pending_verification', configured: true, message: 'key set' }));

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
    },
  };
}

describe('SearchScreen', () => {
  it('is disabled and explains why when Qloo is not configured, making no search request', async () => {
    const fetchMock = mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: () => jsonResponse(qlooStatus()),
    });
    await renderWithStatus(<SearchScreen />);
    expect(await screen.findByText(/until a Qloo key is configured/i)).toBeTruthy();
    expect(screen.getByLabelText('Search').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText('Search Qloo entities').props.editable).toBe(false);
    expect(fetchMock.mock.calls.map((c) => new URL(c[0]).pathname)).not.toContain(
      '/api/v1/qloo/entities/search',
    );
  });

  it('is disabled with a clear reason when the backend is offline', async () => {
    mockBackend({
      [HEALTH]: () => {
        throw new TypeError('Network request failed');
      },
    });
    await renderWithStatus(<SearchScreen />);
    expect(await screen.findByText(/unavailable until the backend is reachable/i)).toBeTruthy();
    expect(screen.getByLabelText('Search').props.accessibilityState.disabled).toBe(true);
  });

  it('runs a real search and renders exactly what the backend returned', async () => {
    const queries: string[] = [];
    mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: configured,
      [SEARCH]: (url) => {
        queries.push(url.searchParams.get('query') ?? '');
        return jsonResponse(
          searchPayload([
            {
              id: 'E1',
              name: 'Returned Entity',
              type: 'urn:entity:artist',
              description: null,
              image_url: null,
              popularity: null,
              release_year: null,
              tags: [],
            },
          ]),
        );
      },
    });
    await renderWithStatus(<SearchScreen />);
    await waitFor(() =>
      expect(screen.getByLabelText('Search Qloo entities').props.editable).toBe(true),
    );
    await fireEvent.changeText(screen.getByLabelText('Search Qloo entities'), '  mellow  ');
    await fireEvent.press(screen.getByLabelText('Search'));
    expect(await screen.findByText('Returned Entity')).toBeTruthy();
    expect(screen.getByText('Artist')).toBeTruthy();
    expect(queries).toEqual(['mellow']);
  });

  it('shows a loading state during the request, then a distinct empty state', async () => {
    let release: (r: Response) => void = () => undefined;
    mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: configured,
      [SEARCH]: () => new Promise<Response>((resolve) => (release = resolve)),
    });
    await renderWithStatus(<SearchScreen />);
    await waitFor(() =>
      expect(screen.getByLabelText('Search Qloo entities').props.editable).toBe(true),
    );
    await fireEvent.changeText(screen.getByLabelText('Search Qloo entities'), 'zzz');
    await fireEvent.press(screen.getByLabelText('Search'));
    expect(await screen.findByLabelText('Searching Qloo')).toBeTruthy();
    release(jsonResponse(searchPayload([])));
    expect(await screen.findByText('Nothing found')).toBeTruthy();
    expect(screen.queryByText('Something went wrong')).toBeNull();
    expect(screen.queryByLabelText('Searching Qloo')).toBeNull();
  });

  it('shows an API failure as an error, never as an empty result', async () => {
    mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: configured,
      [SEARCH]: () =>
        envelope(
          'qloo_rate_limited',
          'Qloo is rate limiting requests. Please wait a moment and try again.',
          429,
        ),
    });
    await renderWithStatus(<SearchScreen />);
    await waitFor(() =>
      expect(screen.getByLabelText('Search Qloo entities').props.editable).toBe(true),
    );
    await fireEvent.changeText(screen.getByLabelText('Search Qloo entities'), 'abc');
    await fireEvent.press(screen.getByLabelText('Search'));
    expect(await screen.findByText(/rate limiting requests/)).toBeTruthy();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.queryByText('Nothing found')).toBeNull();
  });
});
