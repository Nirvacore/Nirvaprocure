import { Module } from '@nestjs/common';
import { GovController } from './gov.controller';
import { GovService } from './gov.service';
import { GovPdfService } from './gov-pdf.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [GovController],
  providers: [GovService, GovPdfService],
})
export class GovModule {}
