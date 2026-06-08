import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * Lightweight guard that confirms `req.user` was populated by AuthMiddleware.
 * Use on controllers where we want to be explicit that auth is required.
 *
 * Most routes don't need this — the middleware itself throws 401 before
 * the handler runs — but exposing a guard makes the intent obvious in code
 * review and gives us a clean place to bolt on role checks later.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user) throw new UnauthorizedException();
    return true;
  }
}
