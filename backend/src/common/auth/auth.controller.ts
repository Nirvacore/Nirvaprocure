import { Body, Controller, HttpCode, Inject, Post, Res, UnauthorizedException, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { PG_POOL } from '../db/db.module';
import type { JwtPayload } from './jwt-payload';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString() @MinLength(1)
  password!: string;
}

class RefreshDto {
  // Optional now — when omitted we fall back to the httpOnly `nirva.refresh` cookie.
  @IsOptional() @IsString() @MinLength(1)
  refresh_token?: string;
}

const ACCESS_COOKIE  = 'nirva.access';
const REFRESH_COOKIE = 'nirva.refresh';
// 15 min and 14 days, both in milliseconds.
const ACCESS_MAX_AGE  = 15 * 60 * 1000;
const REFRESH_MAX_AGE = 14 * 24 * 60 * 60 * 1000;

/**
 * Auth endpoints — `/auth/login` and `/auth/refresh`. Both are excluded from
 * the JWT middleware so unauthenticated callers can reach them.
 *
 * Security knobs:
 *   - bcrypt.compare for password verification (10-round hash by default).
 *   - `dev:<plaintext>` prefix is honored for seeded dev users so the demo
 *     stack works out of the box; production should never carry that prefix.
 *   - @Throttle limits brute-force attempts on login to 5 / 15 min per IP.
 *   - Access token: short-lived (15 min). Refresh token: long-lived (14d),
 *     stored opaquely in the JWT body — production should persist refresh
 *     tokens server-side so they can be revoked.
 */
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly jwt: JwtService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.pool.query(
      `SELECT id, org_id, email, full_name, password_hash, is_active
       FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [dto.email],
    );
    if (r.rowCount === 0) throw new UnauthorizedException('Invalid credentials');
    const u = r.rows[0];
    if (!u.is_active) throw new UnauthorizedException('Account disabled');

    const ok = await verifyPassword(dto.password, u.password_hash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return this.issueAndSetCookies(res, {
      sub: u.id, org: u.org_id, email: u.email,
    }, { id: u.id, email: u.email, full_name: u.full_name, org_id: u.org_id });
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Res({ passthrough: true }) res: Response) {
    clearCookie(res, ACCESS_COOKIE);
    clearCookie(res, REFRESH_COOKIE);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 15 * 60 * 1000 } })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Prefer the httpOnly cookie; allow body fallback for clients that haven't
    // migrated yet. Strip the body path once all clients are on cookies.
    const incoming = req.cookies?.[REFRESH_COOKIE] ?? dto.refresh_token;
    if (!incoming) throw new UnauthorizedException('No refresh token');

    let payload: JwtPayload & { typ?: string };
    try {
      payload = this.jwt.verify(incoming);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException('Wrong token type');
    }
    const r = await this.pool.query(
      `SELECT id, org_id, email, full_name, is_active FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [payload.sub],
    );
    if (r.rowCount === 0 || !r.rows[0].is_active) {
      throw new UnauthorizedException('User no longer active');
    }
    const u = r.rows[0];
    return this.issueAndSetCookies(res, {
      sub: u.id, org: u.org_id, email: u.email,
    }, { id: u.id, email: u.email, full_name: u.full_name, org_id: u.org_id });
  }

  private async issueAndSetCookies(
    res: Response,
    payload: JwtPayload,
    user: { id: string; email: string; full_name: string; org_id: string },
  ) {
    const token = await this.jwt.signAsync(payload, { expiresIn: '15m' });
    const refresh_token = await this.jwt.signAsync(
      { ...payload, typ: 'refresh' },
      { expiresIn: '14d' },
    );

    setCookie(res, ACCESS_COOKIE,  token,         ACCESS_MAX_AGE);
    setCookie(res, REFRESH_COOKIE, refresh_token, REFRESH_MAX_AGE);

    // Body still carries the tokens so the legacy localStorage clients keep
    // working through the transition. Remove the body fields once frontend
    // exclusively relies on cookies.
    return { token, refresh_token, user };
  }
}

// ---------------------------------------------------------------------------
// Cookie helpers — colocated so the security knobs live in one place
// ---------------------------------------------------------------------------
const PROD = process.env.NODE_ENV === 'production';

function setCookie(res: Response, name: string, value: string, maxAgeMs: number) {
  res.cookie(name, value, {
    httpOnly: true,
    sameSite: 'lax',   // strict would break the /login → / redirect on submit
    secure:   PROD,
    path:     '/',
    maxAge:   maxAgeMs,
  });
}
function clearCookie(res: Response, name: string) {
  res.clearCookie(name, { httpOnly: true, sameSite: 'lax', secure: PROD, path: '/' });
}

/**
 * Accepts both:
 *   - bcrypt hash (`$2a$...` / `$2b$...`) → bcrypt.compare
 *   - dev plaintext (`dev:<password>`)    → string compare, dev-only.
 */
async function verifyPassword(input: string, stored: string): Promise<boolean> {
  if (stored.startsWith('dev:')) {
    return stored.slice('dev:'.length) === input;
  }
  if (stored.startsWith('$2')) {
    return bcrypt.compare(input, stored);
  }
  return false;
}
