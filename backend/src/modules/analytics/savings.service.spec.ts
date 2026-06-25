import { Test, TestingModule } from '@nestjs/testing';
import { SavingsService } from './savings.service';
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

describe('SavingsService', () => {
  describe('recompute', () => {
    it('should return rows logged count', async () => {
      const pool = mockPool([
        { rows: [] }, // BEGIN
        { rows: [] }, // SET LOCAL
        { rows: [], rowCount: 7 }, // INSERT
        { rows: [] }, // COMMIT
      ]);
      const module = await Test.createTestingModule({
        providers: [SavingsService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      const service = module.get(SavingsService);

      const result = await service.recompute(ORG_ID);
      expect(result.rows_logged).toBe(7);
    });

    it('should return 0 when no savings found', async () => {
      const pool = mockPool([
        { rows: [] }, { rows: [] },
        { rows: [], rowCount: 0 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [SavingsService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      const service = module.get(SavingsService);

      const result = await service.recompute(ORG_ID);
      expect(result.rows_logged).toBe(0);
    });
  });

  describe('leaderboard', () => {
    it('should return ranked users', async () => {
      const pool = mockPool([
        { rows: [] }, { rows: [] },
        { rows: [
          { user_id: 'u-1', full_name: 'Alice', total: '50000', pr_count: '3', badges: ['top_saver'] },
          { user_id: 'u-2', full_name: 'Bob', total: '30000', pr_count: '2', badges: [] },
        ]},
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [SavingsService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      const service = module.get(SavingsService);

      const result = await service.leaderboard(USER);
      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
      expect(result[0].total_savings_minor).toBe(50000);
      expect(result[1].rank).toBe(2);
    });
  });

  describe('selfSummary', () => {
    it('should return personal savings summary', async () => {
      const pool = mockPool([
        { rows: [] }, { rows: [] },
        { rows: [{ total: '25000', pr_count: '4' }] }, // totals
        { rows: [{ rank: 3 }] }, // rank
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [SavingsService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      const service = module.get(SavingsService);

      const result = await service.selfSummary(USER);
      expect(result.savings_minor).toBe(25000);
      expect(result.pr_count).toBe(4);
      expect(result.rank).toBe(3);
    });

    it('should return null rank when no savings', async () => {
      const pool = mockPool([
        { rows: [] }, { rows: [] },
        { rows: [{ total: '0', pr_count: '0' }] },
        { rows: [] }, // no rank row
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [SavingsService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      const service = module.get(SavingsService);

      const result = await service.selfSummary(USER);
      expect(result.savings_minor).toBe(0);
      expect(result.rank).toBeNull();
    });
  });

  describe('recomputeAllOrgs', () => {
    it('should iterate all orgs', async () => {
      const pool = mockPool([]);
      pool.connect = jest.fn().mockImplementation(async () => {
        let idx = 0;
        const responses = [
          { rows: [] }, { rows: [] },
          { rows: [], rowCount: 0 },
          { rows: [] },
        ];
        return {
          query: jest.fn().mockImplementation(() => Promise.resolve(responses[idx++] ?? { rows: [], rowCount: 0 })),
          release: jest.fn(),
        };
      });
      (pool as any).query = jest.fn().mockResolvedValue({ rows: [{ id: 'org-1' }] });

      const module = await Test.createTestingModule({
        providers: [SavingsService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      const service = module.get(SavingsService);

      await service.recomputeAllOrgs();
      expect((pool as any).query).toHaveBeenCalledWith(expect.stringContaining('organizations'));
    });
  });
});
