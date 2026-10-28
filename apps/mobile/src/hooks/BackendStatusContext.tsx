import { createContext, useContext, type ReactNode } from 'react';
import { useBackendStatus, type BackendStatusModel } from './useBackendStatus';

const BackendStatusContext = createContext<BackendStatusModel | null>(null);

/**
 * Owns the single status check for the whole app so every screen shares one source of truth and
 * navigating between screens never triggers another network request.
 */
export function BackendStatusProvider({ children }: { children: ReactNode }) {
  const model = useBackendStatus();
  return <BackendStatusContext.Provider value={model}>{children}</BackendStatusContext.Provider>;
}

export function useBackendStatusModel(): BackendStatusModel {
  const model = useContext(BackendStatusContext);
  if (!model) throw new Error('useBackendStatusModel must be used inside BackendStatusProvider');
  return model;
}
