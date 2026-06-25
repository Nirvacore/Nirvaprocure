import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PG_POOL } from '../../common/db/db.module';

const ORG_ID = 'org-1';
const USER = { orgId: ORG_ID, userId: 'u-1', email: 'test@test.com', role: 'admin' } as any;

function mockPool(queryResponses: any[]) {
  let callIdx = 0;
  const mockClient = {
    query: jest.fn().mockImplementation(() => {
      const resp = queryResponses[callIdx] ?? { rows: [], rowCount: 0 };
      callIdx++;
      return Promise.resolve(resp);
    }),
    release: jest.fn(),
  };
  return { connect: jest.fn().mockResolvedValue(mockClient), client: mockClient };
}

describe('AnalyticsService', () => {
  describe('summary', () => {
    it('should return MTD analytics summary', async () => {
      const pool = mockPool([
        { rows: [] }, // BEGIN
        { rows: [] }, // SET LOCAL
        { rows: [{ month_start: '2026-06-01' }] }, // month_start
        // The next 5 are parallel Promise.all queries:
        { rows: [{ status: 'approved', n: '12' }, { status: 'draft', n: '3' }] }, // counts
        { rows: [{ total: '150000' }] }, // spend
        { rows: [{ avg_hours: '4.5' }] }, // sla
        { rows: [{ name: 'Acme', spend_minor: '100000', po_count: '5' }] }, // suppliers
        { rows: [{ department: 'IT', spend_minor: '80000', pr_count: '8' }] }, // byDept
        { rows: [] }, // COMMIT
      ]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [AnalyticsService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      const service = module.get(AnalyticsService);

      const result = await service.summary(USER);

      expect(result.month_start).toBe('2026-06-01');
      expect(result.approved_spend_minor).toBe(150000);
      expect(result.avg_approval_hours).toBe(4.5);
      expect(result.top_suppliers).toHaveLength(1);
      expect(result.by_department).toHaveLength(1);
    });

    it('should handle null avg_approval_hours', async () => {
      const pool = mockPool([
        { rows: [] }, { rows: [] },
        { rows: [{ month_start: '2026-06-01' }] },
        { rows: [] }, // no counts
        { rows: [{ total: '0' }] },
        { rows: [{ avg_hours: null }] },
        { rows: [] }, // no suppliers
        { rows: [] }, // no depts
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [AnalyticsService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      const service = module.get(AnalyticsService);

      const result = await service.summary(USER);

      expect(result.avg_approval_hours).toBeNull();
      expect(result.approved_spend_minor).toBe(0);
    });
  });
});
