import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import type { CurrentUser } from '../../common/auth/current-user.decorator';

export interface AttachmentRow {
  id: string;
  pr_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_key: string;
  uploaded_by: string;
  created_at: string;
}

/**
 * NirvaAttachments — file attachments on purchase requests.
 *
 * Storage: in production, files go to S3/GCS via a presigned-URL flow.
 * This service manages the metadata rows; the actual upload is handled
 * by the controller (multipart) or a presigned-URL endpoint.
 */
@Injectable()
export class AttachmentsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  listByPr(user: CurrentUser, prId: string): Promise<AttachmentRow[]> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `SELECT id, pr_id, file_name, file_type, file_size, storage_key,
                uploaded_by, created_at
         FROM pr_attachments
         WHERE pr_id = $1
         ORDER BY created_at`,
        [prId],
      );
      return r.rows;
    });
  }

  create(
    user: CurrentUser,
    prId: string,
    file: { file_name: string; file_type: string; file_size: number; storage_key: string },
  ): Promise<AttachmentRow> {
    return withOrg(this.pool, user.orgId, async (c) => {
      // Verify the PR exists
      const pr = await c.query(
        `SELECT id FROM purchase_requests WHERE id = $1 AND deleted_at IS NULL`,
        [prId],
      );
      if (pr.rowCount === 0) throw new NotFoundException('PR not found');

      const r = await c.query(
        `INSERT INTO pr_attachments (org_id, pr_id, file_name, file_type, file_size, storage_key, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [user.orgId, prId, file.file_name, file.file_type, file.file_size, file.storage_key, user.userId],
      );
      return r.rows[0];
    });
  }

  delete(user: CurrentUser, attachmentId: string): Promise<void> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `DELETE FROM pr_attachments WHERE id = $1 RETURNING id`,
        [attachmentId],
      );
      if (r.rowCount === 0) throw new NotFoundException();
    });
  }
}
