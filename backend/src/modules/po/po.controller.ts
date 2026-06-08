import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PoService } from './po.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CU } from '../../common/auth/current-user.decorator';

class CreatePoFromPrDto {
  @IsUUID()
  pr_id!: string;

  @IsOptional() @IsUUID()
  supplier_id?: string;
}

class UpdateStatusDto {
  @IsString() @MaxLength(30)
  status!: string;
}

@Controller('po')
export class PoController {
  constructor(private readonly svc: PoService) {}

  @Get()
  list(@CurrentUser() user: CU, @Query('status') status?: string) {
    return this.svc.list(user, { status });
  }

  @Get(':id')
  getOne(@CurrentUser() user: CU, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.getOne(user, id);
  }

  @Post()
  create(@CurrentUser() user: CU, @Body() dto: CreatePoFromPrDto) {
    return this.svc.createFromPr(user, dto.pr_id, dto.supplier_id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.svc.updateStatus(user, id, dto.status);
  }
}
