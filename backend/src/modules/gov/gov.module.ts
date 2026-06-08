import { Module } from '@nestjs/common';
import { GovController } from './gov.controller';
import { GovService } from './gov.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [GovController],
  providers: [GovService],
})
export class GovModule {}
