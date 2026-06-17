import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import type { CurrentUser } from '../../common/auth/current-user.decorator';

export type AffiliatePlatform = 'shopee' | 'lazada' | 'makro' | 'alibaba';

export interface AffiliateConfig {
  id: string;
  platform: AffiliatePlatform;
  affiliate_id: string;
  sub_id: string | null;
  is_active: boolean;
  note: string | null;
}

/**
 * Transforms marketplace product URLs into affiliate-tagged versions.
 *
 * How each platform works:
 *
 * ── SHOPEE (shopee.co.th) ──────────────────────────────────────────────────
 *  Shopee Affiliate Program: https://affiliate.shopee.co.th/
 *  After signup you get a Publisher ID. Two URL formats:
 *  1) Short link via API: POST /api/link/generate → returns s.shopee.co.th/XXX
 *  2) Direct tag: append ?af_id={publisher_id}&sub_id={sub} to any product URL
 *
 *  We use option (2) — no API call needed, works immediately.
 *  Commission: 1–10% depending on product category.
 *
 * ── LAZADA (lazada.co.th) ──────────────────────────────────────────────────
 *  Lazada Affiliate (Impact / Partnerize):
 *  https://www.lazada.co.th/programs/lazadaaffiliate/
 *  Publisher creates a tracking link via the dashboard.
 *  URL format: https://c.lazada.co.th/t/c.{TRACKING_ID}?url={ENCODED_PRODUCT_URL}
 *  Commission: 3–7%.
 *
 * ── MAKRO ──────────────────────────────────────────────────────────────────
 *  Makro does not have a public affiliate API (B2B, account-based pricing).
 *  We store the affiliate_id but skip URL transformation unless custom logic
 *  is provided via note/sub_id.
 *
 * ── ALIBABA ────────────────────────────────────────────────────────────────
 *  Alibaba Affiliate (Alliance): https://portals.aliexpress.com/
 *  URL format: append ?aff_trace_key={KEY}&aff_platform=portals
 *  Commission: 2–8%.
 */
