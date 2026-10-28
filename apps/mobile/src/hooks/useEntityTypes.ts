import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/services/apiClient';
import { integrationApi } from '@/services/integrationApi';

/** Loads the backend's supported entity types once the backend is reachable. */
export function useEntityTypes(backendOnline: boolean) {
  const [types, setTypes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await integrationApi.entityTypes();
      if (mounted.current) setTypes(response.types);
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof ApiError ? e.message : 'Something unexpected happened.');
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!backendOnline || types !== null) return;
    const timer = setTimeout(() => void load(), 0);
    return () => {
      clearTimeout(timer);
      mounted.current = false;
    };
  }, [backendOnline, types, load]);

  return { types, loading, error, reload: load };
}
