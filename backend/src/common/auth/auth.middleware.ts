import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response, NextFunction } from 'express';
import type { CurrentUser as CU } from './current-user.decorator';
import type { JwtPayload } from './jwt-payload';

const ACCESS_COOKIE = 'nirva.access';

/**
 * Verifies an access token on every incoming request and attaches a
 * `CurrentUser` to `req.user`.
 *
 * Token source order:
 *   1. `Authorization: Bearer <jwt>` header (legacy / mobile / server-to-server)
 *   2. httpOnly cookie `nirva.access` (preferred for browsers)
 *
 * Once the SPA has fully migrated to cookies, the header path remains useful
 * for native mobile apps and curl-from-Terminal debugging.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly jwt: JwtService) {}

  use(req: Request & { user?: CU; cookies?: Record<string, string> }, _res: Response, next: NextFunction) {
    const token = readToken(req);
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!payload.sub || !payload.org) {
      throw new UnauthorizedException('Token missing user/org claims');
    }
    req.user = {
      userId: payload.sub,
      orgId:  payload.org,
      email:  payload.email,
    };
    next();
  }
}

function readToken(req: Request & { cookies?: Record<string, string> }): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  return req.cookies?.[ACCESS_COOKIE] ?? null;
}
