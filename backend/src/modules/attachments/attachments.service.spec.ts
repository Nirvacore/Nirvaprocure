import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PG_POOL } from '../../common/db/db.module';
import { AttachmentsService } from './attachments.service';

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

describe('AttachmentsService', () => {
  let svc: AttachmentsService;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: PG_POOL, useValue: makePool(query) },
      ],
    }).compile();
    svc = mod.get(AttachmentsService);
  });

  it('listByPr returns attachments for a PR', async () => {
    const row = { id: 'a1', pr_id: 'p1', file_name: 'test.pdf', file_type: 'application/pdf', file_size: 1024, storage_key: 'k1', uploaded_by: 'u1', created_at: '2026-01-01' };
    enqueue(query, { rows: [row], rowCount: 1 });
    const result = await svc.listByPr(fakeUser, 'p1');
    expect(result).toHaveLength(1);
    expect(result[0].file_name).toBe('test.pdf');
  });

  it('listByPr returns empty array when no attachments', async () => {
    enqueue(query, { rows: [], rowCount: 0 });
    const result = await svc.listByPr(fakeUser, 'p1');
    expect(result).toEqual([]);
  });

  it('create inserts an attachment', async () => {
    const prRow = { id: 'p1' };
    const attached = { id: 'a1', pr_id: 'p1', file_name: 'invoice.pdf', file_type: 'application/pdf', file_size: 2048, storage_key: 's3://bucket/key', uploaded_by: fakeUser.userId, created_at: '2026-01-01' };
    // BEGIN, SET LOCAL
    query.mockResolvedValueOnce(OK);
    query.mockResolvedValueOnce(OK);
    // PR exists check
    query.mockResolvedValueOnce({ rows: [prRow], rowCount: 1 });
    // INSERT
    query.mockResolvedValueOnce({ rows: [attached], rowCount: 1 });
    // COMMIT
    query.mockResolvedValueOnce(OK);

    const result = await svc.create(fakeUser, 'p1', {
      file_name: 'invoice.pdf',
      file_type: 'application/pdf',
      file_size: 2048,
      storage_key: 's3://bucket/key',
    });
    expect(result.file_name).toBe('invoice.pdf');
  });

  it('create throws NotFoundException when PR not found', async () => {
    // BEGIN, SET LOCAL
    query.mockResolvedValueOnce(OK);
    query.mockResolvedValueOnce(OK);
    // PR check returns empty
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    // ROLLBACK
    query.mockResolvedValueOnce(OK);

    await expect(
      svc.create(fakeUser, 'nonexistent', {
        file_name: 'x.pdf', file_type: 'application/pdf', file_size: 100, storage_key: 'k',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('delete removes an attachment', async () => {
    enqueue(query, { rows: [{ id: 'a1' }], rowCount: 1 });
    await expect(svc.delete(fakeUser, 'a1')).resolves.toBeUndefined();
  });

  it('delete throws NotFoundException when attachment not found', async () => {
    enqueueEmpty(query);
    await expect(svc.delete(fakeUser, 'nonexistent')).rejects.toThrow(NotFoundException);
  });
});
