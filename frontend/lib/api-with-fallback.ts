'use client';

/**
 * A deliberately generic error for unavailable or malformed API data. Keeping
 * the original backend error out of the UI avoids exposing response details.
 */
export class ProcureDataUnavailableError extends Error {
  readonly code = 'PROCURE_DATA_UNAVAILABLE';

  constructor() {
    super('Procurement data is temporarily unavailable. Please try again.');
    this.name = 'ProcureDataUnavailableError';
  }
}

/** Demo data can only be enabled during a local development build. */
export function isLocalDemoMode(): boolean {
  return process.env.NODE_ENV === 'development'
    && process.env.NEXT_PUBLIC_ENABLE_LOCAL_DEMO === 'true';
}

/**
 * Fail closed when the backend cannot supply trusted data. Callers can pass a
 * lazy fixture supplier when they need to prove that a non-demo path did not
 * read demo data.
 */
export async function withMockFallback<T>(
  real: () => Promise<T>,
  demoFixture: T | (() => T | Promise<T>),
): Promise<T> {
  try {
    return await real();
  } catch {
    if (isLocalDemoMode()) {
      return typeof demoFixture === 'function'
        ? await (demoFixture as () => T | Promise<T>)()
        : demoFixture;
    }
    throw new ProcureDataUnavailableError();
  }
}
