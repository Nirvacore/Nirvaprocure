import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { AuditArchiveService } from './audit-archive.service';
import { PG_POOL } from '../../common/db/db.module';

const ORG_ID = 'org-1';
const USER = { orgId: ORG_ID, userId: 'admin-1', email: 'admin@test.com', role: 'admin' } as any;

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

const mockArchive = {
  archive: jest.fn(),
};

describe('ComplianceService', () => {
  describe('exportUser', () => {
    it('should return user data export', async () => {
      const pool = mockPool([
        { rows: [] }, // BEGIN
        { rows: [] }, // SET LOCAL
        { rows: [{ id: 'u-1', email: 'user@test.com', full_name: 'Test User' }], rowCount: 1 }, // user
        { rows: [{ id: 'd-1', name: 'IT' }] }, // departments
        { rows: [{ name: 'requester' }] }, // roles
        { rows: [{ id: 'pr-1', pr_number: 'PR-001' }] }, // prs
        { rows: [] }, // decisions
        { rows: [{ id: 'log-1', action: 'pr.create' }] }, // audit
        { rows: [] }, // COMMIT
      ]);
      const module = await Test.createTestingModule({
        providers: [
          ComplianceService,
          { provide: PG_POOL, useValue: pool },
          { provide: AuditArchiveService, useValue: mockArchive },
        ],
      }).compile();
      const service = module.get(ComplianceService);

      const result = await service.exportUser(USER, 'u-1');

      expect(result.generated_at).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.departments).toHaveLength(1);
      expect(result.purchase_requests).toHaveLength(1);
    });

    it('should throw NotFoundException for missing user', async () => {
      const pool = mockPool([
        { rows: [] }, { rows: [] },
        { rows: [], rowCount: 0 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [
          ComplianceService,
          { provide: PG_POOL, useValue: pool },
          { provide: AuditArchiveService, useValue: mockArchive },
        ],
      }).compile();
      const service = module.get(ComplianceService);

      await expect(service.exportUser(USER, 'bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('redactUser', () => {
    it('should pseudonymize user and return confirmation', async () => {
      const pool = mockPool([
        { rows: [] }, { rows: [] },
        { rows: [{ id: 'u-1' }], rowCount: 1 }, // user exists
        { rows: [], rowCount: 1 }, // UPDATE users
        { rows: [], rowCount: 1 }, // INSERT audit_log
        { rows: [] }, // COMMIT
      ]);
      const module = await Test.createTestingModule({
        providers: [
          ComplianceService,
          { provide: PG_POOL, useValue: pool },
          { provide: AuditArchiveService, useValue: mockArchive },
        ],
      }).compile();
      const service = module.get(ComplianceService);

      const result = await service.redactUser(USER, 'u-1');

      expect(result.redacted).toBe(true);
      expect(result.user_id).toBe('u-1');
    });

    it('should throw NotFoundException for missing user', async () => {
      const pool = mockPool([
        { rows: [] }, { rows: [] },
        { rows: [], rowCount: 0 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [
          ComplianceService,
          { provide: PG_POOL, useValue: pool },
          { provide: AuditArchiveService, useValue: mockArchive },
        ],
      }).compile();
      const service = module.get(ComplianceService);

      await expect(service.redactUser(USER, 'bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('purgeAuditLog', () => {
    it('should archive then delete old logs', async () => {
      mockArchive.archive.mockResolvedValue({ archived: true, key: 's3://backup/audit.json', row_count: 50 });
      const pool = mockPool([
        { rows: [] }, { rows: [] },
        { rows: [], rowCount: 25 }, // DELETE
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [
          ComplianceService,
          { provide: PG_POOL, useValue: pool },
          { provide: AuditArchiveService, useValue: mockArchive },
        ],
      }).compile();
      const service = module.get(ComplianceService);

      const result = await service.purgeAuditLog(USER, 90);

      expect(result.archived).toBe(true);
      expect(result.archive_rows).toBe(50);
      expect(result.deleted).toBe(25);
    });
  });
});
