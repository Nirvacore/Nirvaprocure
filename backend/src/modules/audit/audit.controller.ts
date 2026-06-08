import { Controller, Get, Query } from '@nestjs/common';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AuditService } from './audit.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CU } from '../../common/auth/current-user.decorator';

class ListQuery {
  @IsOptional() @IsString() @MaxLength(64) entity_type?: string;
  @IsOptional() @IsUUID() actor_id?: string;
  @IsOptional() @IsString() @MaxLength(200) cursor?: string;

  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(200)
  limit?: number;
}

@Controller('audit')
export class AuditController {
  constructor(private readonly svc: AuditService) {}

  @Get('log')
  list(@CurrentUser() user: CU, @Query() q: ListQuery) {
    return this.svc.list(user, {
      entityType: q.entity_type,
      actorId:    q.actor_id,
      cursor:     q.cursor,
      limit:      q.limit ?? 50,
    });
  }
}
