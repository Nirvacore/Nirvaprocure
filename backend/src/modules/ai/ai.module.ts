import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { PriceCompareService } from './price-compare.service';
import { OpenAiProvider } from './openai.provider';

@Module({
  controllers: [AiController],
  providers: [PriceCompareService, OpenAiProvider],
  exports: [PriceCompareService, OpenAiProvider],
})
export class AiModule {}
