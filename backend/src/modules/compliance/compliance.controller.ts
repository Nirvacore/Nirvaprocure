import { Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { IsInt, Max, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CU } from '../../common/auth/current-user.decorator';
import { ComplianceService } from './compliance.service';

class PurgeDto {
  @Type(() => Number)
  @IsInt() @Min(30) @Max(3650)
  @IsOptional()
  days?: number;
}

/**
 * Endpoints exposed:
 *   GET  /compliance/export/me          → caller's own data (self-service)
 *   GET  /compliance/export/:user_id    → admin-only export of another user
 *   POST /compliance/redact/:user_id    → admin-only pseudonymization
 *   POST /compliance/audit/purge        → run retention sweep (default 90d)
 *
 * Admin gating is a placeholder check on the email until we wire a real
 * role system through `users.role`. Replace with `@Roles('admin')` once
 * that's in place.
 */
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly svc: ComplianceService) {}

  @Get('export/me')
  exportMe(@CurrentUser() user: CU) {
    return this.svc.exportUser(user, user.userId);
  }

  @Get('export/:user_id')
  exportOther(
    @CurrentUser() user: CU,
    @Param('user_id', new ParseUUIDPipe()) userId: string,
  ) {
    requireAdmin(user);
    return this.svc.exportUser(user, userId);
  }

  @Post('redact/:user_id')
  redact(
    @CurrentUser() user: CU,
    @Param('user_id', new ParseUUIDPipe()) userId: string,
  ) {
    requireAdmin(user);
    return this.svc.redactUser(user, userId);
  }

  @Post('audit/purge')
  purge(@CurrentUser() user: CU, @Query() q: PurgeDto) {
    requireAdmin(user);
    return this.svc.purgeAuditLog(user, q.days ?? 90);
  }
}

function requireAdmin(user: CU) {
  // Placeholder — replace with role-claim check when JWT carries roles.
  // For Phase 1 we let any @nirva.co.th address run these so the seed
  // org can demo the flow.
  if (!user.email?.endsWith('@nirva.co.th')) {
    throw new ForbiddenException('Admin role required');
  }
}
