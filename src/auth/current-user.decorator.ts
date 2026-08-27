import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface RequestUser {
  userId: string;
  email: string;
}

/** Injects the authenticated user's id (from the JWT) into a handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
    return req.user?.userId ?? '';
  },
);
