import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/services/apiClient';
import { integrationApi } from '@/services/integrationApi';
import type { EntitySearchResponse } from '@/types/api';

export function useEntitySearch() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EntitySearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const last = useRef<{ query: string; types?: string[] } | null>(null);
  const seq = useRef(0);

  const search = useCallback(async (query: string, types?: string[]) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    last.current = { query: trimmed, types };
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const response = await integrationApi.searchEntities(trimmed, { types });
      if (mine === seq.current) setResult(response);
    } catch (e) {
      if (mine !== seq.current) return;
      setResult(null);
      setError(e instanceof ApiError ? e.message : 'Something unexpected happened.');
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  /** Repeats the last search as a genuine new request. */
  const retry = useCallback(async () => {
    if (last.current) await search(last.current.query, last.current.types);
  }, [search]);

  return { loading, result, error, search, retry };
}
