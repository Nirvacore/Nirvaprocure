import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface SendOpts {
  to:      string | string[];
  subject: string;
  text?:   string;
  html?:   string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}

/**
 * Thin SMTP wrapper. Lazy-initializes the nodemailer transport on first
 * send so app startup doesn't fail when SMTP isn't configured (dev).
 *
 * When SMTP_HOST is unset we log instead of sending, so calling code can
 * always invoke `send()` without checking for config.
 *
 * Production checklist:
 *   - Use a transactional provider (SendGrid, AWS SES, Postmark, Resend).
 *   - Configure SPF + DKIM on the from-domain so we're not in spam.
 *   - Set FROM_NAME / FROM_EMAIL so the supplier knows it's NIRVAPROCURE.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transport: nodemailer.Transporter | null = null;

  get enabled(): boolean {
    return !!process.env.SMTP_HOST;
  }

  async send(opts: SendOpts): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(`[STUB] email.send to=${[opts.to].flat().join(',')} subject="${opts.subject}"`);
      return;
    }
    const tx = this.lazy();
    const from = `${process.env.FROM_NAME ?? 'NIRVAPROCURE'} <${process.env.FROM_EMAIL ?? 'noreply@nirvaprocure.local'}>`;
    try {
      const info = await tx.sendMail({
        from,
        to:      opts.to,
        subject: opts.subject,
        text:    opts.text,
        html:    opts.html,
        attachments: opts.attachments,
      });
      this.logger.log(`email sent: ${info.messageId}`);
    } catch (err) {
      this.logger.error(`email send failed: ${(err as Error).message}`);
      // Caller may want to retry; swallow here so the calling business
      // flow (e.g. approval) doesn't roll back on transient SMTP issues.
    }
  }

  private lazy(): nodemailer.Transporter {
    if (this.transport) return this.transport;
    this.transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS!,
      } : undefined,
      // Tight timeouts — slow SMTP servers should never block the API thread
      // for more than ~10s. Persistent failures fall to the warn log above.
      connectionTimeout: 10_000,
      greetingTimeout:   10_000,
      socketTimeout:     10_000,
    });
    return this.transport;
  }
}
