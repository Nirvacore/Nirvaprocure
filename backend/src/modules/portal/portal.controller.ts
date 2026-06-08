import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PortalService } from './portal.service';

class AckDto {
  @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

/**
 * Token in the URL is the credential. The whole module is excluded from
 * AuthMiddleware in AppModule. NO information leaves this controller until
 * `PortalService.resolve(token)` validates the token; on failure it throws
 * 403 (revoked/expired) or 404 (unknown), which is what the supplier sees.
 */
@Controller('portal/:token')
export class PortalController {
  constructor(private readonly svc: PortalService) {}

  @Get()
  async overview(@Param('token') token: string) {
    const ctx   = await this.svc.resolve(token);
    const lines = await this.svc.listLinesForSupplier(ctx);
    return {
      supplier_name: ctx.supplier_name,
      expires_at:    ctx.expires_at,
      lines,
    };
  }

  @Post('pr/:pr_id/ack')
  async acknowledge(
    @Param('token') token: string,
    @Param('pr_id') prId: string,
    @Body() dto: AckDto,
  ) {
    const ctx = await this.svc.resolve(token);
    return this.svc.acknowledge(ctx, prId, dto.note);
  }
}
