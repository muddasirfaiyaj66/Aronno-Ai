import { ConsultController } from '../consult/consult.controller';
import { ConsultInternalController } from '../consult/consult-internal.controller';
import { ConsultService } from '../consult/consult.service';
import {
  type ApiApp,
  OID,
  coverRoutes,
  createApiApp,
  stubMap,
} from './api-harness';

describe('consult API', () => {
  let api: ApiApp;

  beforeAll(async () => {
    api = await createApiApp({
      controllers: [ConsultController, ConsultInternalController],
      providers: [
        {
          provide: ConsultService,
          useValue: stubMap({
            listSpecialists: [],
            setPresence: { online: true },
            create: { id: 'consult-1' },
            list: [],
            get: { id: 'consult-1' },
            accept: { id: 'consult-1', status: 'accepted' },
            ring: { id: 'consult-1', ringing: true },
            cancel: { id: 'consult-1', status: 'cancelled' },
            saveAdvice: { id: 'consult-1' },
            pdf: { filename: 'consult.pdf' },
            remove: { deleted: true },
            joinCheck: { allowed: true },
            setCallStatus: { status: 'in_call' },
          }),
        },
      ],
    });
  });

  afterAll(async () => {
    await api?.close();
  });

  const id = 'consult-1';

  coverRoutes(() => api.app, [
    { method: 'get', path: '/api/consults/specialists', access: 'user' },
    {
      method: 'post',
      path: '/api/consults/presence',
      access: 'user',
      body: { online: true },
      badBody: {},
    },
    {
      method: 'post',
      path: '/api/consults',
      access: 'user',
      body: { specialistId: OID, problemText: 'পাতায় দাগ' },
      badBody: {},
    },
    { method: 'get', path: '/api/consults', access: 'user' },
    { method: 'get', path: `/api/consults/${id}`, access: 'user' },
    { method: 'post', path: `/api/consults/${id}/accept`, access: 'user' },
    { method: 'post', path: `/api/consults/${id}/ring`, access: 'user' },
    { method: 'post', path: `/api/consults/${id}/cancel`, access: 'user' },
    {
      method: 'put',
      path: `/api/consults/${id}/advice`,
      access: 'user',
      body: {
        summaryBn: 'পাতা পরিষ্কার রাখুন',
        steps: 'সকালে স্প্রে করুন',
        medicines: [{ name: 'নাটিভো', dose: '১ মিলি', howToApply: 'পাতায়' }],
      },
      badBody: {},
    },
    { method: 'post', path: `/api/consults/${id}/pdf`, access: 'user' },
    { method: 'delete', path: `/api/consults/${id}`, access: 'user' },
    {
      method: 'post',
      path: `/api/internal/consults/${id}/join-check`,
      access: 'public',
    },
    {
      method: 'post',
      path: `/api/internal/consults/${id}/call-status`,
      access: 'public',
      body: { status: 'in_call' },
      badBody: { status: 'ringing' },
    },
  ]);
});
