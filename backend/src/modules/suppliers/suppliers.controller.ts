import {
  Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SuppliersService } from './suppliers.service';
import { SupplierRiskService } from '../anomaly/supplier-risk.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CU } from '../../common/auth/current-user.decorator';

class CreateDto {
  @IsString() @MinLength(1) @MaxLength(30)  code!: string;
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(200) contact_name?: string;
  @IsOptional() @IsEmail()                  contact_email?: string;
  @IsOptional() @IsString() @MaxLength(30)  contact_phone?: string;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @IsString() @MaxLength(20)  tax_id?: string;
}

class UpdateDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(200) contact_name?: string;
  @IsOptional() @IsEmail()                  contact_email?: string;
  @IsOptional() @IsString() @MaxLength(30)  contact_phone?: string;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @IsString() @MaxLength(20)  tax_id?: string;
  @IsOptional() @IsBoolean()                is_active?: boolean;
}

@Controller('suppliers')
export class SuppliersController {
  constructor(
    private readonly svc: SuppliersService,
    private readonly risk: SupplierRiskService,
  ) {}

  @Get()
  list(@CurrentUser() user: CU, @Query('search') search?: string) {
    return this.svc.list(user, search);
  }

  @Get(':id/risk-score')
  async riskScore(@CurrentUser() user: CU, @Param('id', new ParseUUIDPipe()) id: string) {
    const score = await this.risk.getForSupplier(user, id);
    if (!score) throw new NotFoundException('No risk score computed yet for this supplier');
    return score;
  }

  @Get(':id')
  get(@CurrentUser() user: CU, @Param('id') id: string) {
    return this.svc.get(user, id);
  }

  @Post()
  create(@CurrentUser() user: CU, @Body() dto: CreateDto) {
    return this.svc.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: CU, @Param('id') id: string, @Body() dto: UpdateDto) {
    return this.svc.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  archive(@CurrentUser() user: CU, @Param('id') id: string) {
    return this.svc.archive(user, id);
  }
}
