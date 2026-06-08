import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PG_POOL } from '../../common/db/db.module';
import { PoService } from './po.service';

const OK = { rows: [], rowCount: 0 };

const makePool = (queryFn: jest.Mock) => ({
  connect: jest.fn().mockResolvedValue({
    query: queryFn,
    release: jest.fn(),
  }),
});

function enqueue(query: jest.Mock, response: { rows: unknown[]; rowCount: number }) {
  query.mockResolvedValueOnce(OK);       // BEGIN
  query.mockResolvedValueOnce(OK);       // SET LOCAL
  query.mockResolvedValueOnce(response); // actual query
  query.mockResolvedValueOnce(OK);       // COMMIT
}

function enqueueEmpty(query: jest.Mock) {
  query.mockResolvedValueOnce(OK);
  query.mockResolvedValueOnce(OK);
  query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
  query.mockResolvedValueOnce(OK);
}

const fakeUser = {
  userId: '11111111-1111-1111-1111-111111111111',
  orgId:  '22222222-2222-2222-2222-222222222222',
  email:  'test@co.th',
  role:   'admin',
};

const fakePo = {
  id: 'po1', po_number: 'PO-2026-0001', pr_id: 'pr1', supplier_id: 's1',
  supplier_name: 'ACME', status: 'draft', total_minor: 50000, currency: 'THB',
  notes: null, issued_by: fakeUser.userId, issued_at: '2026-01-01', created_at: '2026-01-01',
};

describe('PoService', () => {
  let svc: PoService;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        PoService,
        { provide: PG_POOL, useValue: makePool(query) },
      ],
    }).compile();
    svc = mod.get(PoService);
  });

  it('list returns purchase orders', async () => {
    enqueue(query, { rows: [fakePo], rowCount: 1 });
    const result = await svc.list(fakeUser);
    expect(result).toHaveLength(1);
    expect(result[0].po_number).toBe('PO-2026-0001');
  });

  it('list with status filter', async () => {
    enqueue(query, { rows: [fakePo], rowCount: 1 });
    const result = await svc.list(fakeUser, { status: 'draft' });
    expect(result).toHaveLength(1);
  });

  it('list returns empty when no POs', async () => {
    enqueue(query, { rows: [], rowCount: 0 });
    const result = await svc.list(fakeUser);
    expect(result).toEqual([]);
  });

  it('getOne returns a PO with items', async () => {
    const items = [{ id: 'i1', po_id: 'po1', line_no: 1, description: 'Widget', quantity: 10, unit: 'pcs' }];
    // BEGIN, SET LOCAL
    query.mockResolvedValueOnce(OK);
    query.mockResolvedValueOnce(OK);
    // PO query
    query.mockResolvedValueOnce({ rows: [fakePo], rowCount: 1 });
    // items query
    query.mockResolvedValueOnce({ rows: items, rowCount: 1 });
    // COMMIT
    query.mockResolvedValueOnce(OK);

    const result = await svc.getOne(fakeUser, 'po1');
    expect(result.po_number).toBe('PO-2026-0001');
    expect(result.items).toHaveLength(1);
  });

  it('getOne throws NotFoundException when PO not found', async () => {
    enqueueEmpty(query);
    await expect(svc.getOne(fakeUser, 'nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('updateStatus changes PO status', async () => {
    const updated = { ...fakePo, status: 'sent' };
    // BEGIN, SET LOCAL
    query.mockResolvedValueOnce(OK);
    query.mockResolvedValueOnce(OK);
    // UPDATE
    query.mockResolvedValueOnce({ rows: [updated], rowCount: 1 });
    // audit INSERT
    query.mockResolvedValueOnce(OK);
    // COMMIT
    query.mockResolvedValueOnce(OK);

    const result = await svc.updateStatus(fakeUser, 'po1', 'sent');
    expect(result.status).toBe('sent');
  });

  it('updateStatus throws NotFoundException when PO not found', async () => {
    // BEGIN, SET LOCAL
    query.mockResolvedValueOnce(OK);
    query.mockResolvedValueOnce(OK);
    // UPDATE returns nothing
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // ROLLBACK
    query.mockResolvedValueOnce(OK);

    await expect(svc.updateStatus(fakeUser, 'nonexistent', 'sent')).rejects.toThrow(NotFoundException);
  });
});
