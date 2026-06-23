import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  ArrayMinSize, IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Min,
  MaxLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GovService, type ProcurementKind } from './gov.service';
import { GovPdfService } from './gov-pdf.service';
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

class UpdateDraftDto {
  @IsString() @MaxLength(50000)
  body_markdown!: string;
}

@Controller('gov/tor')
export class GovController {
  constructor(
    private readonly svc: GovService,
    private readonly pdf: GovPdfService,
  ) {}

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

  @Get('drafts/:id/pdf')
  @Header('Content-Type', 'application/pdf')
  async getDraftPdf(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const slug = id.slice(0, 8);
    res.setHeader('Content-Disposition', `inline; filename="tor-${slug}.pdf"`);
    await this.pdf.render(user, id, res);
  }

  @Patch('drafts/:id')
  updateDraft(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDraftDto,
  ) {
    return this.svc.updateDraftBody(user, id, dto.body_markdown);
  }

  @Post('drafts/:id/advance')
  advanceDraft(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.advanceDraftStatus(user, id);
  }

  @Post('drafts/:id/revert')
  revertDraft(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.revertDraftStatus(user, id);
  }
}
