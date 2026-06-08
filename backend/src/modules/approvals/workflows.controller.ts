import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post,
} from '@nestjs/common';
import {
  IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID,
  Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkflowsService } from './workflows.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CU } from '../../common/auth/current-user.decorator';

class StepDto {
  @IsInt() @Min(1) step_no!: number;

  @IsIn(['user', 'role', 'manager_of_requester'])
  approver_kind!: 'user' | 'role' | 'manager_of_requester';

  @IsString() @MaxLength(200)
  approver_ref!: string;

  @IsOptional() @IsInt() @Min(1) @Max(720)
  sla_hours?: number;
}

class CreateWorkflowDto {
  @IsString() @MaxLength(200)
  name!: string;

  @IsObject()
  match_rules!: Record<string, unknown>;

  @IsOptional() @IsBoolean()
  is_active?: boolean;

  @IsArray() @ValidateNested({ each: true })
  @Type(() => StepDto)
  steps!: StepDto[];
}

class UpdateWorkflowDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsObject() match_rules?: Record<string, unknown>;
  @IsOptional() @IsBoolean() is_active?: boolean;

  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => StepDto)
  steps?: StepDto[];
}

@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly svc: WorkflowsService) {}

  @Get()
  list(@CurrentUser() user: CU) {
    return this.svc.list(user);
  }

  @Post()
  create(@CurrentUser() user: CU, @Body() dto: CreateWorkflowDto) {
    return this.svc.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.svc.update(user, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.remove(user, id);
  }
}
