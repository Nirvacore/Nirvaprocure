import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Matches, Min } from 'class-validator';
import { BudgetService } from './budget.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CU } from '../../common/auth/current-user.decorator';

class UpsertDto {
  @IsUUID() department_id!: string;
  @IsInt() @Min(0) amount_minor!: number;

  // YYYY-MM-DD; we tolerate the user passing in any day of the month and
  // snap to the 1st in the service.
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  month_start?: string;

  @IsOptional() @IsBoolean()
  soft_block?: boolean;
}

@Controller('budgets')
export class BudgetController {
  constructor(private readonly svc: BudgetService) {}

  @Get()
  list(@CurrentUser() user: CU, @Query('month') month?: string) {
    return this.svc.list(user, month);
  }

  @Post()
  upsert(@CurrentUser() user: CU, @Body() dto: UpsertDto) {
    return this.svc.upsert(user, dto);
  }
}
