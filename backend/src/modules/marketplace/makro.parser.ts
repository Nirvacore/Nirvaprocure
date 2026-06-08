import { Injectable, Logger } from '@nestjs/common';
import type { ParsedLineItem } from './types';

/**
 * Makro Pro Thailand product URL parser.
 *
 * Supported URL shapes:
 *   - https://www.makro.pro/th/p/<slug>/<productId>
 *   - https://www.makro.pro/th/product/<productId>
 *
 * Makro Pro is the B2B side of Makro. It exposes a real JSON storefront
 * API which is much more stable than Shopee/Lazada's reverse-engineered
 * endpoints. We hit /api/v1/products/<id> and parse the response shape.
 *
 * Currency is always THB for the .pro/th domain.
 */
@Injectable()
export class MakroParser {
  private readonly logger = new Logger(MakroParser.name);

  async parse(url: URL): Promise<ParsedLineItem | null> {
    const productId = this.extractId(url);
    if (!productId) {
      this.logger.warn(`Could not extract product id from ${url.toString()}`);
      return null;
    }

    const apiUrl = `${url.protocol}//${url.host}/api/v1/products/${productId}`;
    let payload: MakroProductResponse;
    try {
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'NirvaProcure/0.1 (+https://nirvaprocure.com)',
          'Accept':     'application/json',
          // Makro Pro requires a country header on some endpoints.
          'x-country':  'TH',
        },
      });
      if (!res.ok) {
        this.logger.warn(`Makro API ${res.status} for ${apiUrl}`);
        return null;
      }
      payload = (await res.json()) as MakroProductResponse;
    } catch (err) {
      this.logger.error(`Makro fetch failed: ${(err as Error).message}`);
      return null;
    }

    const data = payload?.data;
    if (!data) return null;

    const priceMinor = this.toSatang(data.unitPrice ?? data.price);
    if (priceMinor == null) return null;

    return {
      source: 'makro',
      source_url: this.canonicalUrl(url, productId),
      description: data.name ?? '(no title)',
      unit_price_minor: priceMinor,
      currency: 'THB',
      supplier: {
        name: 'Makro คลังกลาง',                   // Makro Pro is the single seller
        external_ref: productId,
      },
      source_metadata: {
        product_id:  productId,
        unit:        data.salesUnit,
        stock:       data.stockQty,
        pack_size:   data.packSize,
        category:    data.categoryName,
      },
    };
  }

  private extractId(url: URL): string | null {
    // /th/p/<slug>/<id> or /th/product/<id>
    const m1 = url.pathname.match(/\/p\/[^/]+\/(\d+)$/);
    if (m1) return m1[1];
    const m2 = url.pathname.match(/\/product\/(\d+)$/);
    if (m2) return m2[1];
    return null;
  }

  /**
   * Makro returns price as a number (e.g. 2490 or 2490.5). Multiply by 100
   * to satang.
   */
  private toSatang(raw: unknown): number | null {
    if (raw == null) return null;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  }

  private canonicalUrl(original: URL, productId: string): string {
    return `${original.protocol}//${original.host}/th/product/${productId}`;
  }
}

interface MakroProductResponse {
  data?: {
    name?: string;
    unitPrice?: number;
    price?: number;
    salesUnit?: string;
    stockQty?: number;
    packSize?: string;
    categoryName?: string;
  };
}
