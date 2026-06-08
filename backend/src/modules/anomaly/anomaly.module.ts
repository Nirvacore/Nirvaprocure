import { Module } from '@nestjs/common';
import { AnomalyController } from './anomaly.controller';
import { AnomalyService } from './anomaly.service';
import { AnomalyScanJob } from './anomaly-scan.job';
import { SupplierRiskService } from './supplier-risk.service';

@Module({
  controllers: [AnomalyController],
  providers: [AnomalyService, AnomalyScanJob, SupplierRiskService],
  exports: [AnomalyService, SupplierRiskService],
})
export class AnomalyModule {}
