import {
  Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrService } from './pr.service';
import { PrPdfService } from './pr-pdf.service';
import { CreatePrDto, ImportLinkDto, ReceivePrDto, UpdatePrDto } from './dto';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CU } from '../../common/auth/current-user.decorator';

@Controller('pr')
export class PrController {
  constructor(
    private readonly svc: PrService,
    private readonly pdf: PrPdfService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: CU,
    @Query('status') status?: string,
    @Query('requester_id') requesterId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list(user, {
      status,
      requesterId,
      cursor,
      limit: limit ? Math.min(parseInt(limit, 10), 200) : 50,
    });
  }

  @Post()
  create(@CurrentUser() user: CU, @Body() dto: CreatePrDto) {
    return this.svc.create(user, dto);
  }

  @Post('import-link')
  @HttpCode(200)
  importLink(@CurrentUser() user: CU, @Body() dto: ImportLinkDto) {
    return this.svc.importLink(user, dto.url);
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.getOne(user, id);
  }

  /**
   * Streamed PDF. Content-Type/Disposition headers are set so the browser
   * offers a download instead of rendering as text. The service writes
   * directly to the Express response.
   */
  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  async getPdf(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Disposition', `inline; filename="${id}.pdf"`);
    await this.pdf.render(user, id, res);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePrDto,
  ) {
    return this.svc.update(user, id, dto);
  }

  @Post(':id/submit')
  submit(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.submit(user, id);
  }

  @Post(':id/receive')
  receive(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReceivePrDto,
  ) {
    return this.svc.receive(user, id, dto);
  }

  // ---------------------------------------------------------------------
  // Comments thread
  // ---------------------------------------------------------------------

  @Get(':id/comments')
  listComments(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.listComments(user, id);
  }

  @Post(':id/comments')
  addComment(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { body: string },
  ) {
    const text = (body.body ?? '').trim();
    if (!text || text.length > 4000) {
      return { error: 'body must be 1–4000 chars' };
    }
    return this.svc.addComment(user, id, text);
  }
}
