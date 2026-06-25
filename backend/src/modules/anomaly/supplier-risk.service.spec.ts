import { Test, TestingModule } from '@nestjs/testing';
import { SupplierRiskService, SupplierRiskRow } from './supplier-risk.service';
import { PG_POOL } from '../../common/db/db.module';

const ORG_ID = 'org-1';
const USER = { orgId: ORG_ID, userId: 'u-1', email: 'test@test.com', role: 'admin' } as any;

const riskRow = {
  supplier_id: 'sup-1',
  supplier_name: 'Acme Corp',
  score: 62,
  tier: 'high' as const,
  factors: JSON.stringify({
    spend_minor: 500000,
    spend_pct: 45.2,
    price_cov: 12.3,
    rejection_rate: 5.0,
    has_coi: false,
    anomaly_count_90d: 2,
  }),
  computed_at: '2026-06-20T10:00:00Z',
};

const riskRow2 = {
  supplier_id: 'sup-2',
  supplier_name: 'Beta Supplies',
  score: 28,
  tier: 'low' as const,
  factors: {
    spend_minor: 100000,
    spend_pct: 8.1,
    price_cov: 5.0,
    rejection_rate: 0.0,
    has_coi: false,
    anomaly_count_90d: 0,
  },
  computed_at: '2026-06-20T10:00:00Z',
};

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
  return {
    connect: jest.fn().mockResolvedValue(mockClient),
    client: mockClient,
    // Direct pool.query for compute() — separate from client.query
    query: jest.fn(),
  };
}

