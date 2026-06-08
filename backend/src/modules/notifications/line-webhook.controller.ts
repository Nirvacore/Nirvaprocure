import {
  Body, Controller, ForbiddenException, Headers, HttpCode, Inject, Logger, Post, Req,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Pool } from 'pg';
import type { Request } from 'express';
import { PG_POOL } from '../../common/db/db.module';
import { ApprovalsService } from '../approvals/approvals.service';
import { t, DEFAULT_LOCALE, type Locale } from '../../common/i18n/t';

/**
 * LINE Messaging API → webhook callback.
 *
 * Verifies HMAC-SHA256 signature against LINE_CHANNEL_SECRET so we know the
 * payload really came from LINE and not an attacker calling our endpoint
 * directly with crafted postbacks.
 *
 * Currently handles ONE event type: `postback` from Flex Message buttons in
 * pr_submitted templates. The postback data carries `act=approve&inst=<uuid>`
 * or `act=reject&inst=<uuid>` so we can route to ApprovalsService.decide
 * without the user needing to open the web app.
 *
 * Resolving the actor: the postback comes with the LINE user id; we look up
 * the matching `users` row to derive (userId, orgId) before calling the
 * service. If no link exists we reply with a one-liner asking the user to
 * link their account.
 *
 * Excluded from JWT middleware in AppModule because LINE doesn't speak JWT —
 * the signature verification IS the auth.
 */
@Controller('notifications/line')
export class LineWebhookController {
  private readonly logger = new Logger(LineWebhookController.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly approvals: ApprovalsService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-line-signature') signature: string | undefined,
    @Body() body: any,
  ) {
    if (!this.verifySignature(req, signature)) {
      throw new ForbiddenException('Invalid LINE signature');
    }

    const events = (body?.events ?? []) as Array<{
      type: string;
      source?: { userId?: string };
      postback?: { data?: string };
      message?: { type?: string; text?: string };
      replyToken?: string;
    }>;

    for (const ev of events) {
      const lineUserId = ev.source?.userId;
      if (!lineUserId) continue;

      // ── Binding code: plain-text message that is exactly 6 digits ──────────
      if (ev.type === 'message' && ev.message?.type === 'text') {
        const text = (ev.message.text ?? '').trim();
        if (/^\d{6}$/.test(text)) {
          await this.handleBindingCode(lineUserId, text, ev.replyToken);
          continue;
        }
      }

      // ── Approval postback ─────────────────────────────────────────────────
      if (ev.type !== 'postback') continue;
      const data = ev.postback?.data;
      if (!data) continue;

      const parsed = parsePostback(data);
      if (!parsed) continue;

      const u = await this.pool.query(
        `SELECT id, org_id, email, preferred_locale
           FROM users WHERE line_user_id = $1 AND deleted_at IS NULL`,
        [lineUserId],
      );
      if (u.rowCount === 0) {
        this.logger.warn(`LINE user ${lineUserId} not linked to any NirvaProcure account`);
        continue;
      }
      const row = u.rows[0];
      const locale: Locale = (row.preferred_locale ?? DEFAULT_LOCALE) as Locale;
      try {
        await this.approvals.decide(
          { userId: row.id, orgId: row.org_id, email: row.email },
          parsed.instanceId,
          parsed.act,
          t(locale, parsed.act === 'approved' ? 'line.postback.approved' : 'line.postback.rejected'),
        );
      } catch (err) {
        this.logger.error(`LINE postback decide failed: ${(err as Error).message}`);
      }
    }

    return { ok: true };
  }

  /**
   * Called when a LINE user sends a 6-digit plain-text message.
   * Looks up the code in users.line_binding_code (not expired), links the
   * account, then replies to the user via the LINE Reply API.
   */
  private async handleBindingCode(
    lineUserId: string,
    code: string,
    replyToken: string | undefined,
  ): Promise<void> {
    const res = await this.pool.query(
      `UPDATE users
          SET line_user_id              = $1,
              line_binding_code         = NULL,
              line_binding_expires_at   = NULL
        WHERE line_binding_code = $2
          AND line_binding_expires_at > now()
          AND deleted_at IS NULL
        RETURNING id, preferred_locale`,
      [lineUserId, code],
    );

    const row    = res.rows[0] as { id: string; preferred_locale: string | null } | undefined;
    const locale = (row?.preferred_locale ?? DEFAULT_LOCALE) as Locale;

    const replyText = row
      ? t(locale, 'line.bind.success')
      : t(locale, 'line.bind.not_found');

    this.logger.log(row
      ? `LINE binding: user ${row.id} linked to LINE id ${lineUserId}`
      : `LINE binding: unmatched code ${code} from LINE id ${lineUserId}`,
    );

    if (!replyToken) return;
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) return;

    try {
      await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          replyToken,
          messages: [{ type: 'text', text: replyText }],
        }),
      });
    } catch (err) {
      this.logger.error(`LINE binding reply failed: ${(err as Error).message}`);
    }
  }

  /**
   * HMAC-SHA256(raw_body) base64-encoded, compared in constant time.
   *
   * `req.rawBody` is populated by the `rawBody: true` option on NestFactory
   * (wired in main.ts). If it's missing, the body has already been JSON-
   * stringified by NestJS — we fall back to serializing again, which
   * matches LINE's signature in 99% of cases but breaks on lossy JSON
   * shapes (e.g. duplicate keys); the raw-body path is preferred.
   */
  private verifySignature(req: Request & { rawBody?: Buffer }, signature: string | undefined): boolean {
    const secret = process.env.LINE_CHANNEL_SECRET;
    if (!secret) {
      this.logger.warn('LINE_CHANNEL_SECRET not set — rejecting webhook');
      return false;
    }
    if (!signature) return false;

    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}), 'utf8');
    const expected = createHmac('sha256', secret).update(raw).digest('base64');

    try {
      return timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'));
    } catch {
      // Length mismatch → not equal.
      return false;
    }
  }
}

/**
 * Postback payload format we control:  `act=approve&inst=<uuid>`
 * or  `act=reject&inst=<uuid>`. Anything else is ignored.
 */
function parsePostback(data: string): { act: 'approved' | 'rejected'; instanceId: string } | null {
  const params = new URLSearchParams(data);
  const act = params.get('act');
  const inst = params.get('inst');
  if (!inst) return null;
  if (act === 'approve') return { act: 'approved', instanceId: inst };
  if (act === 'reject')  return { act: 'rejected', instanceId: inst };
  return null;
}
