import { fireEvent, screen } from '@testing-library/react-native';
import { PartyScreen } from '@/screens/PartyScreen';
import { entity, seedParty } from '@/testing/fixtures';
import { health, jsonResponse, mockBackend, qlooStatus } from '@/testing/mockBackend';
import { renderWithStatus } from '@/testing/renderWithStatus';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }));

beforeEach(() => {
  mockPush.mockClear();
  mockBackend({
    'GET /health': () => jsonResponse(health),
    'GET /api/v1/integrations/qloo/status': () => jsonResponse(qlooStatus()),
  });
});
afterEach(() => jest.restoreAllMocks());

describe('PartyScreen', () => {
  it('starts with a create form and no prepopulated party or people', async () => {
    await renderWithStatus(<PartyScreen />);
    expect(screen.getByText('Start your party')).toBeTruthy();
    expect(screen.queryByLabelText('Add to party')).toBeNull();
  });

  it('validates the party name, then creates the party with the trimmed name', async () => {
    await renderWithStatus(<PartyScreen />);
    await fireEvent.changeText(screen.getByLabelText('Party name'), '   ');
    await fireEvent.press(screen.getByLabelText('Create party'));
    expect(await screen.findByText('Please enter a party name.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Party name'), '  Friday crew ');
    await fireEvent.press(screen.getByLabelText('Create party'));
    expect(await screen.findByText('Friday crew')).toBeTruthy();
    expect(screen.getByText(/No one here yet/)).toBeTruthy();
  });

  it('a double press on Create makes one party', async () => {
    await renderWithStatus(<PartyScreen />);
    await fireEvent.changeText(screen.getByLabelText('Party name'), 'Crew');
    const button = screen.getByLabelText('Create party');
    await fireEvent.press(button);
    await fireEvent.press(button);
    expect(screen.getAllByText('Crew')).toHaveLength(1);
  });

  it('adds people, rejects empty and duplicate names, and shows success', async () => {
    await renderWithStatus(<PartyScreen />, seedParty([]));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Ann');
    await fireEvent.press(screen.getByLabelText('Add to party'));
    expect(await screen.findByText('Ann joined the party.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Name'), 'ann');
    await fireEvent.press(screen.getByLabelText('Add to party'));
    expect(await screen.findByText(/already has that name/)).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Name'), '  ');
    await fireEvent.press(screen.getByLabelText('Add to party'));
    expect(await screen.findByText('Please enter a name.')).toBeTruthy();
  });

  it('shows real interest counts and an empty state for incomplete profiles', async () => {
    await renderWithStatus(
      <PartyScreen />,
      seedParty([{ name: 'Ann', interests: [entity('A', 'Alpha')] }, { name: 'Bo' }]),
    );
    expect(screen.getByText(/2 people/)).toBeTruthy();
    expect(screen.getByText(/1 interest/)).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText(/No interests yet/)).toBeTruthy();
  });

  it('removes a person only after confirmation', async () => {
    await renderWithStatus(<PartyScreen />, seedParty([{ name: 'Ann' }, { name: 'Bo' }]));
    await fireEvent.press(screen.getByLabelText('Remove Bo'));
    expect(screen.getByText('Bo')).toBeTruthy(); // still there
    await fireEvent.press(screen.getByLabelText('Confirm remove Bo'));
    expect(screen.queryByText('Bo')).toBeNull();
    expect(screen.getByText('Ann')).toBeTruthy();
  });

  it('renames the party and rejects an empty name', async () => {
    await renderWithStatus(<PartyScreen />, seedParty([], 'Old'));
    await fireEvent.press(screen.getByLabelText('Rename party'));
    await fireEvent.changeText(screen.getByLabelText('Party name'), ' ');
    await fireEvent.press(screen.getByLabelText('Save name'));
    expect(await screen.findByText('Please enter a party name.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Party name'), 'New');
    await fireEvent.press(screen.getByLabelText('Save name'));
    expect(await screen.findByText('New')).toBeTruthy();
  });

  it('opens a profile and gates discovery on having two people', async () => {
    await renderWithStatus(<PartyScreen />, seedParty([{ name: 'Ann' }]));
    expect(screen.getByLabelText('Continue to discovery').props.accessibilityState.disabled).toBe(
      true,
    );
    await fireEvent.press(screen.getByLabelText("Open Ann's profile"));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/member/[id]', params: { id: 'm1' } });
  });

  it('navigates to discovery once two people are present', async () => {
    await renderWithStatus(<PartyScreen />, seedParty([{ name: 'Ann' }, { name: 'Bo' }]));
    await fireEvent.press(screen.getByLabelText('Continue to discovery'));
    expect(mockPush).toHaveBeenLastCalledWith('/discover');
  });

  it('starting over needs confirmation and returns to the create form', async () => {
    await renderWithStatus(<PartyScreen />, seedParty([{ name: 'Ann' }]));
    await fireEvent.press(screen.getByLabelText('Start over'));
    await fireEvent.press(screen.getByLabelText('Yes, start over'));
    expect(await screen.findByText('Start your party')).toBeTruthy();
  });
});
