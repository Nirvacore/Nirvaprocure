import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { LineNotifier } from './line.notifier';
import { LineRichMenuService } from './line-rich-menu.service';
import { FcmService } from './fcm.service';
import { LineWebhookController } from './line-webhook.controller';
import { ApprovalsModule } from '../approvals/approvals.module';

/**
 * Global so PR + Approvals modules can inject LineNotifier without needing
 * to import NotificationsModule each time.
 *
 * Imports ApprovalsModule so the webhook controller can call the same
 * ApprovalsService that the regular HTTP endpoint uses.
 */
@Global()
@Module({
  imports: [ApprovalsModule],
  controllers: [NotificationsController, LineWebhookController],
  providers: [LineNotifier, LineRichMenuService, FcmService],
  exports: [LineNotifier, LineRichMenuService, FcmService],
})
export class NotificationsModule {}
