import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { InvoiceOcrService, type OcrInvoiceResult } from './invoice-ocr.service';

class OcrInvoiceDto {
  /**
   * data: URL of the invoice image — `data:image/png;base64,...` or jpeg/webp.
   * 10MB max enforced loosely via MaxLength on the base64 string (≈7.5MB binary).
   */
  @IsString()
  @Matches(/^data:image\/(png|jpeg|webp|gif);base64,/, {
    message: 'image_data_url must be a data: URL with an image mime type',
  })
  @MaxLength(10 * 1024 * 1024)
  image_data_url!: string;

  @IsOptional() @IsString() @MaxLength(8)
  currency?: string;
}

@Controller('finance/invoice')
export class InvoiceOcrController {
  constructor(private readonly svc: InvoiceOcrService) {}

  @Post('ocr')
  async ocr(@Body() dto: OcrInvoiceDto): Promise<OcrInvoiceResult> {
    return this.svc.extract(dto.image_data_url, dto.currency ?? 'THB');
  }
}
