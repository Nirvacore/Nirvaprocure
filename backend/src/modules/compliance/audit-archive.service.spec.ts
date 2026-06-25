import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PG_POOL } from '../../common/db/db.module';
import { AuditArchiveService } from './audit-archive.service';

/* ── Helpers ───────────────────────────────────────────────────────────────── */

const ORG_ID = 'org-test-001';
const OK = { rows: [], rowCount: 0 };

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

const fakeRows = [
  {
    id: 'log-1',
    org_id: ORG_ID,
    actor_user_id: 'user-1',
    action: 'pr.create',
    entity_type: 'purchase_request',
    entity_id: 'pr-001',
    diff: { status: ['draft', 'submitted'] },
    created_at: new Date('2025-01-10T08:00:00Z'),
  },
  {
    id: 'log-2',
    org_id: ORG_ID,
    actor_user_id: 'user-2',
    action: 'po.approve',
    entity_type: 'purchase_order',
    entity_id: 'po-001',
    diff: { status: ['pending', 'approved'] },
    created_at: new Date('2025-02-15T14:30:00Z'),
  },
  {
    id: 'log-3',
    org_id: ORG_ID,
    actor_user_id: 'user-1',
    action: 'supplier.update',
    entity_type: 'supplier',
    entity_id: 's-001',
    diff: { risk_tier: ['medium', 'low'] },
    created_at: new Date('2025-03-20T09:15:00Z'),
  },
];

/* ── Mock S3 ─────────────────────────────────────────────────────────────── */

const mockS3Send = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockS3Send,
  })),
  PutObjectCommand: jest.fn().mockImplementation((params: any) => params),
}));

/* ── Tests ────────────────────────────────────────────────────────────────── */

