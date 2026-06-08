import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { gzipSync } from 'zlib';
import { PG_POOL } from '../../common/db/db.module';

interface ArchiveResult {
  archived: boolean;
  bucket?: string;
  key?: string;
  byte_size?: number;
  row_count: number;
  earliest?: string;
  latest?: string;
}

/**
 * Archive audit_log rows older than `olderThanDays` to S3 (or compatible
 * object storage — works with MinIO, Wasabi, R2 via S3-compatible endpoint).
 *
 * Compatible config:
 *   - AUDIT_ARCHIVE_BUCKET   required to enable archival
 *   - AUDIT_ARCHIVE_REGION   defaults to ap-southeast-1 (Singapore — closest
 *                             to Thailand at the time of writing)
 *   - AUDIT_ARCHIVE_ENDPOINT optional, set for MinIO/R2
 *
 * Flow:
 *   1. SELECT rows older than cutoff for the calling org.
 *   2. Gzip the JSON payload.
 *   3. PutObject to `s3://<bucket>/<org>/<YYYY-MM-DD>.jsonl.gz`.
 *   4. Return metadata; CALLER decides whether to then DELETE.
 *
 * We intentionally split archive vs delete so the compliance endpoint can
 * archive on Mondays and delete only after verifying the archive landed.
 */
@Injectable()
export class AuditArchiveService {
  private readonly logger = new Logger(AuditArchiveService.name);
  private readonly s3: S3Client | null;
  private readonly bucket: string | undefined;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    this.bucket = process.env.AUDIT_ARCHIVE_BUCKET;
    this.s3 = this.bucket
      ? new S3Client({
          region: process.env.AUDIT_ARCHIVE_REGION ?? 'ap-southeast-1',
          endpoint: process.env.AUDIT_ARCHIVE_ENDPOINT,
          forcePathStyle: !!process.env.AUDIT_ARCHIVE_ENDPOINT,
        })
      : null;
  }

  get enabled(): boolean {
    return !!(this.s3 && this.bucket);
  }

  async archive(orgId: string, olderThanDays: number): Promise<ArchiveResult> {
    if (!this.enabled) {
      // Caller can still purge — but should know archive is OFF.
      this.logger.warn('AUDIT_ARCHIVE_BUCKET not set — archive skipped, purge proceeding bare');
      return { archived: false, row_count: 0 };
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_org = $1`, [orgId]);
      const res = await client.query(
        `SELECT id, org_id, actor_user_id, action, entity_type, entity_id, diff, created_at
         FROM audit_log
         WHERE created_at < (now() - $1::interval)
         ORDER BY created_at`,
        [`${olderThanDays} days`],
      );
      const rows = res.rows;
      await client.query('COMMIT');

      if (rows.length === 0) {
        return { archived: true, row_count: 0 };
      }

      const earliest = rows[0].created_at.toISOString();
      const latest   = rows[rows.length - 1].created_at.toISOString();

      // JSON Lines is friendlier than a single JSON blob for grep + big sizes.
      const jsonl = rows.map((r) => JSON.stringify(r)).join('\n');
      const body  = gzipSync(Buffer.from(jsonl, 'utf8'));
      const key   = `${orgId}/${new Date().toISOString().slice(0, 10)}-${rows.length}.jsonl.gz`;

      try {
        await this.s3!.send(new PutObjectCommand({
          Bucket: this.bucket!,
          Key:    key,
          Body:   body,
          ContentType:     'application/x-ndjson',
          ContentEncoding: 'gzip',
          // Object-lock + Glacier transition belong on the bucket policy, not
          // on individual PutObjects — keep this call lean.
        }));
      } catch (err) {
        this.logger.error(`Audit archive upload failed: ${(err as Error).message}`);
        throw new ServiceUnavailableException('Archive storage unavailable');
      }

      return {
        archived:   true,
        bucket:     this.bucket,
        key,
        byte_size:  body.byteLength,
        row_count:  rows.length,
        earliest,
        latest,
      };
    } catch (err) {
      await safeRollback(client);
      throw err;
    } finally {
      client.release();
    }
  }
}

async function safeRollback(c: PoolClient) {
  try { await c.query('ROLLBACK'); } catch { /* already aborted */ }
}
