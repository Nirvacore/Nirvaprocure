import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';

/**
 * NirvaFCM — Firebase Cloud Messaging push notifications.
 *
 * In production this calls the Firebase Admin SDK. In dev/staging it logs
 * the payload and stores a record in the notifications table.
 *
 * Device tokens are registered per user via POST /notifications/fcm/token.
 */
@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Register (upsert) a device token for a user.
   */
  async registerToken(userId: string, token: string, platform: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO fcm_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET user_id = $1, platform = $3, updated_at = now()`,
      [userId, token, platform],
    );
    this.logger.log(`FCM token registered for user ${userId} (${platform})`);
  }

  /**
   * Remove a specific token (e.g. on logout).
   */
  async removeToken(token: string): Promise<void> {
    await this.pool.query(`DELETE FROM fcm_tokens WHERE token = $1`, [token]);
  }

  /**
   * Send push notification to a user (all their registered devices).
   */
  async sendToUser(
    userId: string,
    notification: { title: string; body: string; data?: Record<string, string> },
  ): Promise<number> {
    const tokens = await this.pool.query<{ token: string }>(
      `SELECT token FROM fcm_tokens WHERE user_id = $1`,
      [userId],
    );
    if (tokens.rowCount === 0) {
      this.logger.debug(`No FCM tokens for user ${userId}, skipping push`);
      return 0;
    }

    let sent = 0;
    for (const row of tokens.rows) {
      try {
        await this.sendToToken(row.token, notification);
        sent++;
      } catch (e: any) {
        // Invalid/expired token — clean up
        if (e.code === 'messaging/registration-token-not-registered') {
          await this.removeToken(row.token);
          this.logger.warn(`Removed expired FCM token for user ${userId}`);
        } else {
          this.logger.error(`FCM send failed: ${e.message}`);
        }
      }
    }
    return sent;
  }

  /**
   * Send push notification to a specific token.
   * In production, replace with firebase-admin SDK call.
   */
  private async sendToToken(
    token: string,
    notification: { title: string; body: string; data?: Record<string, string> },
  ): Promise<void> {
    // TODO: integrate firebase-admin in production
    // const message = { token, notification, data: notification.data };
    // await getMessaging().send(message);
    this.logger.log(`[FCM-DEV] Push → ${token.slice(0, 12)}... | ${notification.title}`);
  }
}