describe('AuditArchiveService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── enabled getter ──────────────────────────────────────────────────────

  describe('enabled', () => {
    it('returns false when AUDIT_ARCHIVE_BUCKET is not set', async () => {
      delete process.env.AUDIT_ARCHIVE_BUCKET;

      const pool = mockPool([]);
      const mod = await Test.createTestingModule({
        providers: [
          AuditArchiveService,
          { provide: PG_POOL, useValue: pool },
        ],
      }).compile();
      const svc = mod.get(AuditArchiveService);

      expect(svc.enabled).toBe(false);
    });

    it('returns true when AUDIT_ARCHIVE_BUCKET is set', async () => {
      process.env.AUDIT_ARCHIVE_BUCKET = 'test-archive-bucket';

      const pool = mockPool([]);
      const mod = await Test.createTestingModule({
        providers: [
          AuditArchiveService,
          { provide: PG_POOL, useValue: pool },
        ],
      }).compile();
      const svc = mod.get(AuditArchiveService);

      expect(svc.enabled).toBe(true);

      delete process.env.AUDIT_ARCHIVE_BUCKET;
    });
  });

  // ── archive() when disabled ─────────────────────────────────────────────

  describe('archive when disabled', () => {
    let svc: AuditArchiveService;

    beforeEach(async () => {
      delete process.env.AUDIT_ARCHIVE_BUCKET;
      const pool = mockPool([]);
      const mod = await Test.createTestingModule({
        providers: [
          AuditArchiveService,
          { provide: PG_POOL, useValue: pool },
        ],
      }).compile();
      svc = mod.get(AuditArchiveService);
    });

    it('returns archived=false and row_count=0 when bucket is not configured', async () => {
      const result = await svc.archive(ORG_ID, 90);
      expect(result.archived).toBe(false);
      expect(result.row_count).toBe(0);
      expect(result.bucket).toBeUndefined();
      expect(result.key).toBeUndefined();
    });

    it('does not connect to the database pool', async () => {
      const pool = mockPool([]);
      const mod = await Test.createTestingModule({
        providers: [
          AuditArchiveService,
          { provide: PG_POOL, useValue: pool },
        ],
      }).compile();
      const svc2 = mod.get(AuditArchiveService);

      await svc2.archive(ORG_ID, 30);
      expect(pool.connect).not.toHaveBeenCalled();
    });
  });

  // ── archive() when enabled ──────────────────────────────────────────────

  describe('archive when enabled', () => {
    let svc: AuditArchiveService;
    let pool: ReturnType<typeof mockPool>;

    beforeEach(async () => {
      process.env.AUDIT_ARCHIVE_BUCKET = 'test-archive-bucket';
      pool = mockPool([
        OK,           // BEGIN
        OK,           // SET LOCAL app.current_org
        { rows: fakeRows, rowCount: fakeRows.length },  // SELECT audit_log
        OK,           // COMMIT
      ]);
      mockS3Send.mockResolvedValue({});

      const mod = await Test.createTestingModule({
        providers: [
          AuditArchiveService,
          { provide: PG_POOL, useValue: pool },
        ],
      }).compile();
      svc = mod.get(AuditArchiveService);
    });

    afterEach(() => {
      delete process.env.AUDIT_ARCHIVE_BUCKET;
    });

    it('returns correct archive metadata for rows found', async () => {
      const result = await svc.archive(ORG_ID, 90);

      expect(result.archived).toBe(true);
      expect(result.row_count).toBe(3);
      expect(result.bucket).toBe('test-archive-bucket');
      expect(result.key).toContain(ORG_ID);
      expect(result.key).toMatch(/\.jsonl\.gz$/);
      expect(result.byte_size).toBeGreaterThan(0);
    });

    it('sets earliest and latest timestamps from the row data', async () => {
      const result = await svc.archive(ORG_ID, 90);

      expect(result.earliest).toBe('2025-01-10T08:00:00.000Z');
      expect(result.latest).toBe('2025-03-20T09:15:00.000Z');
    });

    it('key includes row count in the filename', async () => {
      const result = await svc.archive(ORG_ID, 90);
      expect(result.key).toContain('-3.jsonl.gz');
    });

    it('key includes the current date', async () => {
      const result = await svc.archive(ORG_ID, 90);
      const today = new Date().toISOString().slice(0, 10);
      expect(result.key).toContain(today);
    });

    it('sets org_id via SET LOCAL before querying audit_log', async () => {
      await svc.archive(ORG_ID, 90);

      const queries = pool.client.query.mock.calls;
      // Call 0: BEGIN, Call 1: SET LOCAL
      expect(queries[1][0]).toContain('SET LOCAL app.current_org');
      expect(queries[1][1]).toEqual([ORG_ID]);
    });

    it('passes olderThanDays as interval to the SELECT query', async () => {
      await svc.archive(ORG_ID, 180);

      const queries = pool.client.query.mock.calls;
      // Call 2: SELECT audit_log
      expect(queries[2][1]).toEqual(['180 days']);
    });

    it('sends PutObjectCommand to S3', async () => {
      await svc.archive(ORG_ID, 90);

      expect(mockS3Send).toHaveBeenCalledTimes(1);
      const putCommand = mockS3Send.mock.calls[0][0];
      expect(putCommand.Bucket).toBe('test-archive-bucket');
      expect(putCommand.Key).toContain(ORG_ID);
      expect(putCommand.ContentType).toBe('application/x-ndjson');
      expect(putCommand.ContentEncoding).toBe('gzip');
      expect(putCommand.Body).toBeInstanceOf(Buffer);
    });

    it('releases the database client in the finally block', async () => {
      await svc.archive(ORG_ID, 90);
      expect(pool.client.release).toHaveBeenCalledTimes(1);
    });

    it('body is valid gzip containing JSONL', async () => {
      const { gunzipSync } = require('zlib');
      await svc.archive(ORG_ID, 90);

      const body = mockS3Send.mock.calls[0][0].Body as Buffer;
      const decompressed = gunzipSync(body).toString('utf8');
      const lines = decompressed.split('\n').filter(Boolean);

      expect(lines).toHaveLength(3);
      const firstLine = JSON.parse(lines[0]);
      expect(firstLine.id).toBe('log-1');
      expect(firstLine.action).toBe('pr.create');
    });
  });

  // ── archive() when zero rows found ──────────────────────────────────────

  describe('archive when no rows match', () => {
    it('returns archived=true with row_count=0 and no S3 upload', async () => {
      process.env.AUDIT_ARCHIVE_BUCKET = 'test-archive-bucket';

      const pool = mockPool([
        OK,           // BEGIN
        OK,           // SET LOCAL
        { rows: [], rowCount: 0 },  // SELECT returns nothing
        OK,           // COMMIT
      ]);
      mockS3Send.mockResolvedValue({});

      const mod = await Test.createTestingModule({
        providers: [
          AuditArchiveService,
          { provide: PG_POOL, useValue: pool },
        ],
      }).compile();
      const svc = mod.get(AuditArchiveService);

      const result = await svc.archive(ORG_ID, 90);

      expect(result.archived).toBe(true);
      expect(result.row_count).toBe(0);
      expect(result.bucket).toBeUndefined();
      expect(result.key).toBeUndefined();
      expect(result.earliest).toBeUndefined();
      expect(result.latest).toBeUndefined();
      expect(mockS3Send).not.toHaveBeenCalled();

      delete process.env.AUDIT_ARCHIVE_BUCKET;
    });
  });

  // ── archive() when single row found ─────────────────────────────────────

  describe('archive with a single row', () => {
    it('sets earliest and latest to the same timestamp', async () => {
      process.env.AUDIT_ARCHIVE_BUCKET = 'test-archive-bucket';

      const singleRow = [fakeRows[0]];
      const pool = mockPool([
        OK, OK,
        { rows: singleRow, rowCount: 1 },
        OK,
      ]);
      mockS3Send.mockResolvedValue({});

      const mod = await Test.createTestingModule({
        providers: [
          AuditArchiveService,
          { provide: PG_POOL, useValue: pool },
        ],
      }).compile();
      const svc = mod.get(AuditArchiveService);
      const result = await svc.archive(ORG_ID, 30);

      expect(result.earliest).toBe(result.latest);
      expect(result.row_count).toBe(1);
      expect(result.key).toContain('-1.jsonl.gz');

      delete process.env.AUDIT_ARCHIVE_BUCKET;
    });
  });

  // ── S3 upload failure ─────────────────────────────────────────────────

  describe('S3 upload failure', () => {
    it('throws ServiceUnavailableException when S3 send fails', async () => {
      process.env.AUDIT_ARCHIVE_BUCKET = 'test-archive-bucket';

      const pool = mockPool([
        OK, OK,
        { rows: fakeRows, rowCount: fakeRows.length },
        OK,  // COMMIT
        OK,  // ROLLBACK (from catch block)
      ]);
      mockS3Send.mockRejectedValue(new Error('S3 network timeout'));

      const mod = await Test.createTestingModule({
        providers: [
          AuditArchiveService,
          { provide: PG_POOL, useValue: pool },
        ],
      }).compile();
      const svc = mod.get(AuditArchiveService);

      await expect(svc.archive(ORG_ID, 90)).rejects.toThrow(ServiceUnavailableException);

      delete process.env.AUDIT_ARCHIVE_BUCKET;
    });

    it('error message says "Archive storage unavailable"', async () => {
      process.env.AUDIT_ARCHIVE_BUCKET = 'test-archive-bucket';

      const pool = mockPool([
        OK, OK,
        { rows: fakeRows, rowCount: fakeRows.length },
        OK, OK,
      ]);
      mockS3Send.mockRejectedValue(new Error('S3 access denied'));

      const mod = await Test.createTestingModule({
        providers: [
          AuditArchiveService,
          { provide: PG_POOL, useValue: pool },
        ],
      }).compile();
      const svc = mod.get(AuditArchiveService);

      await expect(svc.archive(ORG_ID, 90)).rejects.toThrow('Archive storage unavailable');

      delete process.env.AUDIT_ARCHIVE_BUCKET;
    });

    it('releases database client even when S3 fails', async () => {
      process.env.AUDIT_ARCHIVE_BUCKET = 'test-archive-bucket';

      const pool = mockPool([
        OK, OK,
        { rows: fakeRows, rowCount: fakeRows.length },
        OK, OK,
      ]);
      mockS3Send.mockRejectedValue(new Error('S3 access denied'));

      const mod = await Test.createTestingModule({
        providers: [
          AuditArchiveService,
          { provide: PG_POOL, useValue: pool },
        ],
      }).compile();
      const svc = mod.get(AuditArchiveService);

      await expect(svc.archive(ORG_ID, 90)).rejects.toThrow();
      expect(pool.client.release).toHaveBeenCalledTimes(1);

      delete process.env.AUDIT_ARCHIVE_BUCKET;
    });
  });

  // ── Database query failure ──────────────────────────────────────────────

  describe('database query failure', () => {
    it('rolls back and releases client when SELECT fails', async () => {
      process.env.AUDIT_ARCHIVE_BUCKET = 'test-archive-bucket';

      const queryFn = jest.fn()
        .mockResolvedValueOnce(OK)   // BEGIN
        .mockResolvedValueOnce(OK)   // SET LOCAL
        .mockRejectedValueOnce(new Error('relation "audit_log" does not exist'))  // SELECT fails
        .mockResolvedValueOnce(OK);  // ROLLBACK

      const pool = {
        connect: jest.fn().mockResolvedValue({
          query: queryFn,
          release: jest.fn(),
        }),
      };

      const mod = await Test.createTestingModule({
        providers: [
          AuditArchiveService,
          { provide: PG_POOL, useValue: pool },
        ],
      }).compile();
      const svc = mod.get(AuditArchiveService);

      await expect(svc.archive(ORG_ID, 90)).rejects.toThrow('relation "audit_log" does not exist');

      const client = await pool.connect();
      expect(client.release).toHaveBeenCalled();

      delete process.env.AUDIT_ARCHIVE_BUCKET;
    });
  });
});
