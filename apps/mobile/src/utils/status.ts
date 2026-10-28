import type { BackendState, BackendStatusModel } from '@/hooks/useBackendStatus';
import type { IntegrationState } from '@/types/api';
import type { PillTone } from '@/components/StatusPill';

export interface PillSpec {
  label: string;
  tone: PillTone;
}

/** Labels come from the backend's evidence-based state, never from key presence alone. */
export const QLOO_LABELS: Record<IntegrationState, PillSpec> = {
  not_configured: { label: 'Not configured', tone: 'warn' },
  pending_verification: { label: 'Awaiting verification', tone: 'warn' },
  ready: { label: 'Verified and ready', tone: 'good' },
  auth_failed: { label: 'Authentication failed', tone: 'bad' },
  rate_limited: { label: 'Rate limited', tone: 'warn' },
  unavailable: { label: 'Unavailable', tone: 'bad' },
};

export function backendPill(state: BackendState): PillSpec {
  if (state === 'online') return { label: 'Backend online', tone: 'good' };
  if (state === 'offline') return { label: 'Backend offline', tone: 'bad' };
  return { label: 'Checking backend', tone: 'neutral' };
}

export function qlooPill(model: Pick<BackendStatusModel, 'backend' | 'qloo'>): PillSpec {
  if (model.backend === 'offline') return { label: 'Unknown', tone: 'neutral' };
  if (model.qloo) return QLOO_LABELS[model.qloo.state];
  return { label: 'Checking', tone: 'neutral' };
}

export interface SearchAvailability {
  enabled: boolean;
  /** Present only when search is unavailable. */
  reason: string | null;
}

export function searchAvailability(
  model: Pick<BackendStatusModel, 'backend' | 'qloo'>,
): SearchAvailability {
  if (model.backend === 'checking') {
    return { enabled: false, reason: 'Checking the connection before search is available.' };
  }
  if (model.backend === 'offline') {
    return { enabled: false, reason: 'Search is unavailable until the backend is reachable.' };
  }
  if (!model.qloo) {
    return {
      enabled: false,
      reason: 'Search is unavailable because the Qloo status could not be read.',
    };
  }
  if (!model.qloo.configured) {
    return {
      enabled: false,
      reason: 'Search is unavailable until a Qloo key is configured on the backend.',
    };
  }
  return { enabled: true, reason: null };
}
