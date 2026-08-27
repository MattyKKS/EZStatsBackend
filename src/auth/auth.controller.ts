import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, SESSION_TTL_MS } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';

// Name matches what the frontend's middleware.ts checks for to gate routes.
const SESSION_COOKIE = 'token';

function toPublicUser(user: { id: string; email: string; name: string | null }) {
  return { id: user.id, email: user.email, name: user.name };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.register(dto);
    this.setSessionCookie(res, token);
    return { user: toPublicUser(user) };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.login(dto);
    this.setSessionCookie(res, token);
    return { user: toPublicUser(user) };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    if (token) await this.auth.logout(token);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  // Protected by the global guard — used to restore the session on refresh.
  @Get('me')
  me(@Req() req: Request & { user?: { userId: string; email: string; name: string | null } }) {
    const u = req.user;
    return u ? { id: u.userId, email: u.email, name: u.name } : null;
  }

  // httpOnly so JS can't read it; sameSite=lax + secure only in prod so local
  // http dev (localhost:3000 → localhost:4000, same-site) works.
  private setSessionCookie(res: Response, token: string) {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_TTL_MS,
      path: '/',
    });
  }
}
