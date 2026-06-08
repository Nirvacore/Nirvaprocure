import { Module } from '@nestjs/common';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { ReorderScanJob } from './reorder-scan.job';

@Module({
  controllers: [StockController],
  providers: [StockService, ReorderScanJob],
  exports: [StockService],
})
export class StockModule {}
