import { ApiError } from './api';
import { withMockFallback } from './api-with-fallback';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

  it('keeps core procurement page fixtures lazy', () => {
    const pageSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

    expect(pageSource('app/pr/page.tsx')).toContain('loadDemoPrPage');
    expect(pageSource('app/pr/[id]/page.tsx')).toContain('loadDemoPrDetail');
    expect(pageSource('app/approvals/page.tsx')).toContain('loadDemoApprovalInbox');
    expect(pageSource('app/page.tsx')).toContain("import('@/lib/dashboard-demo-fixtures')");
    expect(pageSource('app/analytics/page.tsx')).toContain("import('@/lib/dashboard-demo-fixtures')");
    expect(pageSource('app/search/page.tsx')).toContain("import('@/lib/search-demo-fixtures')");
    expect(pageSource('app/po/[id]/page.tsx')).toContain("import('@/lib/po-demo-fixtures')");
    expect(pageSource('app/po/[id]/page.tsx')).not.toContain('const MOCK_POS');
    expect(pageSource('app/stock/page.tsx')).toContain("import('@/lib/stock-demo-fixtures')");
    expect(pageSource('app/stock/page.tsx')).not.toContain('const MOCK_WAREHOUSES');
    expect(pageSource('app/stock/page.tsx')).not.toContain('const MOCK_ON_HAND');
    expect(pageSource('app/settings/page.tsx')).toContain("import('@/lib/settings-demo-fixtures')");
    expect(pageSource('app/settings/page.tsx')).not.toContain('mockWorkflows');
    expect(pageSource('app/settings/page.tsx')).not.toContain('mockUsers');
    expect(pageSource('app/settings/page.tsx')).not.toContain('mockDepartments');
    expect(pageSource('app/budget/page.tsx')).toContain("import('@/lib/budget-demo-fixtures')");
    expect(pageSource('app/budget/page.tsx')).not.toContain('MOCK_DEPT_BUDGETS');
    expect(pageSource('app/budget/page.tsx')).not.toContain('MOCK_DEPARTMENTS');
    expect(pageSource('app/audit/page.tsx')).toContain("import('@/lib/audit-demo-fixtures')");
    expect(pageSource('app/audit/page.tsx')).not.toContain('const MOCK_AUDIT');
    expect(pageSource('app/receive/page.tsx')).toContain("import('@/lib/receive-demo-fixtures')");
    expect(pageSource('app/receive/page.tsx')).not.toContain('const MOCK_APPROVED');
    expect(pageSource('app/receive/page.tsx')).not.toContain('const MOCK_DETAILS');
  });

  it('loads core procurement fixture data only through dynamic imports', () => {
    const fixtureLoader = readFileSync(resolve(process.cwd(), 'lib/core-procurement-demo-fixtures.ts'), 'utf8');
    expect(fixtureLoader).not.toMatch(/^import\s+[^t].*mock-data/m);
    expect(fixtureLoader.match(/await import\('\.\/mock-data'\)/g)).toHaveLength(3);
  });
});
