import { Test, TestingModule } from '@nestjs/testing';
import { AnomalyService } from './anomaly.service';
import { PG_POOL } from '../../common/db/db.module';

const ORG_ID = 'org-1';
const USER = { orgId: ORG_ID, userId: 'u-1', email: 'admin@test.com', role: 'admin' } as any;

const alertRow = {
  id: 'alert-1',
  kind: 'price_spike',
  severity: 'warning',
  subject_type: 'purchase_request',
  subject_id: 'pr-1',
  details: { old_price: 100, new_price: 300 },
  created_at: '2026-06-01T00:00:00Z',
  acknowledged_at: null,
};

const disclosureRow = {
  id: 'disc-1',
  user_id: 'u-1',
  user_name: 'John Doe',
  supplier_id: 'sup-1',
  supplier_name: 'Acme',
  relationship: 'family',
  note: 'spouse works there',
  declared_at: '2026-05-01T00:00:00Z',
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
    // Direct pool.query used by record() and prHasCoi()
    query: jest.fn().mockImplementation(() => {
      const resp = queryResponses[callIdx] ?? { rows: [], rowCount: 0 };
      callIdx++;
      return Promise.resolve(resp);
    }),
    client: mockClient,
  };
}

describe('AnomalyService', () => {
  let service: AnomalyService;
  let pool: ReturnType<typeof mockPool>;

  // -----------------------------------------------------------------------
  // record()
  // -----------------------------------------------------------------------
  describe('record', () => {
    it('should insert an anomaly alert with default severity', async () => {
      pool = mockPool([
        { rows: [], rowCount: 1 }, // INSERT
      ]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [AnomalyService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(AnomalyService);

      await service.record({
        org_id: ORG_ID,
        kind: 'price_spike',
        subject_type: 'purchase_request',
        subject_id: 'pr-1',
      });

      expect(pool.query).toHaveBeenCalledTimes(1);
      const args = pool.query.mock.calls[0];
      expect(args[0]).toContain('INSERT INTO anomaly_alerts');
      expect(args[1]).toEqual([
        ORG_ID,
        'price_spike',
        'warning',        // default severity
        'purchase_request',
        'pr-1',
        '{}',             // default details
        null,             // default target_user_id
      ]);
    });

    it('should insert with explicit severity and details', async () => {
      pool = mockPool([
        { rows: [], rowCount: 1 },
      ]);
      const module = await Test.createTestingModule({
        providers: [AnomalyService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(AnomalyService);

      await service.record({
        org_id: ORG_ID,
        kind: 'coi_match',
        severity: 'critical',
        subject_type: 'purchase_request',
        subject_id: 'pr-2',
        details: { supplier_id: 'sup-1', user_id: 'u-5' },
        target_user_id: 'u-5',
      });

      const args = pool.query.mock.calls[0];
      expect(args[1][2]).toBe('critical');
      expect(args[1][5]).toBe(JSON.stringify({ supplier_id: 'sup-1', user_id: 'u-5' }));
      expect(args[1][6]).toBe('u-5');
    });
  });

  // -----------------------------------------------------------------------
  // list()
  // -----------------------------------------------------------------------
  describe('list', () => {
    it('should return all alerts (no filter)', async () => {
      pool = mockPool([
        { rows: [] },                              // BEGIN
        { rows: [] },                              // SET LOCAL
        { rows: [alertRow], rowCount: 1 },          // SELECT
        { rows: [] },                              // COMMIT
      ]);
      const module = await Test.createTestingModule({
        providers: [AnomalyService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(AnomalyService);

      const result = await service.list(USER);
      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('price_spike');
      expect(result[0].id).toBe('alert-1');
    });

    it('should filter unacknowledged alerts', async () => {
      pool = mockPool([
        { rows: [] },
        { rows: [] },
        { rows: [alertRow], rowCount: 1 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [AnomalyService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(AnomalyService);

      const result = await service.list(USER, { acknowledged: false });
      expect(result).toHaveLength(1);
      // The SELECT query should contain the IS NULL filter
      const selectCall = pool.client.query.mock.calls[2];
      expect(selectCall[0]).toContain('acknowledged_at IS NULL');
    });

    it('should filter acknowledged alerts', async () => {
      const ackRow = { ...alertRow, acknowledged_at: '2026-06-02T00:00:00Z' };
      pool = mockPool([
        { rows: [] },
        { rows: [] },
        { rows: [ackRow], rowCount: 1 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [AnomalyService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(AnomalyService);

      const result = await service.list(USER, { acknowledged: true });
      expect(result).toHaveLength(1);
      const selectCall = pool.client.query.mock.calls[2];
      expect(selectCall[0]).toContain('acknowledged_at IS NOT NULL');
    });

    it('should return empty array when no alerts', async () => {
      pool = mockPool([
        { rows: [] },
        { rows: [] },
        { rows: [], rowCount: 0 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [AnomalyService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(AnomalyService);

      const result = await service.list(USER);
      expect(result).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // acknowledge()
  // -----------------------------------------------------------------------
  describe('acknowledge', () => {
    it('should acknowledge an alert', async () => {
      pool = mockPool([
        { rows: [] },                  // BEGIN
        { rows: [] },                  // SET LOCAL
        { rows: [], rowCount: 1 },     // UPDATE
        { rows: [] },                  // COMMIT
      ]);
      const module = await Test.createTestingModule({
        providers: [AnomalyService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(AnomalyService);

      const result = await service.acknowledge(USER, 'alert-1');
      expect(result).toEqual({ ok: true });
      const updateCall = pool.client.query.mock.calls[2];
      expect(updateCall[0]).toContain('UPDATE anomaly_alerts');
      expect(updateCall[1]).toEqual(['alert-1', 'u-1']);
    });
  });

  // -----------------------------------------------------------------------
  // listDisclosures()
  // -----------------------------------------------------------------------
  describe('listDisclosures', () => {
    it('should return disclosures with user and supplier names', async () => {
      pool = mockPool([
        { rows: [] },
        { rows: [] },
        { rows: [disclosureRow], rowCount: 1 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [AnomalyService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(AnomalyService);

      const result = await service.listDisclosures(USER);
      expect(result).toHaveLength(1);
      expect(result[0].user_name).toBe('John Doe');
      expect(result[0].supplier_name).toBe('Acme');
      expect(result[0].relationship).toBe('family');
    });

    it('should return empty array when no disclosures', async () => {
      pool = mockPool([
        { rows: [] },
        { rows: [] },
        { rows: [], rowCount: 0 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [AnomalyService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(AnomalyService);

      const result = await service.listDisclosures(USER);
      expect(result).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // declare()
  // -----------------------------------------------------------------------
  describe('declare', () => {
    it('should insert a new disclosure and return id + declared_at', async () => {
      const returned = { id: 'disc-new', declared_at: '2026-06-25T10:00:00Z' };
      pool = mockPool([
        { rows: [] },
        { rows: [] },
        { rows: [returned], rowCount: 1 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [AnomalyService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(AnomalyService);

      const result = await service.declare(USER, {
        supplier_id: 'sup-1',
        relationship: 'family',
        note: 'brother',
      });
      expect(result.id).toBe('disc-new');
      expect(result.declared_at).toBe('2026-06-25T10:00:00Z');

      const insertCall = pool.client.query.mock.calls[2];
      expect(insertCall[0]).toContain('INSERT INTO user_supplier_disclosures');
      expect(insertCall[1]).toEqual([ORG_ID, 'u-1', 'sup-1', 'family', 'brother']);
    });

    it('should pass null for note when omitted', async () => {
      const returned = { id: 'disc-new', declared_at: '2026-06-25T10:00:00Z' };
      pool = mockPool([
        { rows: [] },
        { rows: [] },
        { rows: [returned], rowCount: 1 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [AnomalyService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(AnomalyService);

      await service.declare(USER, {
        supplier_id: 'sup-2',
        relationship: 'financial_interest',
      });

      const insertCall = pool.client.query.mock.calls[2];
      expect(insertCall[1][4]).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // prHasCoi()
  // -----------------------------------------------------------------------
  describe('prHasCoi', () => {
    it('should return true when a conflict-of-interest exists', async () => {
      pool = mockPool([
        { rows: [{ '?column?': 1 }], rowCount: 1 },
      ]);
      const module = await Test.createTestingModule({
        providers: [AnomalyService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(AnomalyService);

      const result = await service.prHasCoi(ORG_ID, 'pr-1', 'u-1');
      expect(result).toBe(true);
      expect(pool.query).toHaveBeenCalledTimes(1);
      const args = pool.query.mock.calls[0];
      expect(args[1]).toEqual(['pr-1', 'u-1', ORG_ID]);
    });

    it('should return false when no conflict-of-interest exists', async () => {
      pool = mockPool([
        { rows: [], rowCount: 0 },
      ]);
      const module = await Test.createTestingModule({
        providers: [AnomalyService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(AnomalyService);

      const result = await service.prHasCoi(ORG_ID, 'pr-1', 'u-1');
      expect(result).toBe(false);
    });

    it('should return false when rowCount is null', async () => {
      pool = mockPool([
        { rows: [], rowCount: null },
      ]);
      const module = await Test.createTestingModule({
        providers: [AnomalyService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(AnomalyService);

      const result = await service.prHasCoi(ORG_ID, 'pr-1', 'u-1');
      expect(result).toBe(false);
    });
  });
});
