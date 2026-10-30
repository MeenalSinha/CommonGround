import { fireEvent, screen } from '@testing-library/react-native';
import { PrivacyPanel } from '@/components/PrivacyPanel';
import { renderWithStatus } from '@/testing/renderWithStatus';
import { seedParty } from '@/testing/fixtures';

describe('PrivacyPanel', () => {
  it('renders privacy explanations and disabled clear button when empty', async () => {
    await renderWithStatus(<PrivacyPanel />);
    expect(screen.getByText('Privacy & data handling')).toBeTruthy();
    expect(screen.getByText('Local-only storage')).toBeTruthy();
    expect(screen.getByText('No cloud sync or user accounts')).toBeTruthy();
    expect(screen.getByText('Qloo cultural intelligence')).toBeTruthy();
    const button = screen.getByLabelText('Clear all local data');
    expect(button.props.accessibilityState.disabled).toBe(true);
  });

  it('enables clear button when party exists, prompts confirmation and wipes data', async () => {
    const partyState = seedParty([{ name: 'Alice' }]);
    await renderWithStatus(<PrivacyPanel />, partyState);
    const clearBtn = screen.getByLabelText('Clear all local data');
    expect(clearBtn.props.accessibilityState.disabled).toBe(false);

    await fireEvent.press(clearBtn);
    expect(await screen.findByText(/Are you sure\? This permanently deletes/i)).toBeTruthy();

    const confirmBtn = screen.getByLabelText('Yes, delete all data');
    await fireEvent.press(confirmBtn);

    expect(await screen.findByText('Local party and plan data cleared successfully.')).toBeTruthy();
  });
});
