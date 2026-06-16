import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { AnomalyModule } from '../anomaly/anomaly.module';

@Module({
  imports:      [AnomalyModule],
  controllers:  [SuppliersController],
  providers:    [SuppliersService],
  exports:      [SuppliersService],
})
export class SuppliersModule {}
