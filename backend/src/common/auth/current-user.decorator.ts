import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUser {
  userId: string;
  orgId: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as CurrentUser;
  },
);
