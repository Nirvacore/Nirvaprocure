import { Injectable, Logger } from '@nestjs/common';
import type { ParsedLineItem } from './types';

/**
 * Alibaba.com product URL parser.
 *
 * Alibaba is a B2B marketplace with cross-border shipping, so prices are
 * often quoted in USD and ranged (e.g. "$1.20–$1.80 per piece, MOQ 1000").
 * We extract the LOW end of the range and the per-unit MOQ — buyers can
 * negotiate from there.
 *
 * Supported URL shapes:
 *   - https://www.alibaba.com/product-detail/<slug>_<productId>.html
 *
 * Currency note: the parser returns the value in `currency` so downstream
 * UI can apply an FX layer (Phase 4 — multi-currency support pending).
 */
@Injectable()
export class AlibabaParser {
  private readonly logger = new Logger(AlibabaParser.name);

  async parse(url: URL): Promise<ParsedLineItem | null> {
    const productId = this.extractId(url);
    if (!productId) {
      this.logger.warn(`Could not extract product id from ${url.toString()}`);
      return null;
    }

    // Alibaba doesn't expose a public JSON endpoint — most clients scrape
    // the embedded `window.__INIT_DATA__` JSON blob from the HTML. We don't
    // ship a fetch path here yet; on URLs we recognize we still return a
    // useful skeleton so the buyer can fill in price + MOQ manually.
    //
    // When LAZADA_PARSE_HTML / ALIBABA_PARSE_HTML is set we could plug in a
    // proper scraping pipeline (Bright Data, ScrapingBee, etc) — left as a
    // Phase 4 follow-up.
    return {
      source: 'alibaba',
      source_url: this.canonicalUrl(url, productId),
      description: '(Alibaba — please fill in)',
      unit_price_minor: 0,
      currency: 'USD',                   // overrideable in the editor
      supplier: {
        name: 'Alibaba supplier',
        external_ref: productId,
      },
      source_metadata: {
        product_id: productId,
        note: 'parser-skeleton — HTML fetch path not yet wired',
      },
    };
  }

  /** /product-detail/<slug>_<id>.html — id is the numeric tail. */
  private extractId(url: URL): string | null {
    const m = url.pathname.match(/\/product-detail\/[^/]+_(\d+)\.html$/);
    return m ? m[1] : null;
  }

  private canonicalUrl(original: URL, productId: string): string {
    return `${original.protocol}//${original.host}/product-detail/${productId}.html`;
  }
}
