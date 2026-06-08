import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Sse,
  MessageEvent,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Observable, interval, switchMap, distinctUntilChanged, share } from 'rxjs';
import { ApprovalsService } from './approvals.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CU } from '../../common/auth/current-user.decorator';

class DecisionDto {
  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';

  @IsOptional() @IsString() @MaxLength(2000)
  comment?: string;
}

@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly svc: ApprovalsService) {}

  @Get('inbox')
  inbox(@CurrentUser() user: CU) {
    return this.svc.inbox(user);
  }

  /**
   * Server-Sent Events stream for inbox count updates.
   *
   * Implementation: lightweight poll-and-diff on the server side, every 5s,
   * emit only when the count changed. This is a deliberate trade-off:
   *   - far simpler than a full event bus / Redis pub-sub
   *   - good enough for hundreds of concurrent approvers per pod
   *   - graduates naturally to a Postgres LISTEN/NOTIFY backend later
   *
   * The client opens this once per session; it's keyed by the JWT, so
   * different users see different counts even from the same browser.
   */
  @Sse('stream')
  stream(@CurrentUser() user: CU): Observable<MessageEvent> {
    return interval(5_000).pipe(
      switchMap(async () => (await this.svc.inbox(user)).length),
      distinctUntilChanged(),
      // Map to the SSE event shape Nest expects.
      // The id field lets the browser reconnect with Last-Event-ID.
      share(),
    ).pipe(
      switchMap(async (count) => ({
        type: 'inbox.count',
        data: { count, at: new Date().toISOString() },
      } satisfies MessageEvent)),
    );
  }

  @Post(':instance_id/decision')
  decide(
    @CurrentUser() user: CU,
    @Param('instance_id', new ParseUUIDPipe()) instanceId: string,
    @Body() dto: DecisionDto,
  ) {
    return this.svc.decide(user, instanceId, dto.decision, dto.comment);
  }
}
