import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/services/apiClient';
import { integrationApi } from '@/services/integrationApi';
import type { QlooStatus } from '@/types/api';

export type BackendState = 'checking' | 'online' | 'offline';

export interface BackendStatusModel {
  backend: BackendState;
  backendMessage: string | null;
  qloo: QlooStatus | null;
  qlooError: string | null;
  refreshing: boolean;
  verifying: boolean;
  refresh: () => Promise<void>;
  verify: () => Promise<void>;
}

function describe(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something unexpected happened.';
}

/**
 * Reads real status from the backend. Nothing here fabricates a result: on any failure the
 * status stays unknown or failed. Status is fetched on mount and on explicit refresh only
 * (no polling, and never an upstream Qloo call except through verify()).
 */
export function useBackendStatus(): BackendStatusModel {
  const [backend, setBackend] = useState<BackendState>('checking');
  const [backendMessage, setBackendMessage] = useState<string | null>(null);
  const [qloo, setQloo] = useState<QlooStatus | null>(null);
  const [qlooError, setQlooError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true); // the first check starts on mount
  const [verifying, setVerifying] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      await integrationApi.health();
      if (!mounted.current) return;
      setBackend('online');
    } catch (error) {
      if (!mounted.current) return;
      setBackend('offline');
      setBackendMessage(describe(error));
      setQloo(null);
      setRefreshing(false);
      return;
    }
    try {
      const status = await integrationApi.qlooStatus();
      if (mounted.current) setQloo(status);
    } catch (error) {
      if (mounted.current) {
        setQloo(null);
        setQlooError(describe(error));
      }
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setBackendMessage(null);
    setQlooError(null);
    await load();
  }, [load]);

  const verify = useCallback(async () => {
    setVerifying(true);
    setQlooError(null);
    try {
      const status = await integrationApi.verifyQloo();
      if (mounted.current) setQloo(status);
    } catch (error) {
      if (!mounted.current) return;
      setQlooError(describe(error));
      try {
        // Re-read the backend's own evidence-based status (it tracks auth failures etc.).
        const status = await integrationApi.qlooStatus();
        if (mounted.current) setQloo(status);
      } catch {
        /* keep the previous status; the error above is already shown */
      }
    } finally {
      if (mounted.current) setVerifying(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    // Deferred one tick so the initial network check is not a synchronous state update in an effect.
    const timer = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(timer);
      mounted.current = false;
    };
  }, [load]);

  return { backend, backendMessage, qloo, qlooError, refreshing, verifying, refresh, verify };
}
