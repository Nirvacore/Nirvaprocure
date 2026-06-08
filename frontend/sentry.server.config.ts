/**
 * Sentry — server side (Node runtime for SSR/RSC). Same opt-in model: no DSN
 * means no init, so dev stays clean.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES ?? 0.1),
  });
}
