'use client';
import { ApiError } from './api';

/**
 * Wrap an API call so that genuine network failures (server not reachable)
 * silently fall back to a provided mock value. We DO surface real backend
 * errors (4xx/5xx) — those are bugs and the UI should show the ErrorBanner.
 *
 * Set NEXT_PUBLIC_DISABLE_MOCK_FALLBACK=true to disable the fallback (use in
 * staging/prod where we want to see network failures loudly).
 */
export async function withMockFallback<T>(real: () => Promise<T>, mock: T): Promise<T> {
  try {
    return await real();
  } catch (err) {
    const isReachable = err instanceof ApiError;
    const disableFallback = process.env.NEXT_PUBLIC_DISABLE_MOCK_FALLBACK === 'true';
    if (isReachable || disableFallback) throw err;
    if (typeof console !== 'undefined') {
      console.warn('[api] backend unreachable, using mock data:', (err as Error).message);
    }
    return mock;
  }
}
