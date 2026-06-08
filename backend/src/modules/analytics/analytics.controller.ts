import { Controller, Get, Query } from '@nestjs/common';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AnalyticsService } from './analytics.service';
import { SavingsService } from './savings.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CU } from '../../common/auth/current-user.decorator';

class LeaderboardQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional()
  limit?: number;
}

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly svc: AnalyticsService,
    private readonly savings: SavingsService,
  ) {}

  @Get('summary')
  summary(@CurrentUser() user: CU) {
    return this.svc.summary(user);
  }

  @Get('savings/leaderboard')
  leaderboard(@CurrentUser() user: CU, @Query() q: LeaderboardQuery) {
    return this.savings.leaderboard(user, q.limit ?? 10);
  }

  @Get('savings/me')
  selfSavings(@CurrentUser() user: CU) {
    return this.savings.selfSummary(user);
  }
}
