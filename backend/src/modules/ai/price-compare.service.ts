import { Injectable, BadGatewayException, Logger } from '@nestjs/common';
import { OpenAiProvider } from './openai.provider';

export interface MarketplaceListing {
  source: 'shopee' | 'lazada' | 'makro' | 'alibaba';
  url: string;
  price_minor: number;
  currency: string;
  supplier_name?: string;
  metadata?: Record<string, unknown>;
}

export interface HistoricalPo {
  date: string;            // ISO
  supplier_name: string;
  unit_price_minor: number;
  currency: string;
  source_url?: string;
}

export interface PriceCompareInput {
  item_name: string;
  marketplace_listings: MarketplaceListing[];
  historical_pos: HistoricalPo[];
  currency: string;
}

export interface PriceCompareResult {
  recommended_choice: {
    source: MarketplaceListing['source'];
    url: string;
    unit_price_minor: number;
    supplier_name: string;
  };
  reasoning: string;
  savings_vs_median_minor: number;
  watch_outs: string[];
}

/**
 * Implements the `price_compare_v1` prompt from /prompts/price_compare_v1.md.
 *
 * Inputs and outputs are deliberately typed at the service layer so the
 * controller stays HTTP-only. If you ever want to call this from a worker
 * (e.g. nightly batch over open PRs), depend on this service directly.
 */
@Injectable()
export class PriceCompareService {
  private readonly logger = new Logger(PriceCompareService.name);

  constructor(private readonly openai: OpenAiProvider) {}

  async compare(input: PriceCompareInput): Promise<PriceCompareResult> {
    const system = [
      `You are NirvaAI's price comparison agent. You are given a procurement`,
      `request for "${input.item_name}", current marketplace listings, and`,
      `historical purchase orders. Recommend the single best choice in`,
      `${input.currency}, weighted against supplier reliability and outlier risk.`,
      ``,
      `Rules:`,
      `- Never recommend a listing whose price is >40% below the median`,
      `  historical PO without flagging counterfeit risk in watch_outs.`,
      `- Prefer suppliers that appear in historical_pos.`,
      `- Output STRICT JSON only. All monetary values are integers in minor`,
      `  units (satang for THB).`,
    ].join('\n');

    const user = JSON.stringify({
      item_name: input.item_name,
      currency:  input.currency,
      marketplace_listings: input.marketplace_listings,
      historical_pos:       input.historical_pos,
    }, null, 2);

    const raw = await this.openai.chat(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      { jsonMode: true, model: 'gpt-4o-mini', template: 'price_compare_v1' },
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      this.logger.error(`AI returned non-JSON: ${raw.slice(0, 200)}`);
      throw new BadGatewayException('AI response was not valid JSON');
    }

    if (!isValidResult(parsed)) {
      this.logger.error(`AI returned malformed schema: ${raw.slice(0, 200)}`);
      throw new BadGatewayException('AI response missing required fields');
    }
    return parsed;
  }
}

function isValidResult(x: unknown): x is PriceCompareResult {
  if (!x || typeof x !== 'object') return false;
  const r = x as Partial<PriceCompareResult>;
  return (
    !!r.recommended_choice &&
    typeof r.reasoning === 'string' &&
    typeof r.savings_vs_median_minor === 'number' &&
    Array.isArray(r.watch_outs)
  );
}
