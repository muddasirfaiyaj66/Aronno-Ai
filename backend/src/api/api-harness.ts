import {
  type INestApplication,
  type Provider,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request, { type Response } from 'supertest';
import { ApiExceptionFilter } from '../common/filters/api-exception.filter';
import { COOKIE } from '../common/constants';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { EnvelopeInterceptor } from '../common/interceptors/envelope.interceptor';
import { PrismaService } from '../prisma/prisma.service';

jest.setTimeout(30_000);

/** Fake signing key for tests. Not a deployed secret. */
export const ACCESS_SECRET = 'test-jwt-access-secret';
export const CSRF = 'test-csrf-token';
export const STRONG_PASSWORD = 'Password1!';
export const OID = '507f1f77bcf86cd799439011';

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'USER';
};

export const USER: SessionUser = {
  id: 'user-1',
  email: 'farmer@example.com',
  displayName: 'Farmer',
  role: 'USER',
};

export const ADMIN: SessionUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  displayName: 'Admin',
  role: 'ADMIN',
};

export type PrismaMock = Record<string, unknown> & {
  user: { findUnique: jest.Mock };
};

export type ApiApp = {
  app: INestApplication;
  prisma: PrismaMock;
  close: () => Promise<void>;
};

const PEOPLE = new Map<string, SessionUser>([
  [USER.id, USER],
  [ADMIN.id, ADMIN],
]);

export async function createApiApp(options: {
  controllers: Function[];
  providers?: Provider[];
  prisma?: Record<string, unknown>;
}): Promise<ApiApp> {
  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const person = PEOPLE.get(where.id);
        if (!person) return null;
        return {
          id: person.id,
          email: person.email,
          displayName: person.displayName,
          isActive: true,
          role: { slug: person.role },
        };
      }),
    },
    ...options.prisma,
  } as PrismaMock;

  const moduleRef = await Test.createTestingModule({
    imports: [JwtModule.register({})],
    controllers: options.controllers,
    providers: [
      ...(options.providers ?? []),
      { provide: PrismaService, useValue: prisma },
      {
        provide: ConfigService,
        useValue: {
          getOrThrow: (key: string) => {
            if (key === 'JWT_ACCESS_SECRET') return ACCESS_SECRET;
            throw new Error(`Missing config ${key}`);
          },
          get: (key: string) =>
            key === 'JWT_ACCESS_SECRET' ? ACCESS_SECRET : undefined,
        },
      },
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
      { provide: APP_GUARD, useClass: CsrfGuard },
      { provide: APP_FILTER, useClass: ApiExceptionFilter },
      { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    ],
  }).compile();

  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  await app.init();

  return {
    app,
    prisma,
    close: () => app.close(),
  };
}

export function stubMap(map: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(map).map(([name, value]) => [
      name,
      jest.fn().mockResolvedValue(value),
    ]),
  );
}

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export type RouteCase = {
  method: HttpMethod;
  path: string;
  access: 'public' | 'user' | 'admin';
  body?: unknown;
  badBody?: unknown;
  invalidPath?: string;
  files?: { field: string; filename: string }[];
  missingFile?: boolean;
  assert?: (res: Response) => void;
};

function personOf(route: RouteCase): SessionUser | null {
  if (route.access === 'public') return null;
  if (route.access === 'admin') return ADMIN;
  return USER;
}

export function call(
  app: INestApplication,
  method: HttpMethod,
  path: string,
  opts: {
    person?: SessionUser | null;
    body?: unknown;
    files?: { field: string; filename: string }[];
  } = {},
) {
  let req = request(app.getHttpServer())[method](path);
  if (opts.person) {
    const token = app.get(JwtService).sign(
      { sub: opts.person.id, role: opts.person.role },
      { secret: ACCESS_SECRET },
    );
    req = req
      .set('Cookie', `${COOKIE.ACCESS}=${token}; ${COOKIE.CSRF}=${CSRF}`)
      .set('x-csrf-token', CSRF);
  }
  if (opts.files?.length) {
    for (const file of opts.files) {
      req = req.attach(file.field, Buffer.from('image-bytes'), file.filename);
    }
    return req;
  }
  if (opts.body !== undefined) {
    req = req.send(opts.body as object);
  }
  return req;
}

function bodyPreview(res: Response) {
  if (res.body && typeof res.body === 'object') {
    return JSON.stringify(res.body).slice(0, 600);
  }
  return String(res.text).slice(0, 300);
}

export function expectOk(res: Response) {
  const status = res.status;
  expect({
    ok: status === 200 || status === 201,
    status,
    success: res.body?.success ?? null,
    body: bodyPreview(res),
  }).toMatchObject({ ok: true, success: true });
}

export function expectUnauthorized(res: Response) {
  expect(res.status).toBe(401);
  expect(res.body.success).toBe(false);
  expect(res.body.error.code).toBe('AUTH_INVALID');
}

export function expectBadRequest(res: Response) {
  expect({
    status: res.status,
    success: res.body?.success ?? null,
    body: bodyPreview(res),
  }).toMatchObject({ status: 400, success: false });
}

/** Registers success, 401, and 400 cases for one route. Call inside a describe. */
export function coverRoutes(app: () => INestApplication, cases: RouteCase[]) {
  for (const route of cases) {
    const label = `${route.method.toUpperCase()} ${route.path}`;
    const person = personOf(route);

    it(`${label} succeeds`, async () => {
      const res = await call(app(), route.method, route.path, {
        person,
        body: route.files ? undefined : route.body,
        files: route.files,
      });
      if (route.assert) {
        route.assert(res);
        return;
      }
      expectOk(res);
    });

    if (route.access !== 'public') {
      it(`${label} rejects a missing session`, async () => {
        const res = await call(app(), route.method, route.path, {
          person: null,
          body: route.body,
        });
        expectUnauthorized(res);
      });
    }

    if (route.badBody !== undefined) {
      it(`${label} rejects an invalid body`, async () => {
        const res = await call(app(), route.method, route.path, {
          person,
          body: route.badBody,
        });
        expectBadRequest(res);
      });
    }

    if (route.invalidPath) {
      it(`${label} rejects an incomplete request`, async () => {
        const res = await call(app(), route.method, route.invalidPath!, {
          person,
        });
        expectBadRequest(res);
      });
    }

    if (route.missingFile) {
      it(`${label} rejects a missing file`, async () => {
        const res = await call(app(), route.method, route.path, { person });
        expectBadRequest(res);
      });
    }
  }
}
