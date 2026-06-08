import { Injectable, Logger } from '@nestjs/common';
import type { ParsedLineItem } from './types';

/**
 * Lazada Thailand product URL parser.
 *
 * Supported URL shapes:
 *   - https://www.lazada.co.th/products/<slug>-i<itemId>-s<skuId>.html
 *   - https://www.lazada.co.th/-i<itemId>-s<skuId>.html
 *   - Tracking params (`?spm=...&clickTrackInfo=...`) are stripped on output.
 *
 * Phase 1 calls the undocumented PDP JSON endpoint:
 *   GET https://pdp.lazada.co.th/pdp/sku/<itemId>/<skuId>
 *
 * That endpoint is not officially supported — it changes shape every few
 * months. Wrap the breakage here so the upstream service stays stable.
 */
@Injectable()
export class LazadaParser {
  private readonly logger = new Logger(LazadaParser.name);

  async parse(url: URL): Promise<ParsedLineItem | null> {
    const ids = this.extractIds(url);
    if (!ids) {
      this.logger.warn(`Could not extract item/sku ids from ${url.toString()}`);
      return null;
    }

    if (!process.env.LAZADA_PDP_BASE && !ids) return null;
    const apiBase = process.env.LAZADA_PDP_BASE ?? 'https://pdp.lazada.co.th/pdp/sku';
    const apiUrl  = `${apiBase}/${ids.itemId}/${ids.skuId}`;

    let payload: LazadaPdpResponse;
    try {
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'NirvaProcure/0.1 (+https://nirvaprocure.com)',
          'Accept':     'application/json',
        },
      });
      if (!res.ok) {
        this.logger.warn(`Lazada API ${res.status} for ${apiUrl}`);
        return null;
      }
      payload = (await res.json()) as LazadaPdpResponse;
    } catch (err) {
      this.logger.error(`Lazada fetch failed: ${(err as Error).message}`);
      return null;
    }

    const data = payload?.data?.root?.fields ?? payload?.data;
    if (!data) return null;

    // Lazada price comes as a string with currency symbol (e.g. "฿2,490.00").
    // Strip non-digits, parse, and convert to satang.
    const priceMinor = this.thbToSatang(data.price);
    if (priceMinor == null) return null;

    return {
      source: 'lazada',
      source_url: this.canonicalUrl(url, ids),
      description: data.title ?? data.skuTitle ?? '(no title)',
      unit_price_minor: priceMinor,
      currency: 'THB',
      supplier: {
        name: data.shopName ?? `Lazada shop ${ids.itemId}`,
        external_ref: ids.skuId,
      },
      source_metadata: {
        item_id: ids.itemId,
        sku_id:  ids.skuId,
        stock:   data.stock,
        rating:  data.ratings?.average,
      },
    };
  }

  /**
   * Recognize the two URL shapes Lazada serves today. Captures `itemId` and
   * `skuId` from the canonical `-i<n>-s<m>` suffix.
   */
  private extractIds(url: URL): { itemId: string; skuId: string } | null {
    const m = url.pathname.match(/-i(\d+)-s(\d+)\.html$/);
    if (m) return { itemId: m[1], skuId: m[2] };
    return null;
  }

  /**
   * Lazada prices in JSON look like "฿2,490.00" or sometimes "2490.0". Take
   * everything as a decimal, drop separators, return integer satang.
   */
  private thbToSatang(raw: unknown): number | null {
    if (raw == null) return null;
    const s = String(raw).replace(/[^\d.]/g, '');
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  }

  private canonicalUrl(original: URL, ids: { itemId: string; skuId: string }): string {
    return `${original.protocol}//${original.host}/-i${ids.itemId}-s${ids.skuId}.html`;
  }
}

interface LazadaPdpResponse {
  data?: {
    title?: string;
    skuTitle?: string;
    price?: string;
    shopName?: string;
    stock?: number;
    ratings?: { average?: number };
    root?: { fields?: any };
  };
}
