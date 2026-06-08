import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Query,
} from '@nestjs/common';
import { Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PG_POOL } from '../../common/db/db.module';
import { withOrg } from '../../common/db/with-org';
import { PortalService } from './portal.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CU } from '../../common/auth/current-user.decorator';

class IssueDto {
  @IsUUID() supplier_id!: string;

  @IsOptional() @IsString() @MaxLength(200)
  label?: string;

  @Type(() => Number)
  @IsOptional() @IsInt() @Min(1) @Max(365)
  ttl_days?: number;
}

/**
 * Admin-side: manage the opaque tokens that grant suppliers access to the
 * `/portal/:token` surface. Lives under /portal-admin (NOT /portal) so the
 * AppModule's `portal/(.*)` JWT-skip rule doesn't accidentally expose this
 * to the public.
 *
 * Only the issue response carries the raw token; subsequent list calls
 * return metadata only — the raw token NEVER leaves the DB in plaintext.
 */
@Controller('portal-admin/tokens')
export class PortalAdminController {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly portal: PortalService,
  ) {}

  @Post()
  async issue(@CurrentUser() user: CU, @Body() dto: IssueDto) {
    const { token, expires_at } = await this.portal.issueToken({
      org_id:             user.orgId,
      supplier_id:        dto.supplier_id,
      created_by_user_id: user.userId,
      label:              dto.label,
      ttl_days:           dto.ttl_days ?? 30,
    });
    // Surfaced exactly once. Caller should email it and forget.
    return { token, expires_at };
  }

  @Get()
  list(@CurrentUser() user: CU, @Query('supplier_id') supplierId?: string) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const params: unknown[] = [];
      let filter = 'TRUE';
      if (supplierId) {
        params.push(supplierId);
        filter = `supplier_id = $${params.length}`;
      }
      const r = await c.query(
        `SELECT t.id, t.supplier_id, s.name AS supplier_name, t.label,
                t.expires_at, t.revoked_at, t.last_used_at, t.created_at
         FROM supplier_portal_tokens t
         JOIN suppliers s ON s.id = t.supplier_id
         WHERE ${filter}
         ORDER BY t.created_at DESC`,
        params,
      );
      return r.rows;
    });
  }

  @Post(':id/revoke')
  async revoke(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return withOrg(this.pool, user.orgId, async (c) => {
      const r = await c.query(
        `UPDATE supplier_portal_tokens SET revoked_at = now()
         WHERE id = $1 AND revoked_at IS NULL
         RETURNING id`,
        [id],
      );
      if (r.rowCount === 0) throw new NotFoundException();
      return { revoked: true };
    });
  }
}
