import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { t, DEFAULT_LOCALE, type Locale } from '../../common/i18n/t';

export type NotificationTemplate =
  | 'pr_submitted'        // → approver: "ใบขอใหม่รอคุณ"
  | 'pr_decided'          // → requester: "หัวหน้าอนุมัติ/ไม่อนุมัติ"
  | 'reorder_digest';     // → stock manager: "X ชิ้น stock ต่ำ"

export interface LinePushOptions {
  /** Target user id. We look up `users.line_user_id` from this. */
  user_id: string;
  /** Org scope — the user must belong to this org. */
  org_id: string;
  /** Template controls the message text on the LINE side. */
  template: NotificationTemplate;
  /** Free-form payload merged into the message body. */
  payload: Record<string, unknown>;
}

/**
 * LINE Messaging API push wrapper.
 *
 * Production flow:
 *   1. Look up the target user's `line_user_id` (the LINE-side id, NOT our UUID).
 *   2. Render a Flex Message per template (see prompts/line_*.json — TBD).
 *   3. POST to https://api.line.me/v2/bot/message/push.
 *   4. Persist into the `notifications` table for retry + UI mirror.
 *
 * Today, when LINE_CHANNEL_ACCESS_TOKEN isn't set, we still write the row
 * to `notifications` so the app can show "sent (stub)" everywhere and the
 * mock LINE preview screen has real data to reflect.
 */
@Injectable()
export class LineNotifier {
  private readonly logger = new Logger(LineNotifier.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async send(opts: LinePushOptions): Promise<void> {
    // Record the intent first — UI shows queued status while we attempt
    // the real send. If the send fails we update status to 'failed' so a
    // background retry can pick it up.
    const inserted = await this.pool.query(
      `INSERT INTO notifications (org_id, user_id, channel, template, payload, status)
       VALUES ($1, $2, 'line', $3, $4::jsonb, 'pending')
       RETURNING id`,
      [opts.org_id, opts.user_id, opts.template, JSON.stringify(opts.payload)],
    );
    const notificationId = inserted.rows[0]?.id as string | undefined;

    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      this.logger.warn(`[STUB] line.send template=${opts.template} user=${opts.user_id} payload=${JSON.stringify(opts.payload)}`);
      await this.markSent(notificationId);
      return;
    }

    // Single-row lookup of LINE id + preferred_locale. Doing it together
    // keeps us at one round trip when we have both columns available.
    const lineUser = await this.pool.query(
      `SELECT line_user_id, preferred_locale
         FROM users
        WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
      [opts.user_id, opts.org_id],
    );
    const lineUserId = lineUser.rows[0]?.line_user_id as string | undefined;
    const locale = (lineUser.rows[0]?.preferred_locale ?? DEFAULT_LOCALE) as Locale;
    if (!lineUserId) {
      // User exists but hasn't linked LINE yet. That's not an error — log
      // and move on; UI surface still shows the in-app notification.
      this.logger.log(`User ${opts.user_id} has no LINE id; skipping push`);
      await this.markSent(notificationId);
      return;
    }

    try {
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: lineUserId,
          messages: [renderFlex(opts.template, opts.payload, locale)],
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`LINE push ${res.status}: ${body.slice(0, 200)}`);
        await this.markFailed(notificationId);
        return;
      }
      await this.markSent(notificationId);
    } catch (err) {
      this.logger.error(`LINE push exception: ${(err as Error).message}`);
      await this.markFailed(notificationId);
    }
  }

  private async markSent(id: string | undefined) {
    if (!id) return;
    await this.pool.query(`UPDATE notifications SET status = 'sent', sent_at = now() WHERE id = $1`, [id]);
  }
  private async markFailed(id: string | undefined) {
    if (!id) return;
    await this.pool.query(`UPDATE notifications SET status = 'failed' WHERE id = $1`, [id]);
  }
}

/**
 * Compose a LINE Flex Message bubble per template. The bubble structure
 * mirrors the preview in ui-wireframe/demo/index.html screen-line so the
 * mockup and reality stay aligned.
 */
function renderFlex(template: NotificationTemplate, payload: Record<string, unknown>, locale: Locale) {
  switch (template) {
    case 'pr_submitted':
      return {
        type: 'flex',
        altText: t(locale, 'line.pr_submitted.alt', { pr_number: String(payload.pr_number ?? '') }),
        contents: {
          type: 'bubble',
          header: bubbleHeader(t(locale, 'line.pr_submitted.eyebrow'), String(payload.title ?? '')),
          body:   bubbleBody([
            [t(locale, 'line.row.pr_number'), String(payload.pr_number ?? '')],
            [t(locale, 'line.row.requester'), String(payload.requester ?? '')],
            [t(locale, 'line.row.total'),     `฿ ${fmtMinor(payload.total_minor)}`],
          ]),
          footer: bubbleActions(String(payload.detail_url ?? '#'), locale),
        },
      };
    case 'pr_decided': {
      const ok = payload.decision === 'approved';
      return {
        type: 'flex',
        altText: t(locale, ok ? 'line.pr_decided.alt.approved' : 'line.pr_decided.alt.rejected',
          { pr_number: String(payload.pr_number ?? '') }),
        contents: {
          type: 'bubble',
          header: bubbleHeader(
            t(locale, ok ? 'line.pr_decided.eyebrow.approved' : 'line.pr_decided.eyebrow.rejected'),
            String(payload.title ?? ''),
          ),
          body:   bubbleBody([
            [t(locale, 'line.row.pr_number'), String(payload.pr_number ?? '')],
            [t(locale, 'line.row.by'),        String(payload.approver ?? '')],
            [t(locale, 'line.row.comment'),   String(payload.comment ?? '—')],
          ]),
        },
      };
    }
    case 'reorder_digest':
      return {
        type: 'text',
        text: t(locale, 'line.reorder.text', { count: Number(payload.count ?? 0) }),
      };
  }
}

function fmtMinor(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return (n / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function bubbleHeader(eyebrow: string, title: string) {
  return {
    type: 'box', layout: 'vertical',
    backgroundColor: '#4F46E5',
    paddingAll: '16px',
    contents: [
      { type: 'text', text: eyebrow, color: '#FFFFFF', size: 'sm', weight: 'regular' },
      { type: 'text', text: title,   color: '#FFFFFF', size: 'lg', weight: 'bold', wrap: true },
    ],
  };
}
function bubbleBody(rows: [string, string][]) {
  return {
    type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px',
    contents: rows.map(([k, v]) => ({
      type: 'box', layout: 'horizontal',
      contents: [
        { type: 'text', text: k, color: '#6B7280', size: 'sm', flex: 1 },
        { type: 'text', text: v, color: '#111827', size: 'sm', weight: 'bold', align: 'end', flex: 2, wrap: true },
      ],
    })),
  };
}
function bubbleActions(url: string, locale: Locale) {
  return {
    type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px',
    contents: [
      { type: 'button', style: 'link',
        action: { type: 'uri', label: t(locale, 'line.action.view_full'), uri: url } },
    ],
  };
}