describe('SupplierRiskService', () => {
  let service: SupplierRiskService;
  let pool: ReturnType<typeof mockPool>;

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------
  describe('list', () => {
    it('should return risk rows with parsed factors (string)', async () => {
      pool = mockPool([
        { rows: [] },                              // BEGIN
        { rows: [] },                              // SET LOCAL
        { rows: [riskRow], rowCount: 1 },           // SELECT
        { rows: [] },                              // COMMIT
      ]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      const result = await service.list(USER);
      expect(result).toHaveLength(1);
      expect(result[0].supplier_id).toBe('sup-1');
      expect(result[0].supplier_name).toBe('Acme Corp');
      expect(result[0].score).toBe(62);
      expect(result[0].tier).toBe('high');
      expect(result[0].factors.spend_minor).toBe(500000);
      expect(result[0].factors.has_coi).toBe(false);
    });

    it('should handle factors already parsed as object', async () => {
      pool = mockPool([
        { rows: [] },
        { rows: [] },
        { rows: [riskRow2], rowCount: 1 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      const result = await service.list(USER);
      expect(result).toHaveLength(1);
      expect(result[0].factors.spend_pct).toBe(8.1);
    });

    it('should return empty array when no scores exist', async () => {
      pool = mockPool([
        { rows: [] },
        { rows: [] },
        { rows: [], rowCount: 0 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      const result = await service.list(USER);
      expect(result).toEqual([]);
    });

    it('should coerce score to number', async () => {
      const rowWithStringScore = { ...riskRow, score: '75' };
      pool = mockPool([
        { rows: [] },
        { rows: [] },
        { rows: [rowWithStringScore], rowCount: 1 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      const result = await service.list(USER);
      expect(result[0].score).toBe(75);
      expect(typeof result[0].score).toBe('number');
    });

    it('should pass orgId as query parameter', async () => {
      pool = mockPool([
        { rows: [] },
        { rows: [] },
        { rows: [], rowCount: 0 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      await service.list(USER);
      // Third call (index 2) is the actual SELECT query
      const selectCall = pool.client.query.mock.calls[2];
      expect(selectCall[1]).toEqual([ORG_ID]);
    });
  });

  // ---------------------------------------------------------------------------
  // getForSupplier
  // ---------------------------------------------------------------------------
  describe('getForSupplier', () => {
    it('should return risk row for a specific supplier', async () => {
      pool = mockPool([
        { rows: [] },
        { rows: [] },
        { rows: [riskRow], rowCount: 1 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      const result = await service.getForSupplier(USER, 'sup-1');
      expect(result).not.toBeNull();
      expect(result!.supplier_id).toBe('sup-1');
      expect(result!.score).toBe(62);
      expect(result!.factors.spend_minor).toBe(500000);
    });

    it('should return null when supplier has no score', async () => {
      pool = mockPool([
        { rows: [] },
        { rows: [] },
        { rows: [], rowCount: 0 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      const result = await service.getForSupplier(USER, 'sup-nonexistent');
      expect(result).toBeNull();
    });

    it('should pass orgId and supplierId as query parameters', async () => {
      pool = mockPool([
        { rows: [] },
        { rows: [] },
        { rows: [], rowCount: 0 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      await service.getForSupplier(USER, 'sup-42');
      const selectCall = pool.client.query.mock.calls[2];
      expect(selectCall[1]).toEqual([ORG_ID, 'sup-42']);
    });

    it('should handle factors as pre-parsed object', async () => {
      pool = mockPool([
        { rows: [] },
        { rows: [] },
        { rows: [riskRow2], rowCount: 1 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      const result = await service.getForSupplier(USER, 'sup-2');
      expect(result).not.toBeNull();
      expect(result!.factors.anomaly_count_90d).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // compute
  // ---------------------------------------------------------------------------
  describe('compute', () => {
    function buildComputePool(scoredRows: any[]) {
      const p = mockPool([]);
      // compute() uses pool.query directly (not withOrg)
      // First call: the big CTE SELECT
      // Second call: the INSERT ... ON CONFLICT upsert
      let queryIdx = 0;
      p.query.mockImplementation(() => {
        if (queryIdx === 0) {
          queryIdx++;
          return Promise.resolve({ rows: scoredRows, rowCount: scoredRows.length });
        }
        queryIdx++;
        return Promise.resolve({ rows: [], rowCount: scoredRows.length });
      });
      return p;
    }

    it('should compute and upsert scores for a specific org', async () => {
      const scoredRows = [
        {
          org_id: ORG_ID,
          supplier_id: 'sup-1',
          score: 45,
          factors: { spend_minor: 300000, spend_pct: 30.0, price_cov: 10.0, rejection_rate: 5.0, has_coi: false, anomaly_count_90d: 1 },
        },
        {
          org_id: ORG_ID,
          supplier_id: 'sup-2',
          score: 80,
          factors: { spend_minor: 800000, spend_pct: 60.0, price_cov: 35.0, rejection_rate: 25.0, has_coi: true, anomaly_count_90d: 6 },
        },
      ];
      pool = buildComputePool(scoredRows);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      const count = await service.compute(ORG_ID);
      expect(count).toBe(2);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when no scoreable suppliers found', async () => {
      pool = buildComputePool([]);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      const count = await service.compute(ORG_ID);
      expect(count).toBe(0);
      // Only the SELECT query should have been called, not the upsert
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it('should handle null orgId for all-org recompute', async () => {
      const scoredRows = [
        {
          org_id: 'org-a',
          supplier_id: 'sup-x',
          score: 20,
          factors: { spend_minor: 50000, spend_pct: 5.0, price_cov: 2.0, rejection_rate: 0.0, has_coi: false, anomaly_count_90d: 0 },
        },
      ];
      pool = buildComputePool(scoredRows);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      const count = await service.compute(null);
      expect(count).toBe(1);
      // The CTE query should NOT contain org-specific filter
      const selectSql: string = pool.query.mock.calls[0][0];
      expect(selectSql).not.toContain("pr.org_id = '");
    });

    it('should include org filter in SQL when orgId is provided', async () => {
      pool = buildComputePool([]);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      await service.compute('org-specific');
      const selectSql: string = pool.query.mock.calls[0][0];
      expect(selectSql).toContain("pr.org_id = 'org-specific'");
    });

    it('should assign correct tier based on score (low)', async () => {
      const scoredRows = [
        { org_id: ORG_ID, supplier_id: 'sup-low', score: 25, factors: '{}' },
      ];
      pool = buildComputePool(scoredRows);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      await service.compute(ORG_ID);
      // Verify the upsert params include the correct tier
      const upsertParams: unknown[] = pool.query.mock.calls[1][1];
      // Params are: org_id, supplier_id, score, tier, factors (5 per row)
      expect(upsertParams[3]).toBe('low');
    });

    it('should assign correct tier based on score (medium)', async () => {
      const scoredRows = [
        { org_id: ORG_ID, supplier_id: 'sup-med', score: 45, factors: '{}' },
      ];
      pool = buildComputePool(scoredRows);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      await service.compute(ORG_ID);
      const upsertParams: unknown[] = pool.query.mock.calls[1][1];
      expect(upsertParams[3]).toBe('medium');
    });

    it('should assign correct tier based on score (high)', async () => {
      const scoredRows = [
        { org_id: ORG_ID, supplier_id: 'sup-hi', score: 65, factors: '{}' },
      ];
      pool = buildComputePool(scoredRows);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      await service.compute(ORG_ID);
      const upsertParams: unknown[] = pool.query.mock.calls[1][1];
      expect(upsertParams[3]).toBe('high');
    });

    it('should assign correct tier based on score (critical)', async () => {
      const scoredRows = [
        { org_id: ORG_ID, supplier_id: 'sup-crit', score: 85, factors: '{}' },
      ];
      pool = buildComputePool(scoredRows);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      await service.compute(ORG_ID);
      const upsertParams: unknown[] = pool.query.mock.calls[1][1];
      expect(upsertParams[3]).toBe('critical');
    });

    it('should assign correct tier at boundary (score=30 -> low)', async () => {
      const scoredRows = [
        { org_id: ORG_ID, supplier_id: 'sup-b1', score: 30, factors: '{}' },
      ];
      pool = buildComputePool(scoredRows);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      await service.compute(ORG_ID);
      const upsertParams: unknown[] = pool.query.mock.calls[1][1];
      expect(upsertParams[3]).toBe('low');
    });

    it('should assign correct tier at boundary (score=31 -> medium)', async () => {
      const scoredRows = [
        { org_id: ORG_ID, supplier_id: 'sup-b2', score: 31, factors: '{}' },
      ];
      pool = buildComputePool(scoredRows);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      await service.compute(ORG_ID);
      const upsertParams: unknown[] = pool.query.mock.calls[1][1];
      expect(upsertParams[3]).toBe('medium');
    });

    it('should assign correct tier at boundary (score=55 -> medium)', async () => {
      const scoredRows = [
        { org_id: ORG_ID, supplier_id: 'sup-b3', score: 55, factors: '{}' },
      ];
      pool = buildComputePool(scoredRows);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      await service.compute(ORG_ID);
      const upsertParams: unknown[] = pool.query.mock.calls[1][1];
      expect(upsertParams[3]).toBe('medium');
    });

    it('should assign correct tier at boundary (score=75 -> high)', async () => {
      const scoredRows = [
        { org_id: ORG_ID, supplier_id: 'sup-b4', score: 75, factors: '{}' },
      ];
      pool = buildComputePool(scoredRows);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      await service.compute(ORG_ID);
      const upsertParams: unknown[] = pool.query.mock.calls[1][1];
      expect(upsertParams[3]).toBe('high');
    });

    it('should assign correct tier at boundary (score=76 -> critical)', async () => {
      const scoredRows = [
        { org_id: ORG_ID, supplier_id: 'sup-b5', score: 76, factors: '{}' },
      ];
      pool = buildComputePool(scoredRows);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      await service.compute(ORG_ID);
      const upsertParams: unknown[] = pool.query.mock.calls[1][1];
      expect(upsertParams[3]).toBe('critical');
    });

    it('should build multi-row upsert with correct parameters', async () => {
      const scoredRows = [
        { org_id: ORG_ID, supplier_id: 'sup-a', score: 10, factors: { x: 1 } },
        { org_id: ORG_ID, supplier_id: 'sup-b', score: 90, factors: '{"y":2}' },
      ];
      pool = buildComputePool(scoredRows);
      const module = await Test.createTestingModule({
        providers: [SupplierRiskService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SupplierRiskService);

      await service.compute(ORG_ID);

      const upsertSql: string = pool.query.mock.calls[1][0];
      const upsertParams: unknown[] = pool.query.mock.calls[1][1];

      // Should contain INSERT ... ON CONFLICT
      expect(upsertSql).toContain('INSERT INTO supplier_risk_scores');
      expect(upsertSql).toContain('ON CONFLICT');

      // 2 rows x 5 params = 10 total params
      expect(upsertParams).toHaveLength(10);

      // First row
      expect(upsertParams[0]).toBe(ORG_ID);
      expect(upsertParams[1]).toBe('sup-a');
      expect(upsertParams[2]).toBe(10);
      expect(upsertParams[3]).toBe('low');
      expect(upsertParams[4]).toBe(JSON.stringify({ x: 1 }));

      // Second row
      expect(upsertParams[5]).toBe(ORG_ID);
      expect(upsertParams[6]).toBe('sup-b');
      expect(upsertParams[7]).toBe(90);
      expect(upsertParams[8]).toBe('critical');
      // factors already a string, should be passed through
      expect(upsertParams[9]).toBe('{"y":2}');
    });
  });
});
