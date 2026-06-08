import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PeopleService } from './people.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CU } from '../../common/auth/current-user.decorator';
import { LOCALES } from '../../common/i18n/dictionary';

class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString() @MaxLength(200)
  full_name!: string;

  @IsString() @MinLength(8) @MaxLength(200)
  password!: string;

  @IsOptional() @IsUUID()
  department_id?: string;

  @IsOptional() @IsUUID()
  role_id?: string;
}

class SetActiveDto {
  @IsBoolean()
  is_active!: boolean;
}

class CreateDepartmentDto {
  @IsString() @MaxLength(200)
  name!: string;

  @IsOptional() @IsString() @MaxLength(50)
  cost_center?: string;
}

class SetLocaleDto {
  // class-validator runs at runtime so we materialize the readonly tuple.
  @IsIn(LOCALES as unknown as readonly string[])
  locale!: typeof LOCALES[number];
}

class SetCookieConsentDto {
  // Essential cookies are always allowed under PDPA's legitimate-interest
  // basis — accepting only `essential: true` is meaningful as "rejection of
  // non-essential cookies".
  @IsBoolean()
  essential!: boolean;
  @IsBoolean()
  analytics!: boolean;
  @IsBoolean()
  marketing!: boolean;
  @IsString()
  decided_at!: string;
  @IsString()
  version!: string;
}

@Controller('people')
export class PeopleController {
  constructor(private readonly svc: PeopleService) {}

  @Get('me')
  getMe(@CurrentUser() user: CU) {
    return this.svc.getMe(user);
  }

  @Get('users')
  listUsers(@CurrentUser() user: CU, @Query('search') search?: string) {
    return this.svc.listUsers(user, search);
  }

  @Post('users')
  createUser(@CurrentUser() user: CU, @Body() dto: CreateUserDto) {
    return this.svc.createUser(user, dto);
  }

  @Patch('users/:id')
  setActive(
    @CurrentUser() user: CU,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetActiveDto,
  ) {
    return this.svc.setActive(user, id, dto.is_active);
  }

  @Get('departments')
  listDepartments(@CurrentUser() user: CU) {
    return this.svc.listDepartments(user);
  }

  @Post('departments')
  createDepartment(@CurrentUser() user: CU, @Body() dto: CreateDepartmentDto) {
    return this.svc.createDepartment(user, dto);
  }

  @Get('roles')
  listRoles(@CurrentUser() user: CU) {
    return this.svc.listRoles(user);
  }

  /**
   * Persist the current user's locale preference. The web app calls this
   * whenever the language dropdown changes so server-emitted messages
   * (LINE pushes, emails, PDFs) render in the user's chosen language.
   *
   * PUT instead of PATCH because we replace the whole locale field; the
   * endpoint is idempotent and small enough that there's no benefit to
   * partial semantics.
   */
  @Put('me/locale')
  setMyLocale(@CurrentUser() user: CU, @Body() dto: SetLocaleDto) {
    return this.svc.setLocale(user, dto.locale);
  }

  /**
   * Persist the user's cookie consent decision. Doubles as evidence the
   * DPO can produce on PDPA §22/§23 inquiries: which version of the notice
   * they accepted, what categories they opted into, and when.
   *
   * POST (not PUT) because each call records a *new* decision — if the user
   * revisits the banner and toggles something we want the latest decision
   * to win, but the audit log table captures the history.
   */
  @Post('me/consent')
  setMyCookieConsent(@CurrentUser() user: CU, @Body() dto: SetCookieConsentDto) {
    return this.svc.setCookieConsent(user, dto);
  }
}
