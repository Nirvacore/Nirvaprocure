import { Module } from '@nestjs/common';
import { GovController } from './gov.controller';
import { GovService } from './gov.service';
import { GovPdfService } from './gov-pdf.service';
import { AiModule } from '../ai/ai.module';
import { PrModule } from '../pr/pr.module';

@Module({
  imports: [AiModule, PrModule],
  controllers: [GovController],
  providers: [GovService, GovPdfService],
})
export class GovModule {}
