import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  /** Force JSON-only output. Used by structured outputs like price compare. */
  jsonMode?: boolean;
  maxTokens?: number;
  /** Template label stored in ai_runs for cost attribution. */
  template?: string;
  /** If provided, stored in ai_runs for per-org cost tracking. */
  orgId?: string;
  userId?: string;
}

// OpenAI pricing as of 2024-Q4 (USD per 1M tokens).
// Add new models here when upgrading.
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o':           { input: 5.00,  output: 15.00 },
  'gpt-4o-mini':      { input: 0.15,  output: 0.60  },
  'gpt-4-turbo':      { input: 10.00, output: 30.00 },
  'gpt-3.5-turbo':    { input: 0.50,  output: 1.50  },
};
const DEFAULT_PRICING = { input: 0.15, output: 0.60 }; // gpt-4o-mini fallback

/**
 * Thin OpenAI wrapper with:
 *  - Deterministic stub when OPENAI_API_KEY is missing (dev/CI)
 *  - Per-call cost metering written to `ai_runs`
 *  - Latency tracking
 */
@Injectable()
export class OpenAiProvider {
  private readonly logger = new Logger(OpenAiProvider.name);

  constructor(@Optional() @Inject(PG_POOL) private readonly pool: Pool | null) {}

  get enabled(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const model    = opts.model ?? 'gpt-4o-mini';
    const template = opts.template ?? 'unknown';

    if (!this.enabled) {
      this.logger.warn(`[STUB] OPENAI_API_KEY not set — template=${template}`);
      await this.record({
        orgId: opts.orgId, userId: opts.userId, template, model,
        promptTokens: 0, completionTokens: 0, latencyMs: 0, isStub: true,
      });
      return this.stubResponse(opts);
    }

    const body: Record<string, unknown> = {
      model,
      messages,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    };

    const t0 = Date.now();
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const latencyMs = Date.now() - t0;

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`OpenAI ${res.status}: ${txt}`);
    }

    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const promptTokens     = json.usage?.prompt_tokens     ?? 0;
    const completionTokens = json.usage?.completion_tokens ?? 0;

    await this.record({
      orgId: opts.orgId, userId: opts.userId, template, model,
      promptTokens, completionTokens, latencyMs, isStub: false,
    });

    return json.choices[0]?.message?.content ?? '';
  }

  // ── Cost recording ──────────────────────────────────────────────────────

  /**
   * Public helper for services that call OpenAI directly (e.g. vision).
   * Call this after a raw fetch to record usage in ai_runs.
   */
  async recordRun(opts: {
    orgId?: string; userId?: string; template: string; model: string;
    promptTokens: number; completionTokens: number;
    latencyMs: number;
  }): Promise<void> {
    return this.record({ ...opts, isStub: false });
  }

  private async record(opts: {
    orgId?: string; userId?: string; template: string; model: string;
    promptTokens: number; completionTokens: number;
    latencyMs: number; isStub: boolean;
  }): Promise<void> {
    if (!this.pool) return; // unit test context — no DB
    const price = PRICING[opts.model] ?? DEFAULT_PRICING;
    const inputCost  = (opts.promptTokens     / 1_000_000) * price.input;
    const outputCost = (opts.completionTokens / 1_000_000) * price.output;
    try {
      await this.pool.query(
        `INSERT INTO ai_runs
           (org_id, user_id, template, model,
            prompt_tokens, completion_tokens,
            input_cost_usd, output_cost_usd,
            latency_ms, is_stub)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          opts.orgId ?? null,
          opts.userId ?? null,
          opts.template,
          opts.model,
          opts.promptTokens,
          opts.completionTokens,
          inputCost.toFixed(8),
          outputCost.toFixed(8),
          opts.latencyMs,
          opts.isStub,
        ],
      );
    } catch (err) {
      // Never let cost recording break the primary AI call.
      this.logger.warn(`ai_runs insert failed: ${(err as Error).message}`);
    }
  }

  // ── Stub ────────────────────────────────────────────────────────────────

  private stubResponse(opts: ChatOptions): string {
    if (opts.jsonMode) {
      return JSON.stringify({
        recommended_choice: {
          source: 'shopee',
          url: 'https://shopee.co.th/-i.0.0',
          unit_price_minor: 0,
          supplier_name: 'STUB Supplier',
        },
        reasoning: '[STUB] no OPENAI_API_KEY — configure to get real AI recommendations.',
        savings_vs_median_minor: 0,
        watch_outs: ['STUB response — no AI analysis performed'],
      });
    }
    return '[STUB] OpenAI not configured. Set OPENAI_API_KEY to enable AI features.';
  }
}
