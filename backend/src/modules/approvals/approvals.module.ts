import { Module } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';

@Module({
  controllers: [ApprovalsController, WorkflowsController],
  providers: [ApprovalsService, WorkflowsService],
  exports: [ApprovalsService, WorkflowsService],
})
export class ApprovalsModule {}
