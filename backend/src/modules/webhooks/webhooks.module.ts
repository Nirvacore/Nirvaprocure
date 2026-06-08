import { Global, Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

/**
 * Global so any service can do `webhooks.emit('pr.submitted', ...)` without
 * importing the module. Outbound delivery is fire-and-forget on the calling
 * thread — the service awaits the HTTP POSTs internally but does NOT block
 * the caller from completing.
 */
@Global()
@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
