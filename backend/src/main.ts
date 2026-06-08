import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true captures the original request body so the LINE webhook
  // controller can recompute the HMAC-SHA256 signature against the exact
  // bytes LINE signed (parsed/re-serialized JSON would fail verification).
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(Logger));

  // Standard security headers. CSP is set on the frontend (it owns the document);
  // here helmet handles HSTS, X-Content-Type-Options, Referrer-Policy, etc.
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // cookie-parser populates `req.cookies` for AuthMiddleware to read the
  // httpOnly access/refresh tokens.
  app.use(cookieParser());

  // CORS — only the configured web origin can hit us in prod.
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3001',
    credentials: true,
  });

  app.setGlobalPrefix('v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
