import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import * as helmet from 'helmet';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Augmentem el límit del body per suportar SRTs grans (~2000+ subtítols)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 8000);

  const corsOrigins = (config.get<string>('CORS_ORIGINS', '') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(cookieParser()); // ✅ ahora sí es función

  app.use(requestIdMiddleware);
  app.use(helmet.default());

// quitar header x-powered-by
app.getHttpAdapter().getInstance().disable('x-powered-by');

app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // API_ENABLED=false → worker-only mode (laptop): NestJS boots (Bull starts)
  // but no HTTP server is created. Default: true (local dev + VM both serve HTTP).
  const apiEnabled = process.env.API_ENABLED !== 'false';
  if (apiEnabled) {
    await app.listen(port);
    console.log(`API running on http://localhost:${port}`);
  } else {
    await app.init();
    console.log(`Worker mode active (API_ENABLED=false) — consuming jobs from Redis, no HTTP server`);
  }
}

bootstrap();
