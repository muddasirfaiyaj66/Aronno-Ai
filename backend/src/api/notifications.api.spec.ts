import { NotificationsController } from '../notifications/notifications.controller';
import { NotificationsService } from '../notifications/notifications.service';
import {
  type ApiApp,
  coverRoutes,
  createApiApp,
  stubMap,
} from './api-harness';

describe('notifications API', () => {
  let api: ApiApp;

  beforeAll(async () => {
    api = await createApiApp({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: stubMap({
            list: [],
            syncLocation: { ok: true },
            markAllRead: { updated: 1 },
            markRead: { id: 'note-1', read: true },
            dismiss: { id: 'note-1', dismissed: true },
          }),
        },
      ],
    });
  });

  afterAll(async () => {
    await api?.close();
  });

  coverRoutes(() => api.app, [
    { method: 'get', path: '/api/notifications', access: 'user' },
    {
      method: 'post',
      path: '/api/notifications/location',
      access: 'user',
      body: { lat: 23.8, lon: 90.4 },
    },
    { method: 'post', path: '/api/notifications/read-all', access: 'user' },
    {
      method: 'post',
      path: '/api/notifications/note-1/read',
      access: 'user',
    },
    {
      method: 'post',
      path: '/api/notifications/note-1/dismiss',
      access: 'user',
    },
  ]);
});
