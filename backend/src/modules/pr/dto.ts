import {
  IsArray, IsInt, IsNumber, IsOptional, IsString, IsUUID, IsUrl, MaxLength,
  ValidateNested, Min, ArrayMinSize, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PrLineItemInputDto {
  @IsString() @MaxLength(2000)
  description!: string;

  @IsNumber() @Min(0.0001)
  quantity!: number;

  @IsOptional() @IsString() @MaxLength(32)
  unit?: string;

  @IsInt() @Min(0)
  unit_price_minor!: number;

  @IsOptional() @IsUUID()
  supplier_id?: string;

  @IsOptional() @IsIn(['shopee', 'lazada', 'alibaba', 'makro', 'manual'])
  source?: string;

  @IsOptional() @IsUrl()
  source_url?: string;

  @IsOptional()
  source_metadata?: Record<string, unknown>;
}

export class CreatePrDto {
  @IsString() @MaxLength(200)
  title!: string;

  @IsOptional() @IsString() @MaxLength(4000)
  justification?: string;

  @IsOptional() @IsUUID()
  department_id?: string;

  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrLineItemInputDto)
  items!: PrLineItemInputDto[];
}

export class UpdatePrDto {
  @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @IsOptional() @IsString() @MaxLength(4000)
  justification?: string;

  @IsOptional() @IsUUID()
  department_id?: string;

  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrLineItemInputDto)
  items?: PrLineItemInputDto[];
}

export class ImportLinkDto {
  @IsUrl()
  url!: string;
}

export class ReceiveLineDto {
  @IsUUID() line_item_id!: string;
  @IsUUID() item_id!: string;
  @IsNumber() @Min(0.0001) quantity!: number;
}

export class ReceivePrDto {
  @IsUUID() warehouse_id!: string;

  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines!: ReceiveLineDto[];

  @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}
