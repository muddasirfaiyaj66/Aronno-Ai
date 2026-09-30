import { UsersController } from '../users/users.controller';
import { UsersService } from '../users/users.service';
import {
  type ApiApp,
  coverRoutes,
  createApiApp,
  stubMap,
} from './api-harness';

describe('users API', () => {
  let api: ApiApp;

  beforeAll(async () => {
    api = await createApiApp({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: stubMap({
            me: { id: 'user-1', displayName: 'Farmer' },
            patchMe: { id: 'user-1', displayName: 'Farmer Two' },
            submitSpecialistDocs: { status: 'pending' },
          }),
        },
      ],
    });
  });

  afterAll(async () => {
    await api?.close();
  });

  coverRoutes(() => api.app, [
    { method: 'get', path: '/api/users/me', access: 'user' },
    {
      method: 'patch',
      path: '/api/users/me',
      access: 'user',
      body: { displayName: 'Farmer Two' },
      badBody: { displayName: 'A' },
    },
    {
      method: 'post',
      path: '/api/users/me/specialist-docs',
      access: 'user',
      body: {
        certificateUrl: 'https://example.com/cert.jpg',
        nidUrl: 'https://example.com/nid.jpg',
      },
      badBody: {},
    },
  ]);
});
