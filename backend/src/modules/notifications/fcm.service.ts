import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import * as admin from 'firebase-admin';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private fbInitialized = false;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  onModuleInit() {
    const creds = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!creds) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT not set — FCM runs in dev/stub mode');
      return;
    }
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(JSON.parse(creds)),
        });
      }
      this.fbInitialized = true;
      this.logger.log('Firebase Admin SDK initialized');
    } catch (e: any) {
      this.logger.error(`Firebase init failed: ${e.message} — falling back to stub mode`);
    }
  }

  async registerToken(userId: string, token: string, platform: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO fcm_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET user_id = $1, platform = $3, updated_at = now()`,
      [userId, token, platform],
    );
    this.logger.log(`FCM token registered for user ${userId} (${platform})`);
  }

  async removeToken(token: string): Promise<void> {
    await this.pool.query(`DELETE FROM fcm_tokens WHERE token = $1`, [token]);
  }

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
        if (
          e.code === 'messaging/registration-token-not-registered' ||
          e.code === 'messaging/invalid-registration-token'
        ) {
          await this.removeToken(row.token);
          this.logger.warn(`Removed expired FCM token for user ${userId}`);
        } else {
          this.logger.error(`FCM send failed: ${e.message}`);
        }
      }
    }
    return sent;
  }

  private async sendToToken(
    token: string,
    notification: { title: string; body: string; data?: Record<string, string> },
  ): Promise<void> {
    if (!this.fbInitialized) {
      this.logger.log(`[FCM-DEV] Push → ${token.slice(0, 12)}... | ${notification.title}`);
      return;
    }
    await admin.messaging().send({
      token,
      notification: { title: notification.title, body: notification.body },
      data: notification.data,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
  }
}
