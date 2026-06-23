import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import PDFDocument from 'pdfkit';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import type { CurrentUser } from '../../common/auth/current-user.decorator';

/**
 * Renders a TOR draft to PDF. Streams bytes directly to the response.
 * Body text is emitted as plain paragraphs (markdown headings stripped).
 */
@Injectable()
export class GovPdfService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async render(user: CurrentUser, draftId: string, sink: NodeJS.WritableStream): Promise<void> {
    const draft = await withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `SELECT d.title, d.status, d.body_markdown, d.created_at, o.name AS org_name
         FROM tor_drafts d
         JOIN organizations o ON o.id = d.org_id
         WHERE d.id = $1`,
        [draftId],
      );
      if (r.rowCount === 0) throw new NotFoundException();
      return r.rows[0];
    });

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: { Title: draft.title, Author: 'NIRVAPROCURE' },
    });

    const thaiFontPath = process.env.THAI_FONT_PATH ?? './fonts/NotoSansThai-Regular.ttf';
    try {
      doc.registerFont('thai', thaiFontPath);
      doc.font('thai');
    } catch {
      // Helvetica fallback — Thai may render as boxes without bundled font.
    }

    doc.pipe(sink);

    doc.fontSize(10).fillColor('#6B7280')
      .text(String(draft.org_name ?? 'NIRVAPROCURE'), { align: 'left' })
      .text(new Date().toLocaleString('en-GB'), { align: 'right' })
      .moveDown(0.5);
    doc.strokeColor('#E5E7EB').lineWidth(1)
      .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    doc.fillColor('#111827').fontSize(20).text(String(draft.title), { paragraphGap: 6 });
    doc.fontSize(10).fillColor('#6B7280')
      .text(`Status: ${draft.status} · ${new Date(draft.created_at).toLocaleString('th-TH')}`);
    doc.moveDown(1.5);

    const body = stripMarkdown(String(draft.body_markdown ?? ''));
    if (body.trim()) {
      doc.fillColor('#111827').fontSize(11).text(body, {
        align: 'left',
        paragraphGap: 4,
        lineGap: 2,
      });
    } else {
      doc.fillColor('#6B7280').fontSize(11).text('—');
    }

    doc.end();
  }
}

function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .trim();
}
