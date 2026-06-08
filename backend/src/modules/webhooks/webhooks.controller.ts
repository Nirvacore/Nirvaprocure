import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ArrayMinSize, IsArray, IsIn, IsUrl } from 'class-validator';
import { WebhooksService, type WebhookEvent } from './webhooks.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CU } from '../../common/auth/current-user.decorator';

const EVENTS: WebhookEvent[] = [
  'pr.submitted', 'pr.decided', 'pr.received',
  'reorder.alert', 'anomaly.raised',
];

class CreateDto {
  @IsUrl()
  url!: string;

  @IsArray() @ArrayMinSize(1)
  @IsIn(EVENTS, { each: true })
  events!: WebhookEvent[];
}

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly svc: WebhooksService) {}

  @Get()
  list(@CurrentUser() user: CU) {
    return this.svc.list(user);
  }

  @Post()
  create(@CurrentUser() user: CU, @Body() dto: CreateDto) {
    return this.svc.create(user, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CU, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.remove(user, id);
  }

  /** Last 20 deliveries for a webhook — newest first. */
  @Get(':id/deliveries')
  deliveries(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.listDeliveries(user, id);
  }

  /** Replay a specific delivery (re-fires the original payload). */
  @Post(':id/deliveries/:delivId/replay')
  @HttpCode(200)
  replay(
    @CurrentUser() user: CU,
    @Param('id',     new ParseUUIDPipe()) id: string,
    @Param('delivId',new ParseUUIDPipe()) delivId: string,
  ) {
    return this.svc.replay(user, id, delivId);
  }
}
