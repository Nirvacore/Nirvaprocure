import { Test, TestingModule } from '@nestjs/testing';
import { ImportService, ImportResult } from './import.service';
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
  return {
    connect: jest.fn().mockResolvedValue(mockClient),
    client: mockClient,
  };
}

describe('ImportService', () => {
  let service: ImportService;
  let pool: ReturnType<typeof mockPool>;

  async function build(responses: any[]) {
    pool = mockPool(responses);
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImportService, { provide: PG_POOL, useValue: pool }],
    }).compile();
    service = module.get(ImportService);
  }

  // ── Empty / no-op cases ────────────────────────────────────────────

  describe('empty input', () => {
    it('should return zeroed result for empty rows array', async () => {
      await build([]);
      const result = await service.run(USER, 'items', []);
      expect(result).toEqual({ kind: 'items', inserted: 0, updated: 0, failed: [] });
      // No DB interaction at all
      expect(pool.connect).not.toHaveBeenCalled();
    });

    it('should return zeroed result for non-array input', async () => {
      await build([]);
      const result = await service.run(USER, 'suppliers', null as any);
      expect(result).toEqual({ kind: 'suppliers', inserted: 0, updated: 0, failed: [] });
    });
  });

  // ── Items import ───────────────────────────────────────────────────

  describe('items', () => {
    it('should insert a new item', async () => {
      // BEGIN, SET LOCAL, upsert (inserted=true), audit_log, COMMIT
      await build([
        { rows: [] },                                          // BEGIN
        { rows: [] },                                          // SET LOCAL
        { rows: [{ inserted: true }], rowCount: 1 },           // upsert item
        { rows: [], rowCount: 1 },                             // audit_log
        { rows: [] },                                          // COMMIT
      ]);

      const result = await service.run(USER, 'items', [
        { sku: 'SKU-001', name: 'Widget', unit: 'pcs', barcode: '111', category: 'A' },
      ]);

      expect(result.inserted).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.failed).toHaveLength(0);

      // Verify the upsert query params (call index 2)
      const upsertCall = pool.client.query.mock.calls[2];
      expect(upsertCall[1]).toEqual([ORG_ID, 'SKU-001', 'Widget', 'pcs', '111', 'A']);
    });

    it('should update an existing item (xmax != 0)', async () => {
      await build([
        { rows: [] },
        { rows: [] },
        { rows: [{ inserted: false }], rowCount: 1 },          // upsert → updated
        { rows: [], rowCount: 1 },                              // audit_log
        { rows: [] },
      ]);

      const result = await service.run(USER, 'items', [
        { sku: 'SKU-001', name: 'Widget v2' },
      ]);

      expect(result.inserted).toBe(0);
      expect(result.updated).toBe(1);
      expect(result.failed).toHaveLength(0);
    });

    it('should default unit to "unit" when not provided', async () => {
      await build([
        { rows: [] },
        { rows: [] },
        { rows: [{ inserted: true }], rowCount: 1 },
        { rows: [], rowCount: 1 },
        { rows: [] },
      ]);

      await service.run(USER, 'items', [{ sku: 'SKU-002', name: 'Gizmo' }]);
      const upsertCall = pool.client.query.mock.calls[2];
      expect(upsertCall[1][3]).toBe('unit'); // default unit
    });

    it('should default barcode and category to null', async () => {
      await build([
        { rows: [] },
        { rows: [] },
        { rows: [{ inserted: true }], rowCount: 1 },
        { rows: [], rowCount: 1 },
        { rows: [] },
      ]);

      await service.run(USER, 'items', [{ sku: 'SKU-003', name: 'Doohickey' }]);
      const upsertCall = pool.client.query.mock.calls[2];
      expect(upsertCall[1][4]).toBeNull(); // barcode
      expect(upsertCall[1][5]).toBeNull(); // category
    });

    it('should fail a row missing required sku', async () => {
      await build([
        { rows: [] },
        { rows: [] },
        // no upsert query — required() throws before it
        { rows: [], rowCount: 1 },                              // audit_log
        { rows: [] },
      ]);

      const result = await service.run(USER, 'items', [
        { name: 'No SKU' },
      ]);

      expect(result.inserted).toBe(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toEqual({ row: 1, reason: 'Missing required field "sku"' });
    });

    it('should fail a row missing required name', async () => {
      await build([
        { rows: [] },
        { rows: [] },
        { rows: [], rowCount: 1 },
        { rows: [] },
      ]);

      const result = await service.run(USER, 'items', [
        { sku: 'SKU-X' },
      ]);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toBe('Missing required field "name"');
    });

    it('should handle multiple items with mixed insert/update/fail', async () => {
      await build([
        { rows: [] },                                           // BEGIN
        { rows: [] },                                           // SET LOCAL
        { rows: [{ inserted: true }], rowCount: 1 },            // row 1 → inserted
        { rows: [{ inserted: false }], rowCount: 1 },           // row 2 → updated
        // row 3 fails (missing sku) — no query
        { rows: [{ inserted: true }], rowCount: 1 },            // row 4 → inserted
        { rows: [], rowCount: 1 },                              // audit_log
        { rows: [] },                                           // COMMIT
      ]);

      const result = await service.run(USER, 'items', [
        { sku: 'A', name: 'Item A' },
        { sku: 'B', name: 'Item B' },
        { name: 'No SKU' },           // will fail
        { sku: 'D', name: 'Item D' },
      ]);

      expect(result.inserted).toBe(2);
      expect(result.updated).toBe(1);
      expect(result.failed).toEqual([{ row: 3, reason: 'Missing required field "sku"' }]);
    });
  });

  // ── Suppliers import ───────────────────────────────────────────────

  describe('suppliers', () => {
    it('should insert a new supplier', async () => {
      // INSERT ... RETURNING id succeeds (rowCount=1) → 'inserted'
      await build([
        { rows: [] },                                           // BEGIN
        { rows: [] },                                           // SET LOCAL
        { rows: [{ id: 'sup-1' }], rowCount: 1 },              // INSERT → inserted
        { rows: [], rowCount: 1 },                              // audit_log
        { rows: [] },                                           // COMMIT
      ]);

      const result = await service.run(USER, 'suppliers', [
        { name: 'Acme', tax_id: '123', contact_email: 'a@b.com', contact_phone: '999' },
      ]);

      expect(result.inserted).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.failed).toHaveLength(0);

      const insertCall = pool.client.query.mock.calls[2];
      expect(insertCall[1]).toEqual([ORG_ID, 'Acme', '123', 'a@b.com', '999']);
    });

    it('should update an existing supplier (ON CONFLICT DO NOTHING → rowCount=0)', async () => {
      // INSERT returns rowCount 0 (conflict), then UPDATE runs
      await build([
        { rows: [] },                                           // BEGIN
        { rows: [] },                                           // SET LOCAL
        { rows: [], rowCount: 0 },                              // INSERT → conflict
        { rows: [], rowCount: 1 },                              // UPDATE
        { rows: [], rowCount: 1 },                              // audit_log
        { rows: [] },                                           // COMMIT
      ]);

      const result = await service.run(USER, 'suppliers', [
        { name: 'Acme', tax_id: '456' },
      ]);

      expect(result.inserted).toBe(0);
      expect(result.updated).toBe(1);

      const updateCall = pool.client.query.mock.calls[3];
      expect(updateCall[0]).toContain('UPDATE suppliers');
      expect(updateCall[1]).toEqual([ORG_ID, 'Acme', '456', null, null]);
    });

    it('should default optional fields to null', async () => {
      await build([
        { rows: [] },
        { rows: [] },
        { rows: [{ id: 'sup-2' }], rowCount: 1 },
        { rows: [], rowCount: 1 },
        { rows: [] },
      ]);

      await service.run(USER, 'suppliers', [{ name: 'Bare Supplier' }]);
      const insertCall = pool.client.query.mock.calls[2];
      expect(insertCall[1]).toEqual([ORG_ID, 'Bare Supplier', null, null, null]);
    });

    it('should fail a row missing required name', async () => {
      await build([
        { rows: [] },
        { rows: [] },
        { rows: [], rowCount: 1 },
        { rows: [] },
      ]);

      const result = await service.run(USER, 'suppliers', [
        { tax_id: '999' },
      ]);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toEqual({ row: 1, reason: 'Missing required field "name"' });
    });
  });

  // ── Departments import ─────────────────────────────────────────────

  describe('departments', () => {
    it('should insert a new department', async () => {
      await build([
        { rows: [] },
        { rows: [] },
        { rows: [{ id: 'dept-1' }], rowCount: 1 },             // INSERT → inserted
        { rows: [], rowCount: 1 },                              // audit_log
        { rows: [] },
      ]);

      const result = await service.run(USER, 'departments', [
        { name: 'Engineering', cost_center: 'CC-100' },
      ]);

      expect(result.inserted).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.failed).toHaveLength(0);

      const insertCall = pool.client.query.mock.calls[2];
      expect(insertCall[1]).toEqual([ORG_ID, 'Engineering', 'CC-100']);
    });

    it('should update an existing department', async () => {
      await build([
        { rows: [] },
        { rows: [] },
        { rows: [], rowCount: 0 },                              // INSERT → conflict
        { rows: [], rowCount: 1 },                              // UPDATE
        { rows: [], rowCount: 1 },                              // audit_log
        { rows: [] },
      ]);

      const result = await service.run(USER, 'departments', [
        { name: 'Engineering', cost_center: 'CC-200' },
      ]);

      expect(result.inserted).toBe(0);
      expect(result.updated).toBe(1);

      const updateCall = pool.client.query.mock.calls[3];
      expect(updateCall[0]).toContain('UPDATE departments');
    });

    it('should default cost_center to null', async () => {
      await build([
        { rows: [] },
        { rows: [] },
        { rows: [{ id: 'dept-2' }], rowCount: 1 },
        { rows: [], rowCount: 1 },
        { rows: [] },
      ]);

      await service.run(USER, 'departments', [{ name: 'Sales' }]);
      const insertCall = pool.client.query.mock.calls[2];
      expect(insertCall[1]).toEqual([ORG_ID, 'Sales', null]);
    });

    it('should fail a row missing required name', async () => {
      await build([
        { rows: [] },
        { rows: [] },
        { rows: [], rowCount: 1 },
        { rows: [] },
      ]);

      const result = await service.run(USER, 'departments', [
        { cost_center: 'CC-300' },
      ]);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toBe('Missing required field "name"');
    });
  });

  // ── Audit log ──────────────────────────────────────────────────────

  describe('audit log', () => {
    it('should write a single audit_log entry with batch summary', async () => {
      await build([
        { rows: [] },
        { rows: [] },
        { rows: [{ inserted: true }], rowCount: 1 },           // item 1
        { rows: [{ inserted: false }], rowCount: 1 },          // item 2
        { rows: [], rowCount: 1 },                              // audit_log
        { rows: [] },
      ]);

      await service.run(USER, 'items', [
        { sku: 'A', name: 'A' },
        { sku: 'B', name: 'B' },
      ]);

      // audit_log is the 5th query (index 4)
      const auditCall = pool.client.query.mock.calls[4];
      expect(auditCall[0]).toContain('audit_log');
      expect(auditCall[1][0]).toBe(ORG_ID);          // org_id
      expect(auditCall[1][1]).toBe('u-1');            // actor_user_id
      expect(auditCall[1][2]).toBe('import.items');   // action
      expect(auditCall[1][3]).toBe('items');           // entity_type

      const diff = JSON.parse(auditCall[1][5]);
      expect(diff).toEqual({ inserted: 1, updated: 1, failed: 0 });
    });
  });

  // ── Unknown kind ───────────────────────────────────────────────────

  describe('unknown kind', () => {
    it('should fail every row with unknown import kind', async () => {
      await build([
        { rows: [] },
        { rows: [] },
        // row processing throws before any query
        { rows: [], rowCount: 1 },                              // audit_log
        { rows: [] },
      ]);

      const result = await service.run(USER, 'widgets' as any, [
        { name: 'foo' },
      ]);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toContain('Unknown import kind');
    });
  });

  // ── Required field validation edge cases ───────────────────────────

  describe('required field validation', () => {
    it('should reject empty-string sku', async () => {
      await build([
        { rows: [] },
        { rows: [] },
        { rows: [], rowCount: 1 },
        { rows: [] },
      ]);

      const result = await service.run(USER, 'items', [
        { sku: '   ', name: 'Widget' },
      ]);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toBe('Missing required field "sku"');
    });

    it('should reject null name for suppliers', async () => {
      await build([
        { rows: [] },
        { rows: [] },
        { rows: [], rowCount: 1 },
        { rows: [] },
      ]);

      const result = await service.run(USER, 'suppliers', [
        { name: null },
      ]);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toBe('Missing required field "name"');
    });

    it('should reject numeric sku (wrong type)', async () => {
      await build([
        { rows: [] },
        { rows: [] },
        { rows: [], rowCount: 1 },
        { rows: [] },
      ]);

      const result = await service.run(USER, 'items', [
        { sku: 12345, name: 'Widget' },
      ]);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toBe('Missing required field "sku"');
    });
  });

  // ── Transaction lifecycle ──────────────────────────────────────────

  describe('transaction lifecycle', () => {
    it('should acquire client, BEGIN, SET LOCAL org, and COMMIT', async () => {
      await build([
        { rows: [] },
        { rows: [] },
        { rows: [{ inserted: true }], rowCount: 1 },
        { rows: [], rowCount: 1 },
        { rows: [] },
      ]);

      await service.run(USER, 'items', [{ sku: 'X', name: 'X' }]);

      expect(pool.connect).toHaveBeenCalledTimes(1);
      expect(pool.client.query.mock.calls[0][0]).toBe('BEGIN');
      expect(pool.client.query.mock.calls[1][0]).toContain('SET LOCAL');
      expect(pool.client.query.mock.calls[1][1]).toEqual([ORG_ID]);

      // Last call is COMMIT
      const lastCall = pool.client.query.mock.calls[pool.client.query.mock.calls.length - 1];
      expect(lastCall[0]).toBe('COMMIT');

      expect(pool.client.release).toHaveBeenCalledTimes(1);
    });
  });
});
