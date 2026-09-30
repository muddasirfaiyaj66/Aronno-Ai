import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import {
  type ApiApp,
  STRONG_PASSWORD,
  coverRoutes,
  createApiApp,
  stubMap,
} from './api-harness';

describe('auth API', () => {
  let api: ApiApp;

  beforeAll(async () => {
    api = await createApiApp({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: stubMap({
            register: { id: 'user-1' },
            login: { id: 'user-1' },
            googleLogin: { id: 'user-1' },
            verifyEmail: { id: 'user-1' },
            resendVerification: { sent: true },
            forgotPassword: { sent: true },
            resetPassword: { reset: true },
            refresh: { id: 'user-1' },
            logout: { ok: true },
            me: { id: 'user-1' },
            listSessions: [],
            revokeSession: { revoked: true },
          }),
        },
      ],
    });
  });

  afterAll(async () => {
    await api?.close();
  });

  const account = {
    email: 'farmer@example.com',
    password: STRONG_PASSWORD,
    displayName: 'Farmer',
  };

  coverRoutes(() => api.app, [
    {
      method: 'post',
      path: '/api/auth/register',
      access: 'public',
      body: account,
      badBody: {},
    },
    {
      method: 'post',
      path: '/api/auth/login',
      access: 'public',
      body: { email: account.email, password: 'secret' },
      badBody: {},
    },
    {
      method: 'post',
      path: '/api/auth/google',
      access: 'public',
      body: { idToken: 'google-id-token' },
      badBody: {},
    },
    {
      method: 'post',
      path: '/api/auth/verify-email',
      access: 'public',
      body: { email: account.email, code: '123456' },
      badBody: {},
    },
    {
      method: 'post',
      path: '/api/auth/resend-verification',
      access: 'public',
      body: { email: account.email },
      badBody: {},
    },
    {
      method: 'post',
      path: '/api/auth/forgot-password',
      access: 'public',
      body: { email: account.email },
      badBody: {},
    },
    {
      method: 'post',
      path: '/api/auth/reset-password',
      access: 'public',
      body: { email: account.email, code: '123456', password: STRONG_PASSWORD },
      badBody: {},
    },
    { method: 'post', path: '/api/auth/refresh', access: 'public' },
    { method: 'post', path: '/api/auth/logout', access: 'public' },
    { method: 'get', path: '/api/auth/me', access: 'user' },
    { method: 'get', path: '/api/auth/sessions', access: 'user' },
    {
      method: 'post',
      path: '/api/auth/sessions/sess-1/revoke',
      access: 'user',
    },
  ]);
});
