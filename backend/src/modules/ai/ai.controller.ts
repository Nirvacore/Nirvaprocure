import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import {
  ArrayMinSize, IsArray, IsIn, IsInt, IsISO8601, IsOptional,
  IsString, IsUrl, Min, ValidateNested, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Pool } from 'pg';
import { PG_POOL } from '../../common/db/db.module';
import { PriceCompareService, type PriceCompareResult } from './price-compare.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CU } from '../../common/auth/current-user.decorator';
import { withOrg } from '../../common/db/with-org';

class ListingDto {
  @IsIn(['shopee', 'lazada', 'makro', 'alibaba'])
  source!: 'shopee' | 'lazada' | 'makro' | 'alibaba';

  @IsUrl() url!: string;

  @IsInt() @Min(0) price_minor!: number;

  @IsString() @MaxLength(8) currency!: string;

  @IsOptional() @IsString() @MaxLength(200) supplier_name?: string;

  @IsOptional() metadata?: Record<string, unknown>;
}

class HistoricalPoDto {
  @IsISO8601() date!: string;
  @IsString() @MaxLength(200) supplier_name!: string;
  @IsInt() @Min(0) unit_price_minor!: number;
  @IsString() @MaxLength(8) currency!: string;
  @IsOptional() @IsUrl() source_url?: string;
}

class PriceCompareDto {
  @IsString() @MaxLength(500) item_name!: string;
  @IsString() @MaxLength(8)   currency!: string;

  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => ListingDto)
  marketplace_listings!: ListingDto[];

  @IsArray()
  @ValidateNested({ each: true }) @Type(() => HistoricalPoDto)
  historical_pos!: HistoricalPoDto[];
}

@Controller('ai')
export class AiController {
  constructor(
    private readonly priceCompare: PriceCompareService,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  @Post('price-compare')
  async compare(@Body() dto: PriceCompareDto): Promise<PriceCompareResult> {
    return this.priceCompare.compare(dto);
  }

  /**
   * AI usage log for the calling user's org — most recent 200 runs.
   * Includes per-template cost breakdown.
   *
   * GET /ai/runs → { runs: AiRun[], summary: { total_cost_usd, total_tokens, calls } }
   */
  @Get('runs')
  async runs(@CurrentUser() user: CU, @Query('limit') limitStr?: string) {
    const limit = Math.min(Number(limitStr ?? 100), 200);
    return withOrg(this.pool, user.orgId, async (c) => {
      const rows = await c.query(
        `SELECT id, template, model, prompt_tokens, completion_tokens,
                total_tokens, total_cost_usd, latency_ms, is_stub, created_at
           FROM ai_runs
          WHERE org_id = $1
          ORDER BY created_at DESC
          LIMIT $2`,
        [user.orgId, limit],
      );
      const summary = await c.query<{
        total_cost_usd: string; total_tokens: string; calls: string;
      }>(
        `SELECT COALESCE(SUM(total_cost_usd), 0)::text AS total_cost_usd,
                COALESCE(SUM(total_tokens), 0)::text    AS total_tokens,
                COUNT(*)::text                          AS calls
           FROM ai_runs
          WHERE org_id = $1 AND is_stub = false
            AND created_at >= date_trunc('month', now())`,
        [user.orgId],
      );
      return {
        runs: rows.rows,
        summary: {
          total_cost_usd: Number(summary.rows[0]?.total_cost_usd ?? 0),
          total_tokens:   Number(summary.rows[0]?.total_tokens   ?? 0),
          calls:          Number(summary.rows[0]?.calls          ?? 0),
        },
      };
    });
  }
}
