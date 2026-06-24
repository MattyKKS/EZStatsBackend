import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Everything lives under /api so the frontend can point at http://localhost:4000/api
  app.setGlobalPrefix('api');

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
