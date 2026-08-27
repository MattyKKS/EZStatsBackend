import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AuthService } from './auth.service';

/**
 * Global guard: validates the httpOnly `token` cookie against the Session table
 * and attaches the user to the request. Routes marked @Public() are skipped.
 * Because sessions live in the DB, logout truly invalidates the token.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<
      Request & { user?: { userId: string; email: string; name: string | null } }
    >();
    const token = (req.cookies as Record<string, string> | undefined)?.token;
    const user = token ? await this.auth.getUserByToken(token) : null;
    if (!user) throw new UnauthorizedException();

    req.user = { userId: user.id, email: user.email, name: user.name };
    return true;
  }
}
