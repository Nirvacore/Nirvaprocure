import { Injectable, Logger } from '@nestjs/common';
import type { ParsedLineItem } from './types';

/**
 * Shopee Thailand product URL parser.
 *
 * Supported URL shapes:
 *   - https://shopee.co.th/{name}-i.{shopId}.{itemId}            (canonical)
 *   - https://shopee.co.th/product/{shopId}/{itemId}             (short)
 *   - https://shopee.co.th/{anything}?...                        (with tracking params)
 *
 * Phase 1 fetches Shopee's undocumented JSON endpoint
 *   GET https://shopee.co.th/api/v4/item/get?itemid=<id>&shopid=<id>
 * which returns price, name, shop info, and stock.
 *
 * Reverse-engineered endpoints can break. We isolate that risk here so a
 * change in Shopee's API only affects this file.
 */
@Injectable()
export class ShopeeParser {
  private readonly logger = new Logger(ShopeeParser.name);

  async parse(url: URL): Promise<ParsedLineItem | null> {
    const ids = this.extractIds(url);
    if (!ids) {
      this.logger.warn(`Could not extract shop/item ids from ${url.toString()}`);
      return null;
    }

    const apiUrl = new URL('/api/v4/item/get', `${url.protocol}//${url.host}`);
    apiUrl.searchParams.set('itemid', ids.itemId);
    apiUrl.searchParams.set('shopid', ids.shopId);

    let payload: ShopeeItemResponse;
    try {
      const res = await fetch(apiUrl.toString(), {
        headers: {
          // Shopee rejects requests without a User-Agent
          'User-Agent': 'NirvaProcure/0.1 (+https://nirvaprocure.com)',
          'Accept': 'application/json',
          // x-api-source helps Shopee classify the request as their PWA
          'x-api-source': 'pc',
        },
      });
      if (!res.ok) {
        this.logger.warn(`Shopee API ${res.status} for ${apiUrl.toString()}`);
        return null;
      }
      payload = (await res.json()) as ShopeeItemResponse;
    } catch (err) {
      this.logger.error(`Shopee fetch failed: ${(err as Error).message}`);
      return null;
    }

    const data = payload?.data;
    if (!data) return null;

    // Shopee prices come as integers scaled by 100000.
    // e.g. 199.50 THB → 19950000
    const unitPriceMinor = this.shopeePriceToSatang(data.price);
    if (unitPriceMinor == null) return null;

    return {
      source: 'shopee',
      source_url: this.canonicalUrl(url, ids),
      description: data.name,
      unit_price_minor: unitPriceMinor,
      currency: 'THB',
      supplier: {
        name: data.shop_name ?? `Shop ${ids.shopId}`,
        external_ref: ids.shopId,
      },
      source_metadata: {
        item_id: ids.itemId,
        shop_id: ids.shopId,
        stock: data.stock,
        sold: data.historical_sold,
        rating: data.item_rating?.rating_star,
        currency: data.currency,
        raw_price: data.price,
      },
    };
  }

  /**
   * Pull shopId and itemId out of any of Shopee's URL shapes.
   * Returns null if neither pattern matches.
   */
  private extractIds(url: URL): { shopId: string; itemId: string } | null {
    // Canonical: /<slug>-i.<shopId>.<itemId>
    const canonical = url.pathname.match(/-i\.(\d+)\.(\d+)/);
    if (canonical) {
      return { shopId: canonical[1], itemId: canonical[2] };
    }
    // Short: /product/<shopId>/<itemId>
    const short = url.pathname.match(/^\/product\/(\d+)\/(\d+)/);
    if (short) {
      return { shopId: short[1], itemId: short[2] };
    }
    return null;
  }

  /**
   * Shopee stores prices as an integer = THB * 100000.
   * We need satang (THB * 100), so divide by 1000.
   * Returns null if the price is missing/invalid.
   */
  private shopeePriceToSatang(price: number | undefined): number | null {
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
      return null;
    }
    return Math.round(price / 1000);
  }

  private canonicalUrl(original: URL, ids: { shopId: string; itemId: string }): string {
    // Strip tracking params, keep host + canonical slug pattern.
    return `${original.protocol}//${original.host}/-i.${ids.shopId}.${ids.itemId}`;
  }
}

// ---------------------------------------------------------------------------
// Minimal shape of the Shopee response we depend on. Many other fields exist
// but we only declare what we actually read.
// ---------------------------------------------------------------------------
interface ShopeeItemResponse {
  error?: number;
  data?: {
    name: string;
    price: number;              // THB * 100000
    currency?: string;
    shop_name?: string;
    stock?: number;
    historical_sold?: number;
    item_rating?: { rating_star?: number };
  } | null;
}
