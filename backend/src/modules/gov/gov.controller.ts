import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ArrayMinSize, IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Min,
  MaxLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GovService, type ProcurementKind } from './gov.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CU } from '../../common/auth/current-user.decorator';

class BriefDto {
  @IsIn(['goods', 'services', 'construction'])
  procurement_kind!: ProcurementKind;

  @IsInt() @Min(0)
  budget_minor!: number;

  @IsString() @MaxLength(8)
  currency!: string;

  @IsString() @MaxLength(5000)
  scope!: string;

  @IsArray() @ArrayMinSize(1)
  @IsString({ each: true })
  deliverables!: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  qualifications?: string[];

  @IsOptional() @IsObject()
  timeline?: { start?: string; end?: string };

  @IsOptional() @IsIn(['lowest_price', 'most_advantageous'])
  evaluation_method?: 'lowest_price' | 'most_advantageous';
}

class CreateDraftDto {
  @IsString() @MaxLength(200)
  title!: string;

  @IsOptional() @IsUUID()
  template_id?: string;

  @ValidateNested()
  @Type(() => BriefDto)
  brief!: BriefDto;
}

@Controller('gov/tor')
export class GovController {
  constructor(private readonly svc: GovService) {}

  @Get('templates')
  templates(@CurrentUser() user: CU) {
    return this.svc.listTemplates(user);
  }

  @Get('drafts')
  listDrafts(@CurrentUser() user: CU) {
    return this.svc.listDrafts(user);
  }

  @Post('drafts')
  createDraft(@CurrentUser() user: CU, @Body() dto: CreateDraftDto) {
    return this.svc.createDraft(user, dto);
  }

  @Get('drafts/:id')
  getDraft(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.getDraft(user, id);
  }
}
