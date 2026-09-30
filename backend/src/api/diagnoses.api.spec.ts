import { DiagnosesController } from '../diagnoses/diagnoses.controller';
import { DiagnosesService } from '../diagnoses/diagnoses.service';
import {
  type ApiApp,
  coverRoutes,
  createApiApp,
  stubMap,
} from './api-harness';

describe('diagnoses API', () => {
  let api: ApiApp;

  beforeAll(async () => {
    api = await createApiApp({
      controllers: [DiagnosesController],
      providers: [
        {
          provide: DiagnosesService,
          useValue: stubMap({
            createPhoto: { id: 'diag-1' },
            createVoice: { id: 'diag-1' },
            transcribe: { transcriptBn: 'পাতায় দাগ' },
            list: { items: [] },
            get: { id: 'diag-1' },
          }),
        },
      ],
    });
  });

  afterAll(async () => {
    await api?.close();
  });

  coverRoutes(() => api.app, [
    {
      method: 'post',
      path: '/api/diagnoses/photo',
      access: 'user',
      body: { imageUrl: 'https://example.com/leaf.jpg' },
      badBody: {},
    },
    {
      method: 'post',
      path: '/api/diagnoses/voice',
      access: 'user',
      body: { transcriptBn: 'পাতায় বাদামি দাগ' },
      badBody: { transcriptBn: 'a' },
    },
    {
      method: 'post',
      path: '/api/diagnoses/transcribe',
      access: 'user',
      body: { audioBase64: 'a'.repeat(80), mimeType: 'audio/webm' },
      badBody: { audioBase64: 'short' },
    },
    { method: 'get', path: '/api/diagnoses', access: 'user' },
    { method: 'get', path: '/api/diagnoses/diag-1', access: 'user' },
  ]);
});
