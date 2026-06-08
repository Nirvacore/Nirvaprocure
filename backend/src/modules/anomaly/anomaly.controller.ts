import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { IsBooleanString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AnomalyService } from './anomaly.service';
import { SupplierRiskService } from './supplier-risk.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CU } from '../../common/auth/current-user.decorator';

class ListQuery {
  @IsOptional() @IsBooleanString()
  acknowledged?: string;
}

class DisclosureDto {
  @IsUUID() supplier_id!: string;

  @IsIn(['family', 'former_employer', 'investor', 'partner', 'other'])
  relationship!: string;

  @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

@Controller('anomaly')
export class AnomalyController {
  constructor(
    private readonly svc:  AnomalyService,
    private readonly risk: SupplierRiskService,
  ) {}

  // ── Anomaly alerts ───────────────────────────────────────────────────────

  @Get('alerts')
  list(@CurrentUser() user: CU, @Query() q: ListQuery) {
    const ack = q.acknowledged === undefined
      ? undefined
      : q.acknowledged === 'true';
    return this.svc.list(user, { acknowledged: ack });
  }

  @Post('alerts/:id/ack')
  ack(@CurrentUser() user: CU, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.acknowledge(user, id);
  }

  // ── CoI disclosures ──────────────────────────────────────────────────────

  @Get('disclosures')
  listDisclosures(@CurrentUser() user: CU) {
    return this.svc.listDisclosures(user);
  }

  @Post('disclosures')
  declare(@CurrentUser() user: CU, @Body() dto: DisclosureDto) {
    return this.svc.declare(user, dto);
  }

  // ── Supplier risk scores ─────────────────────────────────────────────────

  /**
   * Latest computed supplier risk scores for the caller's org.
   * GET /anomaly/supplier-risks
   */
  @Get('supplier-risks')
  supplierRisks(@CurrentUser() user: CU) {
    return this.risk.list(user);
  }

  /**
   * Trigger an on-demand recompute for the caller's org (admin action).
   * POST /anomaly/supplier-risks/refresh → { computed: number }
   */
  @Post('supplier-risks/refresh')
  @HttpCode(200)
  async refreshRisks(@CurrentUser() user: CU) {
    const computed = await this.risk.compute(user.orgId);
    return { computed };
  }
}
