import { Module } from '@nestjs/common';
import { InvoiceOcrController } from './invoice-ocr.controller';
import { InvoiceOcrService } from './invoice-ocr.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [InvoiceOcrController],
  providers: [InvoiceOcrService],
})
export class FinanceModule {}
