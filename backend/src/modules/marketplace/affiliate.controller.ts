import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post,
} from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AffiliateService, type AffiliatePlatform } from './affiliate.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CU } from '../../common/auth/current-user.decorator';

const PLATFORMS: AffiliatePlatform[] = ['shopee', 'lazada', 'makro', 'alibaba'];

class UpsertAffiliateDto {
  @IsIn(PLATFORMS)
  platform!: AffiliatePlatform;

  @IsString() @MinLength(3) @MaxLength(200)
  affiliate_id!: string;

  @IsOptional() @IsString() @MaxLength(100)
  sub_id?: string;

  @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

class ToggleDto {
  @IsBoolean() is_active!: boolean;
}

@Controller('affiliate')
export class AffiliateController {
  constructor(private readonly svc: AffiliateService) {}

  /** List all affiliate configs for the calling org. */
  @Get()
  list(@CurrentUser() user: CU) {
    return this.svc.listConfig(user);
  }

  /** Create or update an affiliate config for a platform. */
  @Post()
  @HttpCode(200)
  upsert(@CurrentUser() user: CU, @Body() dto: UpsertAffiliateDto) {
    return this.svc.upsertConfig(user, dto);
  }

  /** Enable / disable a config without deleting it. */
  @Patch(':id/toggle')
  @HttpCode(200)
  toggle(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ToggleDto,
  ) {
    return this.svc.toggleConfig(user, id, dto.is_active);
  }

  /** Delete a config permanently. */
  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: CU, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.deleteConfig(user, id);
  }

  /** Monthly click stats by platform. */
  @Get('stats')
  stats(@CurrentUser() user: CU) {
    return this.svc.clickStats(user);
  }
}
