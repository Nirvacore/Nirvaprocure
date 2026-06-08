import { Global, Module } from '@nestjs/common';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';

/**
 * Global so PrService can ask "is this PR over budget?" at submit time
 * without an extra import.
 */
@Global()
@Module({
  controllers: [BudgetController],
  providers: [BudgetService],
  exports: [BudgetService],
})
export class BudgetModule {}
