import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { mkdirSync } from 'fs';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Reads the httpOnly session cookie set by /auth/login and /auth/register.
  app.use(cookieParser());

  // Everything lives under /api so the frontend can point at http://localhost:4000/api
  app.setGlobalPrefix('api');

  // Serve uploaded files (team logos, etc.) at /api/uploads/<file>.
  // Stored on local disk now; swap this folder for S3/Supabase later with no API change.
  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  mkdirSync(join(uploadsDir, 'videos'), { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: '/api/uploads/' });

  // Validate + strip unknown fields on every incoming DTO.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS for the local Next.js frontend (and whatever origins we configure).
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  const port = parseInt(process.env.PORT ?? '4000', 10);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`EZStats backend listening on http://localhost:${port}/api`);
}

bootstrap();
