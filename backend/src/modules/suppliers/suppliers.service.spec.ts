import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { PG_POOL } from '../../common/db/db.module';

const ORG_ID = 'org-1';
const USER = { orgId: ORG_ID, userId: 'u-1', email: 'test@test.com', role: 'admin' } as any;

const supplierRow = {
  id: 'sup-1', code: 'SUP-001', name: 'Acme', contact_name: 'John',
  contact_email: 'john@acme.com', contact_phone: '0812345678',
  category: 'general', tax_id: '1234567890123', is_active: true,
  risk_tier: 'LOW', total_pr_count: 5, total_spent_minor: 500000,
  created_at: '2026-01-01',
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
  };
}

describe('SuppliersService', () => {
  let service: SuppliersService;
  let pool: ReturnType<typeof mockPool>;

  describe('list', () => {
    beforeEach(async () => {
      pool = mockPool([
        { rows: [] }, // BEGIN
        { rows: [] }, // SET LOCAL
        { rows: [supplierRow], rowCount: 1 }, // SELECT
        { rows: [] }, // COMMIT
      ]);
      const module: TestingModule = await Test.createTestingModule({
        providers: [SuppliersService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SuppliersService);
    });

    it('should return suppliers', async () => {
      const result = await service.list(USER);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Acme');
    });
  });

  describe('get', () => {
    it('should return a supplier', async () => {
      pool = mockPool([
        { rows: [] }, { rows: [] },
        { rows: [supplierRow], rowCount: 1 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [SuppliersService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SuppliersService);

      const result = await service.get(USER, 'sup-1');
      expect(result.code).toBe('SUP-001');
    });

    it('should throw NotFoundException when not found', async () => {
      pool = mockPool([
        { rows: [] }, { rows: [] },
        { rows: [], rowCount: 0 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [SuppliersService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SuppliersService);

      await expect(service.get(USER, 'bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should insert and return new supplier', async () => {
      const created = { id: 'sup-new', code: 'SUP-002', name: 'NewCo', is_active: true };
      pool = mockPool([
        { rows: [] }, { rows: [] },
        { rows: [created], rowCount: 1 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [SuppliersService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SuppliersService);

      const result = await service.create(USER, { code: 'SUP-002', name: 'NewCo' });
      expect(result.code).toBe('SUP-002');
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when supplier not found', async () => {
      pool = mockPool([
        { rows: [] }, { rows: [] },
        { rows: [], rowCount: 0 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [SuppliersService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SuppliersService);

      await expect(service.update(USER, 'bad', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('archive', () => {
    it('should soft-delete supplier', async () => {
      pool = mockPool([
        { rows: [] }, { rows: [] },
        { rows: [], rowCount: 1 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [SuppliersService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SuppliersService);

      const result = await service.archive(USER, 'sup-1');
      expect(result.ok).toBe(true);
    });

    it('should throw NotFoundException when supplier not found', async () => {
      pool = mockPool([
        { rows: [] }, { rows: [] },
        { rows: [], rowCount: 0 },
        { rows: [] },
      ]);
      const module = await Test.createTestingModule({
        providers: [SuppliersService, { provide: PG_POOL, useValue: pool }],
      }).compile();
      service = module.get(SuppliersService);

      await expect(service.archive(USER, 'bad')).rejects.toThrow(NotFoundException);
    });
  });
});
