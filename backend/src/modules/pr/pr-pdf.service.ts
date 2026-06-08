import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import PDFDocument from 'pdfkit';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import type { CurrentUser } from '../../common/auth/current-user.decorator';
import { t, DEFAULT_LOCALE, type Locale } from '../../common/i18n/t';

/**
 * Renders an official PR document to PDF. Streams the bytes so memory stays
 * flat for large PRs.
 *
 * Output sections, top to bottom:
 *   1. Letterhead: NIRVAPROCURE + org name + generation timestamp
 *   2. Header block: PR number, title, requester, department, submitted_at
 *   3. Items table
 *   4. Total
 *   5. Justification
 *   6. Approval trail with signature placeholders
 *
 * Thai rendering: pdfkit's default Helvetica doesn't have Thai glyphs. We
 * register `NotoSansThai-Regular.ttf` if it's available on disk (bundled
 * with the Docker image under /app/fonts). When absent, Thai characters
 * render as boxes — flagged in logs so ops knows to mount the font.
 */
@Injectable()
export class PrPdfService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async render(user: CurrentUser, prId: string, sink: NodeJS.WritableStream): Promise<void> {
    const ctx = await withOrg(this.pool, user.orgId, async (c) => {
      const pr = await c.query(
        `SELECT pr.*, u.full_name AS requester_name, u.preferred_locale AS requester_locale,
                d.name AS department_name, o.name AS org_name
         FROM purchase_requests pr
         JOIN organizations o ON o.id = pr.org_id
         JOIN users u         ON u.id = pr.requester_id
         LEFT JOIN departments d ON d.id = pr.department_id
         WHERE pr.id = $1 AND pr.deleted_at IS NULL`, [prId],
      );
      if (pr.rowCount === 0) throw new NotFoundException();

      const items = await c.query(
        `SELECT line_no, description, quantity, unit, unit_price_minor, line_total_minor
         FROM purchase_request_items WHERE pr_id = $1 ORDER BY line_no`,
        [prId],
      );
      const trail = await c.query(
        `SELECT step_no, decision, comment, decided_at, u.full_name AS approver_name
         FROM approval_decisions ad
         JOIN approval_instances ai ON ai.id = ad.instance_id
         JOIN users u               ON u.id = ad.approver_id
         WHERE ai.pr_id = $1 ORDER BY ad.decided_at`,
        [prId],
      );

      // The viewer's locale (the caller hitting /pdf) takes priority since
      // they're the one looking at the doc right now. We fall back to the
      // requester's locale, then the global default, so an archived PR
      // viewed by someone with no locale still renders consistently.
      const callerLocale = await c.query(
        `SELECT preferred_locale FROM users WHERE id = $1`, [user.userId],
      );
      const locale = (callerLocale.rows[0]?.preferred_locale
        ?? pr.rows[0]?.requester_locale
        ?? DEFAULT_LOCALE) as Locale;
      return { pr: pr.rows[0], items: items.rows, trail: trail.rows, locale };
    });
    const L = ctx.locale;

    const doc = new PDFDocument({ size: 'A4', margin: 50, info: {
      Title: `${ctx.pr.pr_number} — ${ctx.pr.title}`,
      Author: 'NIRVAPROCURE',
    }});

    // If a bundled Thai font is available, switch to it so the body text
    // renders correctly. The font path is searched relative to the runtime
    // working directory (Docker image places it under /app/fonts/).
    const thaiFontPath = process.env.THAI_FONT_PATH ?? './fonts/NotoSansThai-Regular.ttf';
    let usingThai = false;
    try {
      doc.registerFont('thai', thaiFontPath);
      doc.font('thai');
      usingThai = true;
    } catch {
      // Fallback: built-in Helvetica. Thai will render as squares.
    }

    doc.pipe(sink);

    // 1. Letterhead
    doc.fontSize(10).fillColor('#6B7280')
       .text(String(ctx.pr.org_name ?? 'NIRVAPROCURE'), { align: 'left' })
       .text(new Date().toLocaleString('en-GB'), { align: 'right' })
       .moveDown(0.5);
    doc.strokeColor('#E5E7EB').lineWidth(1)
       .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    // 2. Header block
    doc.fillColor('#111827').fontSize(11)
       .text(ctx.pr.pr_number);
    doc.fontSize(20).text(String(ctx.pr.title), { paragraphGap: 4 });
    doc.fontSize(10).fillColor('#6B7280')
       .text(`${t(L, 'pdf.requested_by')}: ${ctx.pr.requester_name}` +
             (ctx.pr.department_name ? ` · ${ctx.pr.department_name}` : '') +
             (ctx.pr.submitted_at ? ` · ${new Date(ctx.pr.submitted_at).toLocaleString(L)}` : ''));
    doc.moveDown(1);

