import { ApiError } from './api';
import { withMockFallback } from './api-with-fallback';

const originalNodeEnv = process.env.NODE_ENV;
const originalDemoFlag = process.env.NEXT_PUBLIC_ENABLE_LOCAL_DEMO;

function restoreEnvironment() {
  process.env.NODE_ENV = originalNodeEnv;
  if (originalDemoFlag === undefined) delete process.env.NEXT_PUBLIC_ENABLE_LOCAL_DEMO;
  else process.env.NEXT_PUBLIC_ENABLE_LOCAL_DEMO = originalDemoFlag;
}

describe('withMockFallback', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.NEXT_PUBLIC_ENABLE_LOCAL_DEMO;
  });

  afterEach(restoreEnvironment);

  it.each([
    ['a backend error', new ApiError(503, 'SERVICE_UNAVAILABLE', 'backend response')],
    ['a timeout', new Error('request timed out')],
    ['an invalid backend payload', new SyntaxError('unexpected response body')],
  ])('fails closed for %s without reading demo data', async (_caseName, failure) => {
    let fixtureReads = 0;

    await expect(withMockFallback(
      async () => { throw failure; },
      () => { fixtureReads += 1; return { source: 'demo' }; },
    )).rejects.toMatchObject({
      name: 'ProcureDataUnavailableError',
      code: 'PROCURE_DATA_UNAVAILABLE',
      message: 'Procurement data is temporarily unavailable. Please try again.',
    });

    expect(fixtureReads).toBe(0);
  });

  it('fails closed in a production build even when the demo flag is set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_DEMO = 'true';
    let fixtureReads = 0;

    await expect(withMockFallback(
      async () => { throw new Error('offline'); },
      () => { fixtureReads += 1; return { source: 'demo' }; },
    )).rejects.toMatchObject({ code: 'PROCURE_DATA_UNAVAILABLE' });

    expect(fixtureReads).toBe(0);
  });

  it('uses demo data only after an explicit local demo opt-in', async () => {
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_DEMO = 'true';
    let fixtureReads = 0;

    await expect(withMockFallback(
      async () => { throw new Error('offline'); },
      () => { fixtureReads += 1; return { source: 'demo' }; },
    )).resolves.toEqual({ source: 'demo' });

    expect(fixtureReads).toBe(1);
  });
});
