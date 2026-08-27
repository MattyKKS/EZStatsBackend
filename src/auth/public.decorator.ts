import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as public so the global JwtAuthGuard skips it.
 * Used on /auth/* (login/register), /health, and the analysis media
 * endpoints that the browser loads directly via <img>/<video>.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