    // 3. Items table
    const cols = { line: 50, desc: 90, qty: 350, price: 420, total: 490 };
    doc.fillColor('#111827').fontSize(11);
    doc.text(t(L, 'pdf.col.line'),        cols.line,  doc.y, { width: 30 });
    doc.text(t(L, 'pdf.col.description'), cols.desc,  doc.y - 12);
    doc.text(t(L, 'pdf.col.qty'),         cols.qty,   doc.y - 12, { width: 50,  align: 'right' });
    doc.text(t(L, 'pdf.col.unit_price'),  cols.price, doc.y - 12, { width: 60,  align: 'right' });
    doc.text(t(L, 'pdf.col.total'),       cols.total, doc.y - 12, { width: 60,  align: 'right' });
    doc.moveDown(0.5);
    doc.strokeColor('#E5E7EB').moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);

    for (const it of ctx.items) {
      const rowY = doc.y;
      doc.fontSize(10).fillColor('#374151');
      doc.text(String(it.line_no), cols.line, rowY, { width: 30 });
      doc.text(String(it.description), cols.desc, rowY, { width: 250 });
      doc.text(String(it.quantity),    cols.qty,   rowY, { width: 50, align: 'right' });
      doc.text(fmtBaht(it.unit_price_minor), cols.price, rowY, { width: 60, align: 'right' });
      doc.text(fmtBaht(it.line_total_minor), cols.total, rowY, { width: 60, align: 'right' });
      doc.moveDown(0.6);
    }
    doc.moveDown(0.5);

    // 4. Total
    doc.strokeColor('#E5E7EB').moveTo(350, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fontSize(12).fillColor('#111827')
       .text(t(L, 'pdf.total'), 350, doc.y, { width: 80, continued: true })
       .text(`฿ ${fmtBaht(ctx.pr.total_minor)}`, { width: 140, align: 'right' });
    doc.moveDown(1.5);

    // 5. Justification
    if (ctx.pr.justification) {
      doc.fillColor('#6B7280').fontSize(10).text(t(L, 'pdf.justification'));
      doc.moveDown(0.2);
      doc.fillColor('#111827').fontSize(11).text(String(ctx.pr.justification), {
        align: 'left',
        paragraphGap: 4,
      });
      doc.moveDown(1.5);
    }

    // 6. Approval trail + signature lines. Loop variable named `row` to avoid
    // shadowing the imported `t` translator.
    doc.fillColor('#6B7280').fontSize(10).text(t(L, 'pdf.approval_trail'));
    doc.moveDown(0.3);
    if (ctx.trail.length === 0) {
      doc.fillColor('#6B7280').fontSize(11).text(t(L, 'pdf.no_decisions'));
    } else {
      for (const row of ctx.trail) {
        doc.fillColor('#111827').fontSize(11).text(
          `${t(L, 'pdf.step', { n: row.step_no })} · ${row.decision.toUpperCase()} — ${row.approver_name} · ${new Date(row.decided_at).toLocaleString(L)}`,
        );
        if (row.comment) doc.fillColor('#6B7280').fontSize(10).text(`   "${row.comment}"`);
      }
    }

    // Signature lines for printed sign-off (procurement workflows often
    // require wet signatures alongside the digital trail).
    doc.moveDown(2);
    const lineY = doc.y;
    doc.strokeColor('#9CA3AF').moveTo(80,  lineY).lineTo(240, lineY).stroke();
    doc.strokeColor('#9CA3AF').moveTo(330, lineY).lineTo(490, lineY).stroke();
    doc.fillColor('#6B7280').fontSize(9)
       .text(t(L, 'pdf.signature.requester'), 80,  lineY + 4, { width: 160, align: 'center' })
       .text(t(L, 'pdf.signature.approver'),  330, lineY + 4, { width: 160, align: 'center' });

    // Hidden ops note in the metadata, not the document body.
    if (!usingThai) {
      doc.info.Subject = 'WARN: Thai font missing — set THAI_FONT_PATH';
    }

    doc.end();
  }
}

function fmtBaht(amountMinor: number | string): string {
  const n = typeof amountMinor === 'number' ? amountMinor : Number(amountMinor ?? 0);
  return (n / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
