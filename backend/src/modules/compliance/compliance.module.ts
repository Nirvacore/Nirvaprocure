import { Module } from '@nestjs/common';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { AuditArchiveService } from './audit-archive.service';

@Module({
  controllers: [ComplianceController],
  providers: [ComplianceService, AuditArchiveService],
})
export class ComplianceModule {}
