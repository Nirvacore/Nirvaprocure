import { Test, TestingModule } from '@nestjs/testing';
import { AuditService, AuditRow } from './audit.service';
import { PG_POOL } from '../../common/db/db.module';

const ORG_ID = 'org-1';
const USER = { orgId: ORG_ID, userId: 'u-1', email: 'test@test.com', role: 'admin' } as any;

function makeRow(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    id: 1,
    action: 'CREATE',
    entity_type: 'purchase_order',
    entity_id: 'po-1',
    actor_user_id: 'u-1',
    actor_name: 'Alice',
    created_at: '2026-06-01T10:00:00.000Z',
    diff: { field: 'status', old: 'DRAFT', new: 'APPROVED' },
    ...overrides,
  };
}

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

async function setup(queryResponses: any[]) {
  const pool = mockPool(queryResponses);
  const module: TestingModule = await Test.createTestingModule({
    providers: [AuditService, { provide: PG_POOL, useValue: pool }],
  }).compile();
  const service = module.get(AuditService);
  return { service, pool };
}

describe('AuditService', () => {
  describe('list', () => {
    it('should return audit rows with no filters', async () => {
      const row = makeRow();
      const { service, pool } = await setup([
        { rows: [] },                        // BEGIN
        { rows: [] },                        // SET LOCAL
        { rows: [row], rowCount: 1 },        // SELECT
        { rows: [] },                        // COMMIT
      ]);

      const result = await service.list(USER, { limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].action).toBe('CREATE');
      expect(result.data[0].entity_type).toBe('purchase_order');
      expect(result.next_cursor).toBeNull();

      // Verify the SELECT query was issued (3rd call, index 2)
      const selectCall = pool.client.query.mock.calls[2];
      expect(selectCall[0]).toContain('audit_log');
      expect(selectCall[0]).toContain('ORDER BY a.created_at DESC');
    });

    it('should filter by entityType', async () => {
      const row = makeRow({ entity_type: 'supplier' });
      const { service, pool } = await setup([
        { rows: [] },
        { rows: [] },
        { rows: [row], rowCount: 1 },
        { rows: [] },
      ]);

      const result = await service.list(USER, { entityType: 'supplier', limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].entity_type).toBe('supplier');

      const selectCall = pool.client.query.mock.calls[2];
      expect(selectCall[0]).toContain('a.entity_type = $1');
      expect(selectCall[1]).toContain('supplier');
    });

    it('should filter by actorId', async () => {
      const row = makeRow({ actor_user_id: 'u-42' });
      const { service, pool } = await setup([
        { rows: [] },
        { rows: [] },
        { rows: [row], rowCount: 1 },
        { rows: [] },
      ]);

      const result = await service.list(USER, { actorId: 'u-42', limit: 10 });

      expect(result.data).toHaveLength(1);

      const selectCall = pool.client.query.mock.calls[2];
      expect(selectCall[0]).toContain('a.actor_user_id = $1');
      expect(selectCall[1]).toContain('u-42');
    });

    it('should filter by both entityType and actorId', async () => {
      const row = makeRow({ entity_type: 'pr', actor_user_id: 'u-5' });
      const { service, pool } = await setup([
        { rows: [] },
        { rows: [] },
        { rows: [row], rowCount: 1 },
        { rows: [] },
      ]);

      const result = await service.list(USER, {
        entityType: 'pr',
        actorId: 'u-5',
        limit: 10,
      });

      expect(result.data).toHaveLength(1);

      const selectCall = pool.client.query.mock.calls[2];
      expect(selectCall[0]).toContain('a.entity_type = $1');
      expect(selectCall[0]).toContain('a.actor_user_id = $2');
      expect(selectCall[1]).toEqual(['pr', 'u-5', 11]); // limit + 1
    });

    it('should return next_cursor when there are more results', async () => {
      // Simulate limit=2 but 3 rows returned (hasMore = true)
      const rows = [
        makeRow({ id: 3, created_at: '2026-06-03T10:00:00.000Z' }),
        makeRow({ id: 2, created_at: '2026-06-02T10:00:00.000Z' }),
        makeRow({ id: 1, created_at: '2026-06-01T10:00:00.000Z' }),
      ];
      const { service } = await setup([
        { rows: [] },
        { rows: [] },
        { rows, rowCount: 3 },
        { rows: [] },
      ]);

      const result = await service.list(USER, { limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.next_cursor).not.toBeNull();

      // Decode the cursor and verify it's based on the last item in the slice
      const decoded = Buffer.from(result.next_cursor!, 'base64').toString('utf8');
      expect(decoded).toBe('2026-06-02T10:00:00.000Z|2');
    });

    it('should return null next_cursor when results fit within limit', async () => {
      const rows = [
        makeRow({ id: 2 }),
        makeRow({ id: 1 }),
      ];
      const { service } = await setup([
        { rows: [] },
        { rows: [] },
        { rows, rowCount: 2 },
        { rows: [] },
      ]);

      const result = await service.list(USER, { limit: 5 });

      expect(result.data).toHaveLength(2);
      expect(result.next_cursor).toBeNull();
    });

    it('should apply cursor-based pagination', async () => {
      const cursor = Buffer.from('2026-06-02T10:00:00.000Z|5').toString('base64');
      const row = makeRow({ id: 4, created_at: '2026-06-01T10:00:00.000Z' });

      const { service, pool } = await setup([
        { rows: [] },
        { rows: [] },
        { rows: [row], rowCount: 1 },
        { rows: [] },
      ]);

      const result = await service.list(USER, { cursor, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(4);

      const selectCall = pool.client.query.mock.calls[2];
      expect(selectCall[0]).toContain('(a.created_at, a.id) <');
      // params: [ts, id, limit+1]
      expect(selectCall[1]).toContain('2026-06-02T10:00:00.000Z');
      expect(selectCall[1]).toContain('5');
    });

    it('should combine cursor with entityType filter', async () => {
      const cursor = Buffer.from('2026-06-02T10:00:00.000Z|5').toString('base64');
      const row = makeRow({ id: 3, entity_type: 'invoice' });

      const { service, pool } = await setup([
        { rows: [] },
        { rows: [] },
        { rows: [row], rowCount: 1 },
        { rows: [] },
      ]);

      const result = await service.list(USER, {
        entityType: 'invoice',
        cursor,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);

      const selectCall = pool.client.query.mock.calls[2];
      expect(selectCall[0]).toContain('a.entity_type = $1');
      expect(selectCall[0]).toContain('(a.created_at, a.id) <');
      // params: [entityType, ts, id, limit+1]
      expect(selectCall[1]).toEqual(['invoice', '2026-06-02T10:00:00.000Z', '5', 11]);
    });

    it('should return empty data when no rows match', async () => {
      const { service } = await setup([
        { rows: [] },
        { rows: [] },
        { rows: [], rowCount: 0 },
        { rows: [] },
      ]);

      const result = await service.list(USER, { limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.next_cursor).toBeNull();
    });

    it('should request limit+1 rows to detect next page', async () => {
      const { service, pool } = await setup([
        { rows: [] },
        { rows: [] },
        { rows: [], rowCount: 0 },
        { rows: [] },
      ]);

      await service.list(USER, { limit: 15 });

      const selectCall = pool.client.query.mock.calls[2];
      // The LIMIT param should be limit+1 = 16
      const params = selectCall[1] as unknown[];
      expect(params[params.length - 1]).toBe(16);
    });

    it('should set RLS org via SET LOCAL', async () => {
      const { service, pool } = await setup([
        { rows: [] },
        { rows: [] },
        { rows: [], rowCount: 0 },
        { rows: [] },
      ]);

      await service.list(USER, { limit: 10 });

      // Call index 1 is SET LOCAL
      const setLocalCall = pool.client.query.mock.calls[1];
      expect(setLocalCall[0]).toContain('SET LOCAL app.current_org');
      expect(setLocalCall[1]).toEqual([ORG_ID]);
    });

    it('should release the client after successful query', async () => {
      const { service, pool } = await setup([
        { rows: [] },
        { rows: [] },
        { rows: [], rowCount: 0 },
        { rows: [] },
      ]);

      await service.list(USER, { limit: 10 });

      expect(pool.client.release).toHaveBeenCalledTimes(1);
    });

    it('should ignore malformed cursor gracefully', async () => {
      // A base64 string that does not contain '|'
      const badCursor = Buffer.from('no-pipe-here').toString('base64');

      const { service, pool } = await setup([
        { rows: [] },
        { rows: [] },
        { rows: [], rowCount: 0 },
        { rows: [] },
      ]);

      const result = await service.list(USER, { cursor: badCursor, limit: 10 });

      expect(result.data).toHaveLength(0);
      // The query should not include cursor WHERE clause since split yields no valid ts|id pair
      const selectCall = pool.client.query.mock.calls[2];
      expect(selectCall[0]).not.toContain('(a.created_at, a.id) <');
    });
  });
});
