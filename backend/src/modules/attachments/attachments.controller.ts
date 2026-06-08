import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { IsNumber, IsString, MaxLength } from 'class-validator';
import { AttachmentsService } from './attachments.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CU } from '../../common/auth/current-user.decorator';

class CreateAttachmentDto {
  @IsString() @MaxLength(255)
  file_name!: string;

  @IsString() @MaxLength(100)
  file_type!: string;

  @IsNumber()
  file_size!: number;

  @IsString() @MaxLength(1000)
  storage_key!: string;
}

@Controller('pr/:prId/attachments')
export class AttachmentsController {
  constructor(private readonly svc: AttachmentsService) {}

  @Get()
  list(
    @CurrentUser() user: CU,
    @Param('prId', new ParseUUIDPipe()) prId: string,
  ) {
    return this.svc.listByPr(user, prId);
  }

  @Post()
  create(
    @CurrentUser() user: CU,
    @Param('prId', new ParseUUIDPipe()) prId: string,
    @Body() dto: CreateAttachmentDto,
  ) {
    return this.svc.create(user, prId, dto);
  }

  @Delete(':id')
  delete(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.delete(user, id);
  }
}
