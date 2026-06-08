/**
 * Sentry — client side. Disabled unless NEXT_PUBLIC_SENTRY_DSN is set, so the
 * dev stack runs cleanly without a Sentry project.
 *
 * Sample rates default to safe production values:
 *   - tracesSampleRate 0.1  → 10% of transactions sampled.
 *   - replaysSessionSampleRate 0 → no full-session replays by default
 *     (they're privacy-sensitive on a procurement app — opt in by org).
 *   - replaysOnErrorSampleRate 1.0 → record up to 60s before each error.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES ?? 0.1),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
  });
}
