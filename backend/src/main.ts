import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { json, urlencoded, type Request, type Response } from 'express';
import { networkInterfaces } from 'node:os';
import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

function lanIPv4(): string[] {
  const ips: string[] = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      const v4 = addr.family === 'IPv4' || (addr.family as unknown) === 4;
      if (v4 && !addr.internal) ips.push(addr.address);
    }
  }
  return [...new Set(ips)];
}

function isPrivateOrigin(origin: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/i.test(
    origin,
  );
}

function isAllowedOrigin(
  origin: string | undefined,
  allowed: string[],
  isDev: boolean,
) {
  if (!origin) return true;
  if (allowed.includes(origin)) return true;
  if (origin.endsWith('.vercel.app')) return true;
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl && origin === `https://${vercelUrl}`) return true;
  if (isDev && isPrivateOrigin(origin)) return true;
  return false;
}

export async function createNestApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const isDev =
    (config.get<string>('NODE_ENV') ?? 'development') !== 'production';

  if (process.env.VERCEL === '1') {
    app.set('trust proxy', 1);
  }

  app.setGlobalPrefix('api');
  app.use(helmet({ hidePoweredBy: true }));
  app.use(cookieParser());
  app.use(json({ limit: '4mb' }));
  app.use(urlencoded({ extended: true, limit: '4mb' }));

  const origins = config
    .get<string>(
      'CORS_ORIGIN',
      'http://localhost:8081,http://localhost:19006,http://localhost:8082',
    )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      callback(null, isAllowedOrigin(origin, origins, isDev));
    },
    credentials: true,
  });

  return app;
}

async function bootstrap() {
  const app = await createNestApp();
  const config = app.get(ConfigService);
  const port = Number(config.get('PORT') ?? process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  const lan = lanIPv4();
  logger.log(`Aronno API is running`);
  logger.log(`Port: ${port}`);
  logger.log(`Local:    http://localhost:${port}/api`);
  logger.log(`Health:   http://localhost:${port}/api/health`);
  if (lan.length === 0) {
    logger.warn('Network:  no LAN IPv4 found (Wi‑Fi / Ethernet off?)');
  } else {
    for (const ip of lan) {
      logger.log(`Network:  http://${ip}:${port}/api`);
    }
  }
}

let cached: ReturnType<typeof createNestApp> | undefined;

export default async function handler(req: Request, res: Response) {
  cached ??= createNestApp().then(async (app) => {
    await app.init();
    return app;
  });
  const app = await cached;
  app.getHttpAdapter().getInstance()(req, res);
}

if (process.env.VERCEL !== '1') {
  void bootstrap();
}
