import { fireEvent, screen } from '@testing-library/react-native';
import { HomeScreen } from '@/screens/HomeScreen';
import { health, jsonResponse, mockBackend, qlooStatus } from '@/testing/mockBackend';
import { renderWithStatus } from '@/testing/renderWithStatus';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const STATUS = 'GET /api/v1/integrations/qloo/status';
const HEALTH = 'GET /health';

beforeEach(() => mockPush.mockClear());
afterEach(() => jest.restoreAllMocks());

function backendUp() {
  return mockBackend({
    [HEALTH]: () => jsonResponse(health),
    [STATUS]: () => jsonResponse(qlooStatus()),
  });
}

describe('HomeScreen', () => {
  it('shows the brand, tagline and plain-language product explanation', async () => {
    backendUp();
    await renderWithStatus(<HomeScreen />);
    expect(screen.getByLabelText('CommonGround')).toBeTruthy();
    expect(screen.getByText('Different tastes. One unforgettable adventure.')).toBeTruthy();
    expect(screen.getByText(/finding the ground they share/i)).toBeTruthy();
    await screen.findByText('Backend online'); // let the status check settle
  });

  it('describes what exists today and marks group planning as coming soon', async () => {
    backendUp();
    await renderWithStatus(<HomeScreen />);
    expect(screen.getByText('Planning: coming soon')).toBeTruthy();
    expect(screen.getByText(/Create a party and add your people/)).toBeTruthy();
    expect(screen.getByText(/smart group planning.*not built yet/i)).toBeTruthy();
    await screen.findByText('Backend online');
  });

  it('shows real backend and Qloo status in the summary, labelled with text', async () => {
    backendUp();
    await renderWithStatus(<HomeScreen />);
    expect(await screen.findByText('Backend online')).toBeTruthy();
    expect(await screen.findByText('Qloo: Not configured')).toBeTruthy();
  });

  it('shows an offline backend honestly in the summary', async () => {
    mockBackend({
      [HEALTH]: () => {
        throw new TypeError('Network request failed');
      },
    });
    await renderWithStatus(<HomeScreen />);
    expect(await screen.findByText('Backend offline')).toBeTruthy();
    expect(screen.getByText('Qloo: Unknown')).toBeTruthy();
  });

  it('navigates to the real destinations only', async () => {
    backendUp();
    await renderWithStatus(<HomeScreen />);
    await screen.findByText('Backend online');

    await fireEvent.press(screen.getByLabelText('Create a party'));
    expect(mockPush).toHaveBeenLastCalledWith('/party');

    await fireEvent.press(screen.getByLabelText('Try an entity search'));
    expect(mockPush).toHaveBeenLastCalledWith('/search');

    await fireEvent.press(screen.getByLabelText(/^Connection status\./));
    expect(mockPush).toHaveBeenLastCalledWith('/status');
  });

  it('does not re-request status when the screen re-renders or the user navigates', async () => {
    const fetchMock = backendUp();
    const view = await renderWithStatus(<HomeScreen />);
    await screen.findByText('Qloo: Not configured');
    const calls = fetchMock.mock.calls.length;
    await view.rerender(<HomeScreen />);
    await fireEvent.press(screen.getByLabelText('Try an entity search'));
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it('exposes accessible roles and labels', async () => {
    backendUp();
    await renderWithStatus(<HomeScreen />);
    await screen.findByText('Backend online');
    expect(screen.getByLabelText('Try an entity search').props.accessibilityRole).toBe('button');
    expect(screen.getByLabelText(/^Connection status\./).props.accessibilityRole).toBe('button');
    expect(screen.getAllByRole('header').length).toBeGreaterThan(1);
  });
});
