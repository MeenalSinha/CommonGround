import { fireEvent, screen } from '@testing-library/react-native';
import { StatusScreen } from '@/screens/StatusScreen';
import { envelope, health, jsonResponse, mockBackend, qlooStatus } from '@/testing/mockBackend';
import { renderWithStatus } from '@/testing/renderWithStatus';

const STATUS = 'GET /api/v1/integrations/qloo/status';
const VERIFY = 'POST /api/v1/integrations/qloo/verify';
const HEALTH = 'GET /health';

afterEach(() => jest.restoreAllMocks());

describe('StatusScreen integration status', () => {
  it('shows a loading state before the first response arrives', async () => {
    let release: (r: Response) => void = () => undefined;
    mockBackend({
      [HEALTH]: () => new Promise<Response>((resolve) => (release = resolve)),
      [STATUS]: () => jsonResponse(qlooStatus()),
    });
    await renderWithStatus(<StatusScreen />);
    expect(await screen.findByLabelText('Checking the connection')).toBeTruthy();
    expect(screen.getByText('Checking backend')).toBeTruthy();
    release(jsonResponse(health)); // settle the pending request so no timers are left open
    expect(await screen.findByText('Backend online')).toBeTruthy();
  });

  it('reports backend online and Qloo not configured, honestly and without fake results', async () => {
    const fetchMock = mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: () => jsonResponse(qlooStatus()),
    });
    await renderWithStatus(<StatusScreen />);
    expect(await screen.findByText('Backend online')).toBeTruthy();
    expect(await screen.findByText('Not configured')).toBeTruthy();
    expect(screen.getByText('Waiting for the key')).toBeTruthy();
    expect(screen.getByText(/no live discoveries/i)).toBeTruthy();
    // Search and verification are visibly unavailable; no discovery request is made.
    expect(screen.getByLabelText('Verify with Qloo').props.accessibilityState.disabled).toBe(true);
    expect(fetchMock.mock.calls.map((c) => new URL(c[0]).pathname)).toEqual([
      '/health',
      '/api/v1/integrations/qloo/status',
    ]);
  });

  it('shows backend unavailable with a useful message', async () => {
    mockBackend({
      [HEALTH]: () => {
        throw new TypeError('Network request failed');
      },
    });
    await renderWithStatus(<StatusScreen />);
    expect(await screen.findByText('Backend offline')).toBeTruthy();
    expect(screen.getByText(/Could not reach the CommonGround backend/)).toBeTruthy();
    expect(screen.getByText('Unknown')).toBeTruthy();
  });

  it('shows verified only after a genuine verification result', async () => {
    mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: () =>
        jsonResponse(
          qlooStatus({
            state: 'pending_verification',
            configured: true,
            message: 'A Qloo key is present, but no live request has succeeded yet.',
          }),
        ),
      [VERIFY]: () =>
        jsonResponse(
          qlooStatus({
            state: 'ready',
            configured: true,
            ready: true,
            message: 'Qloo responded successfully.',
            last_verified_at: '2026-01-01T10:00:00Z',
          }),
        ),
    });
    await renderWithStatus(<StatusScreen />);
    expect(await screen.findByText('Awaiting verification')).toBeTruthy();
    expect(screen.queryByText('Verified and ready')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Verify with Qloo'));
    expect(await screen.findByText('Verified and ready')).toBeTruthy();
    expect(screen.getByText(/Last verified at/)).toBeTruthy();
  });

  it('shows an authentication failure from verification', async () => {
    mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: jest
        .fn()
        .mockReturnValueOnce(
          jsonResponse(qlooStatus({ state: 'pending_verification', configured: true })),
        )
        .mockReturnValue(
          jsonResponse(
            qlooStatus({
              state: 'auth_failed',
              configured: true,
              message: 'Qloo rejected the configured credentials.',
            }),
          ),
        ),
      [VERIFY]: () =>
        envelope(
          'qloo_auth_failed',
          'Qloo rejected the configured credentials. Check the API key and base URL.',
          502,
        ),
    });
    await renderWithStatus(<StatusScreen />);
    await screen.findByText('Awaiting verification');
    await fireEvent.press(screen.getByLabelText('Verify with Qloo'));
    expect(await screen.findByText('Authentication failed')).toBeTruthy();
    expect(screen.getByText(/Check the API key and base URL/)).toBeTruthy();
    expect(screen.queryByText('Verified and ready')).toBeNull();
  });

  it('retries a real check: recovers after the backend comes back, never fakes success', async () => {
    let up = false;
    const fetchMock = mockBackend({
      [HEALTH]: () => {
        if (!up) throw new TypeError('Network request failed');
        return jsonResponse(health);
      },
      [STATUS]: () => jsonResponse(qlooStatus()),
    });
    await renderWithStatus(<StatusScreen />);
    expect(await screen.findByText('Backend offline')).toBeTruthy();
    const callsBefore = fetchMock.mock.calls.length;

    await fireEvent.press(screen.getByLabelText('Refresh status'));
    expect(await screen.findByText('Backend offline')).toBeTruthy(); // still down: still honest
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);

    up = true;
    await fireEvent.press(screen.getByLabelText('Refresh status'));
    expect(await screen.findByText('Backend online')).toBeTruthy();
    expect(await screen.findByText('Not configured')).toBeTruthy();
  });

  it('exposes accessible labels and roles on controls and headings', async () => {
    mockBackend({
      [HEALTH]: () => jsonResponse(health),
      [STATUS]: () => jsonResponse(qlooStatus()),
    });
    await renderWithStatus(<StatusScreen />);
    await screen.findByText('Not configured');
    expect(screen.getByLabelText('Refresh status').props.accessibilityRole).toBe('button');
    expect(screen.getByLabelText('Verify with Qloo').props.accessibilityRole).toBe('button');
    expect(screen.getAllByRole('header').length).toBeGreaterThan(0);
  });
});
