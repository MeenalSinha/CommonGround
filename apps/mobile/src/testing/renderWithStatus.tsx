/** Test-only: renders a screen inside the same providers the real app layout uses. */
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { BackendStatusProvider } from '@/hooks/BackendStatusContext';
import { PartyProvider } from '@/state/PartyContext';
import type { PartyState } from '@/state/party';

/**
 * Providers are installed through `wrapper`, so `rerender(ui)` keeps them. (Wrapping `ui` directly
 * made rerender drop the providers, which broke the Phase 3 HomeScreen rerender test.)
 */
export function renderWithStatus(ui: ReactElement, initialState?: PartyState) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <BackendStatusProvider>
        <PartyProvider initialState={initialState}>{children}</PartyProvider>
      </BackendStatusProvider>
    );
  }
  return render(ui, { wrapper: Wrapper });
}
