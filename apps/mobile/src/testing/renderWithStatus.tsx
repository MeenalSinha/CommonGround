/** Test-only: renders a screen inside the same providers the real app layout uses. */
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { BackendStatusProvider } from '@/hooks/BackendStatusContext';
import { PartyProvider } from '@/state/PartyContext';
import type { PartyState } from '@/state/party';

export function renderWithStatus(ui: ReactElement, initialState?: PartyState) {
  return render(
    <BackendStatusProvider>
      <PartyProvider initialState={initialState}>{ui}</PartyProvider>
    </BackendStatusProvider>,
  );
}
