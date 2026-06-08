'use client';
import { useEffect, useRef, useState } from 'react';
import { mockInbox } from './mock-data';
import { approvals } from './api';
import { ApiError } from './api';

const POLL_MS = 30_000;
const BASE    = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/v1';

/**
 * Live inbox count for the header badge.
 *
 * Strategy:
 *   1. Open an SSE stream against /approvals/stream (single connection per tab).
 *   2. If SSE fails or the browser doesn't have EventSource, fall back to
 *      polling /approvals/inbox every 30s.
 *
 * Either way, when the count increases we briefly flip `bumped` so the badge
 * can fire a one-shot ping animation.
 */
export function useInboxCount(): { count: number; bumped: boolean } {
  const [count, setCount]   = useState<number>(mockInbox.length);
  const [bumped, setBumped] = useState(false);
  const prev = useRef(count);

  useEffect(() => {
    const apply = (next: number) => {
      setCount(next);
      if (next > prev.current) {
        setBumped(true);
        setTimeout(() => setBumped(false), 1500);
      }
      prev.current = next;
    };

    // 1) Try SSE first. Browsers attach cookies automatically.
    if (typeof EventSource !== 'undefined') {
      const es = new EventSource(`${BASE}/approvals/stream`, { withCredentials: true });
      es.addEventListener('inbox.count', (ev) => {
        try {
          const { count: c } = JSON.parse((ev as MessageEvent).data) as { count: number };
          apply(c);
        } catch { /* ignore malformed event */ }
      });
      // If the stream errors out (e.g. server didn't implement it yet) fall
      // through to polling. EventSource auto-reconnects on transient errors;
      // we only switch to polling on persistent failure.
      let polling: ReturnType<typeof setInterval> | null = null;
      let failedOnce = false;
      es.addEventListener('error', () => {
        if (failedOnce && !polling) {
          es.close();
          polling = setInterval(poll, POLL_MS);
          void poll();
        }
        failedOnce = true;
      });
      return () => { es.close(); if (polling) clearInterval(polling); };
    }

    // 2) Polling fallback (no EventSource in this runtime).
    const timer = setInterval(poll, POLL_MS);
    void poll();
    return () => clearInterval(timer);

    async function poll() {
      try {
        const inbox = await approvals.inbox();
        apply(inbox.length);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // Not logged in — stop trying; AuthProvider will redirect.
        }
      }
    }
  }, []);

  return { count, bumped };
}
