import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { StockService, type StockMoveType } from './stock.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CU } from '../../common/auth/current-user.decorator';

class MovementDto {
  @IsUUID() item_id!: string;
  @IsUUID() warehouse_id!: string;

  @IsIn(['receive','issue','adjust_in','adjust_out','transfer_in','transfer_out','opening'])
  type!: StockMoveType;

  @IsNumber() @Min(0.0001)
  qty!: number;

  @IsOptional() @IsString() @MaxLength(500)
  note?: string;

  @IsOptional() @IsString() @MaxLength(64)
  reference_type?: string;

  @IsOptional() @IsUUID()
  reference_id?: string;
}

@Controller('stock')
export class StockController {
  constructor(private readonly svc: StockService) {}

  @Get('warehouses')
  warehouses(@CurrentUser() user: CU) {
    return this.svc.listWarehouses(user);
  }

  @Get('on-hand')
  onHand(@CurrentUser() user: CU, @Query('warehouse_id') warehouseId?: string) {
    return this.svc.onHand(user, warehouseId);
  }

  @Post('movements')
  move(@CurrentUser() user: CU, @Body() dto: MovementDto) {
    return this.svc.recordMovement(user, dto);
  }
}
