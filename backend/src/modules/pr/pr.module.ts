import { Module } from '@nestjs/common';
import { PrController } from './pr.controller';
import { PrService } from './pr.service';
import { PrPdfService } from './pr-pdf.service';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { StockModule } from '../stock/stock.module';
import { AnomalyModule } from '../anomaly/anomaly.module';

@Module({
  // StockModule provides StockService — PrService records stock movements
  // when an approved PR is received.
  // AnomalyModule provides AnomalyService — PrService records CoI alerts
  // on submit when a requester has a declared relationship to a supplier.
  imports: [MarketplaceModule, StockModule, AnomalyModule],
  controllers: [PrController],
  providers: [PrService, PrPdfService],
  exports: [PrService],
})
export class PrModule {}
