import { Module } from '@nestjs/common';
import { PortalController } from './portal.controller';
import { PortalAdminController } from './portal-admin.controller';
import { PortalService } from './portal.service';

@Module({
  controllers: [PortalController, PortalAdminController],
  providers: [PortalService],
})
export class PortalModule {}
