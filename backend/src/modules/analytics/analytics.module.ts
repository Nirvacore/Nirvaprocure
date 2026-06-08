import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { SavingsService } from './savings.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, SavingsService],
  exports: [AnalyticsService, SavingsService],
})
export class AnalyticsModule {}