@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // ── Config CRUD ────────────────────────────────────────────────────────────

  listConfig(user: CurrentUser): Promise<AffiliateConfig[]> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query<AffiliateConfig>(
        `SELECT id, platform, affiliate_id, sub_id, is_active, note
           FROM org_affiliate_config
          ORDER BY platform`,
      );
      return r.rows;
    });
  }

  async upsertConfig(
    user: CurrentUser,
    body: { platform: AffiliatePlatform; affiliate_id: string; sub_id?: string; note?: string },
  ): Promise<AffiliateConfig> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query<AffiliateConfig>(
        `INSERT INTO org_affiliate_config (org_id, platform, affiliate_id, sub_id, note, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (org_id, platform) DO UPDATE
           SET affiliate_id = EXCLUDED.affiliate_id,
               sub_id       = EXCLUDED.sub_id,
               note         = EXCLUDED.note,
               is_active    = true,
               updated_at   = now()
         RETURNING id, platform, affiliate_id, sub_id, is_active, note`,
        [user.orgId, body.platform, body.affiliate_id, body.sub_id ?? null, body.note ?? null],
      );
      return r.rows[0];
    });
  }

  async toggleConfig(user: CurrentUser, id: string, isActive: boolean): Promise<void> {
    await withOrg(this.pool, user.orgId, async (c) => {
      await c.query(
        `UPDATE org_affiliate_config SET is_active = $2, updated_at = now() WHERE id = $1`,
        [id, isActive],
      );
    });
  }

  async deleteConfig(user: CurrentUser, id: string): Promise<void> {
    await withOrg(this.pool, user.orgId, async (c) => {
      await c.query(`DELETE FROM org_affiliate_config WHERE id = $1`, [id]);
    });
  }

  // ── URL transformation ─────────────────────────────────────────────────────

  /**
   * Given a raw product URL, look up the org's affiliate config for that
   * platform and return an affiliate-tagged URL.  Returns the original URL
   * unchanged if no active config exists.
   *
   * Also records the click in `affiliate_clicks` for reporting.
   */
  async tagUrl(orgId: string, originalUrl: string): Promise<string> {
    const host = (() => {
      try { return new URL(originalUrl).hostname.toLowerCase(); }
      catch { return ''; }
    })();

    const platform = this.detectPlatform(host);
    if (!platform) return originalUrl;

    const cfg = await this.loadConfig(orgId, platform);
    if (!cfg || !cfg.is_active) return originalUrl;

    const tagged = this.applyTag(originalUrl, platform, cfg.affiliate_id, cfg.sub_id);

    // Fire-and-forget click record.
    this.recordClick(orgId, platform, originalUrl, tagged).catch((e) =>
      this.logger.warn(`affiliate_clicks insert failed: ${(e as Error).message}`),
    );

    this.logger.log(`Affiliate tag applied: platform=${platform} org=${orgId}`);
    return tagged;
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  /** Monthly affiliate click count per platform for this org. */
  async clickStats(user: CurrentUser): Promise<{ platform: string; clicks: number }[]> {
    return withOrg(this.pool, user.orgId, async (c) => {
      const rows = await c.query<{ platform: string; clicks: string }>(
        `SELECT platform, COUNT(*)::text AS clicks
           FROM affiliate_clicks
          WHERE created_at >= date_trunc('month', now())
          GROUP BY platform
          ORDER BY clicks DESC`,
      );
      return rows.rows.map((r) => ({ platform: r.platform, clicks: Number(r.clicks) }));
    });
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private detectPlatform(host: string): AffiliatePlatform | null {
    if (host.endsWith('shopee.co.th') || host.endsWith('shopee.com')) return 'shopee';
    if (host.endsWith('lazada.co.th') || host.endsWith('lazada.com'))  return 'lazada';
    if (host.endsWith('makro.pro'))                                    return 'makro';
    if (host.endsWith('alibaba.com') || host.endsWith('aliexpress.com')) return 'alibaba';
    return null;
  }

  private async loadConfig(orgId: string, platform: string): Promise<AffiliateConfig | null> {
    const r = await this.pool.query<AffiliateConfig>(
      `SELECT id, platform, affiliate_id, sub_id, is_active, note
         FROM org_affiliate_config
        WHERE org_id = $1 AND platform = $2`,
      [orgId, platform],
    );
    return r.rows[0] ?? null;
  }

  private applyTag(
    originalUrl: string,
    platform: AffiliatePlatform,
    affiliateId: string,
    subId: string | null,
  ): string {
    try {
      switch (platform) {

        case 'shopee': {
          // Append ?af_id=PUBLISHER_ID&sub_id=SUB (sub optional)
          const u = new URL(originalUrl);
          // Strip any existing tracking params first to avoid conflicts.
          ['af_id', 'sub_id', 'utm_source', 'utm_medium', 'utm_campaign'].forEach((p) =>
            u.searchParams.delete(p),
          );
          u.searchParams.set('af_id', affiliateId);
          if (subId) u.searchParams.set('sub_id', subId);
          return u.toString();
        }

        case 'lazada': {
          // c.lazada.co.th/t/c.{TRACKING_ID}?url={ENCODED_ORIGINAL}
          const base = `https://c.lazada.co.th/t/c.${affiliateId}`;
          const dest = new URL(base);
          dest.searchParams.set('url', originalUrl);
          if (subId) dest.searchParams.set('sub', subId);
          return dest.toString();
        }

        case 'alibaba': {
          // Append ?aff_trace_key=KEY&aff_platform=portals
          const u = new URL(originalUrl);
          u.searchParams.set('aff_trace_key', affiliateId);
          u.searchParams.set('aff_platform', 'portals');
          if (subId) u.searchParams.set('aff_sub', subId);
          return u.toString();
        }

        default:
          // makro: no standard affiliate URL scheme, return original.
          return originalUrl;
      }
    } catch {
      return originalUrl;
    }
  }

  private async recordClick(
    orgId: string,
    platform: string,
    originalUrl: string,
    affiliateUrl: string,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO affiliate_clicks (org_id, platform, original_url, affiliate_url)
       VALUES ($1, $2, $3, $4)`,
      [orgId, platform, originalUrl, affiliateUrl],
    );
  }
}
