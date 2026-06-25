import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PortalService, PortalContext } from './portal.service';
import { PG_POOL } from '../../common/db/db.module';

const ORG_ID = 'org-1';
const SUPPLIER_ID = 'sup-1';
const USER_ID = 'u-1';

function mockPool(queryResponses: any[]) {
  let callIdx = 0;
  const pool = {
    query: jest.fn().mockImplementation(() => {
      const resp = queryResponses[callIdx] ?? { rows: [], rowCount: 0 };
      callIdx++;
      return Promise.resolve(resp);
    }),
  };
  return pool;
}

async function createService(pool: ReturnType<typeof mockPool>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [PortalService, { provide: PG_POOL, useValue: pool }],
  }).compile();
  return module.get(PortalService);
}

describe('PortalService', () => {
  describe('issueToken', () => {
    it('should insert a token and return raw token + expires_at', async () => {
      const expiresAt = '2026-07-25T00:00:00.000Z';
      const pool = mockPool([
        { rows: [{ expires_at: expiresAt }], rowCount: 1 },
      ]);
      const service = await createService(pool);

      const result = await service.issueToken({
        org_id: ORG_ID,
        supplier_id: SUPPLIER_ID,
        created_by_user_id: USER_ID,
      });

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);
      expect(result.expires_at).toBe(expiresAt);
      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO supplier_portal_tokens'),
        expect.arrayContaining([ORG_ID, SUPPLIER_ID]),
      );
    });

    it('should use default ttl of 30 days when not provided', async () => {
      const pool = mockPool([
        { rows: [{ expires_at: '2026-07-25T00:00:00.000Z' }], rowCount: 1 },
      ]);
      const service = await createService(pool);

      await service.issueToken({
        org_id: ORG_ID,
        supplier_id: SUPPLIER_ID,
        created_by_user_id: USER_ID,
      });

      // The 5th parameter (index 4) should be '30' (default ttl_days)
      const queryArgs = pool.query.mock.calls[0][1];
      expect(queryArgs[4]).toBe('30');
    });

    it('should use custom ttl_days when provided', async () => {
      const pool = mockPool([
        { rows: [{ expires_at: '2026-08-24T00:00:00.000Z' }], rowCount: 1 },
      ]);
      const service = await createService(pool);

      await service.issueToken({
        org_id: ORG_ID,
        supplier_id: SUPPLIER_ID,
        created_by_user_id: USER_ID,
        ttl_days: 60,
      });

      const queryArgs = pool.query.mock.calls[0][1];
      expect(queryArgs[4]).toBe('60');
    });

    it('should pass label when provided', async () => {
      const pool = mockPool([
        { rows: [{ expires_at: '2026-07-25T00:00:00.000Z' }], rowCount: 1 },
      ]);
      const service = await createService(pool);

      await service.issueToken({
        org_id: ORG_ID,
        supplier_id: SUPPLIER_ID,
        created_by_user_id: USER_ID,
        label: 'Q3 portal link',
      });

      const queryArgs = pool.query.mock.calls[0][1];
      expect(queryArgs[3]).toBe('Q3 portal link');
    });

    it('should pass null label when not provided', async () => {
      const pool = mockPool([
        { rows: [{ expires_at: '2026-07-25T00:00:00.000Z' }], rowCount: 1 },
      ]);
      const service = await createService(pool);

      await service.issueToken({
        org_id: ORG_ID,
        supplier_id: SUPPLIER_ID,
        created_by_user_id: USER_ID,
      });

      const queryArgs = pool.query.mock.calls[0][1];
      expect(queryArgs[3]).toBeNull();
    });
  });

  describe('resolve', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();

    it('should return portal context for a valid token', async () => {
      const pool = mockPool([
        // SELECT token lookup
        {
          rows: [{
            org_id: ORG_ID,
            supplier_id: SUPPLIER_ID,
            expires_at: futureDate,
            revoked_at: null,
            supplier_name: 'Acme Corp',
          }],
          rowCount: 1,
        },
        // UPDATE last_used_at (fire-and-forget)
        { rows: [], rowCount: 1 },
      ]);
      const service = await createService(pool);

      const result = await service.resolve('some-raw-token');

      expect(result).toEqual({
        org_id: ORG_ID,
        supplier_id: SUPPLIER_ID,
        supplier_name: 'Acme Corp',
        expires_at: futureDate,
      });
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM supplier_portal_tokens'),
        expect.any(Array),
      );
    });

    it('should throw NotFoundException for invalid token', async () => {
      const pool = mockPool([
        { rows: [], rowCount: 0 },
      ]);
      const service = await createService(pool);

      await expect(service.resolve('bad-token')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for revoked token', async () => {
      const pool = mockPool([
        {
          rows: [{
            org_id: ORG_ID,
            supplier_id: SUPPLIER_ID,
            expires_at: futureDate,
            revoked_at: '2026-06-20T00:00:00.000Z',
            supplier_name: 'Acme Corp',
          }],
          rowCount: 1,
        },
      ]);
      const service = await createService(pool);

      await expect(service.resolve('revoked-token')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for expired token', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const pool = mockPool([
        {
          rows: [{
            org_id: ORG_ID,
            supplier_id: SUPPLIER_ID,
            expires_at: pastDate,
            revoked_at: null,
            supplier_name: 'Acme Corp',
          }],
          rowCount: 1,
        },
      ]);
      const service = await createService(pool);

      await expect(service.resolve('expired-token')).rejects.toThrow(ForbiddenException);
    });

    it('should update last_used_at after successful resolve', async () => {
      const pool = mockPool([
        {
          rows: [{
            org_id: ORG_ID,
            supplier_id: SUPPLIER_ID,
            expires_at: futureDate,
            revoked_at: null,
            supplier_name: 'Acme Corp',
          }],
          rowCount: 1,
        },
        { rows: [], rowCount: 1 },
      ]);
      const service = await createService(pool);

      await service.resolve('valid-token');

      // The second query should be the UPDATE last_used_at
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE supplier_portal_tokens SET last_used_at'),
        expect.any(Array),
      );
    });
  });

  describe('listLinesForSupplier', () => {
    const ctx: PortalContext = {
      org_id: ORG_ID,
      supplier_id: SUPPLIER_ID,
      supplier_name: 'Acme Corp',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    };

    it('should return PR lines for the supplier', async () => {
      const lineRows = [
        {
          pr_id: 'pr-1',
          pr_number: 'PR-001',
          pr_title: 'Office Supplies',
          description: 'Pens and paper',
          quantity: 100,
          unit: 'pcs',
          unit_price_minor: 5000,
          line_total_minor: 500000,
          status: 'approved',
        },
        {
          pr_id: 'pr-2',
          pr_number: 'PR-002',
          pr_title: 'IT Equipment',
          description: 'Keyboards',
          quantity: 10,
          unit: 'pcs',
          unit_price_minor: 150000,
          line_total_minor: 1500000,
          status: 'in_approval',
        },
      ];

      const pool = mockPool([
        { rows: lineRows, rowCount: 2 },
      ]);
      const service = await createService(pool);

      const result = await service.listLinesForSupplier(ctx);

      expect(result).toHaveLength(2);
      expect(result[0].pr_number).toBe('PR-001');
      expect(result[1].pr_number).toBe('PR-002');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM purchase_request_items'),
        [SUPPLIER_ID, ORG_ID],
      );
    });

    it('should return empty array when no lines found', async () => {
      const pool = mockPool([
        { rows: [], rowCount: 0 },
      ]);
      const service = await createService(pool);

      const result = await service.listLinesForSupplier(ctx);

      expect(result).toEqual([]);
    });

    it('should query with correct supplier_id and org_id', async () => {
      const pool = mockPool([
        { rows: [], rowCount: 0 },
      ]);
      const service = await createService(pool);

      await service.listLinesForSupplier(ctx);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('pri.supplier_id = $1'),
        [SUPPLIER_ID, ORG_ID],
      );
    });
  });

  describe('acknowledge', () => {
    const ctx: PortalContext = {
      org_id: ORG_ID,
      supplier_id: SUPPLIER_ID,
      supplier_name: 'Acme Corp',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    };

    it('should acknowledge a valid PR and return ok', async () => {
      const pool = mockPool([
        // SELECT 1 to validate pr/supplier/org
        { rows: [{ '?column?': 1 }], rowCount: 1 },
        // INSERT audit_log
        { rows: [], rowCount: 1 },
      ]);
      const service = await createService(pool);

      const result = await service.acknowledge(ctx, 'pr-1', 'Received');

      expect(result).toEqual({ ok: true });
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when PR not found for supplier', async () => {
      const pool = mockPool([
        { rows: [], rowCount: 0 },
      ]);
      const service = await createService(pool);

      await expect(service.acknowledge(ctx, 'bad-pr')).rejects.toThrow(NotFoundException);
      // Should not have inserted an audit_log entry
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it('should insert audit_log with supplier_id and note', async () => {
      const pool = mockPool([
        { rows: [{ '?column?': 1 }], rowCount: 1 },
        { rows: [], rowCount: 1 },
      ]);
      const service = await createService(pool);

      await service.acknowledge(ctx, 'pr-1', 'We confirm receipt');

      const auditCall = pool.query.mock.calls[1];
      expect(auditCall[0]).toContain('INSERT INTO audit_log');
      expect(auditCall[1][0]).toBe(ORG_ID);
      expect(auditCall[1][1]).toBe('pr-1');
      const diff = JSON.parse(auditCall[1][2]);
      expect(diff.supplier_id).toBe(SUPPLIER_ID);
      expect(diff.note).toBe('We confirm receipt');
    });

    it('should insert audit_log with null note when not provided', async () => {
      const pool = mockPool([
        { rows: [{ '?column?': 1 }], rowCount: 1 },
        { rows: [], rowCount: 1 },
      ]);
      const service = await createService(pool);

      await service.acknowledge(ctx, 'pr-1');

      const auditCall = pool.query.mock.calls[1];
      const diff = JSON.parse(auditCall[1][2]);
      expect(diff.note).toBeNull();
    });

    it('should validate with correct pr_id, supplier_id, and org_id', async () => {
      const pool = mockPool([
        { rows: [{ '?column?': 1 }], rowCount: 1 },
        { rows: [], rowCount: 1 },
      ]);
      const service = await createService(pool);

      await service.acknowledge(ctx, 'pr-1');

      const validationCall = pool.query.mock.calls[0];
      expect(validationCall[0]).toContain('FROM purchase_request_items');
      expect(validationCall[1]).toEqual(['pr-1', SUPPLIER_ID, ORG_ID]);
    });
  });
});
