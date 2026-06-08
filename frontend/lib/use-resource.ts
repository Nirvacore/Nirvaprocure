'use client';
import { useEffect, useState, useCallback } from 'react';
import { ApiError } from './api';

export interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | Error | null;
  refresh: () => Promise<void>;
}

/**
 * Tiny client-side data loader. Calls `fetcher` on mount and whenever the
 * `deps` array changes; exposes loading/error/refresh. Production should
 * graduate to React Query / SWR for caching + revalidation.
 */
export function useResource<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): ResourceState<T> {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<ApiError | Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err as ApiError | Error);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
