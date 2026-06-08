import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsIn } from 'class-validator';
import { ImportService, type ImportKind } from './import.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CU } from '../../common/auth/current-user.decorator';

class CsvImportDto {
  @IsIn(['items', 'suppliers', 'departments'])
  kind!: ImportKind;

  @IsArray()
  @ArrayMaxSize(10_000)
  rows!: Record<string, unknown>[];
}

@Controller('import')
export class ImportController {
  constructor(private readonly svc: ImportService) {}

  @Post('csv')
  csv(@CurrentUser() user: CU, @Body() dto: CsvImportDto) {
    if (dto.rows.length === 0) {
      throw new BadRequestException('rows[] is empty');
    }
    return this.svc.run(user, dto.kind, dto.rows);
  }
}
