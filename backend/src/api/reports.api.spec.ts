jest.mock('../reports/report-pdf', () => ({
  buildReportPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4')),
}));

import { AI_TTS } from '../ai/ai.tokens';
import { ReportsTtsController } from '../reports/reports-tts.controller';
import { StorageService } from '../storage/storage.service';
import { TreatmentService } from '../treatment/treatment.service';
import {
  USER,
  type ApiApp,
  call,
  coverRoutes,
  createApiApp,
  expectOk,
} from './api-harness';

const diagnosis = {
  id: 'diag-1',
  userId: USER.id,
  diseaseNameBn: 'ব্লাস্ট',
  diseaseNameEn: 'Blast',
  confidence: 80,
  severity: 'medium',
  imageObjectKey: null,
  crop: { nameBn: 'ধান' },
};

describe('reports and speech API', () => {
  let api: ApiApp;

  beforeAll(async () => {
    api = await createApiApp({
      controllers: [ReportsTtsController],
      providers: [
        {
          provide: StorageService,
          useValue: {
            urlFor: jest.fn().mockReturnValue('https://example.com/leaf.jpg'),
          },
        },
        {
          provide: TreatmentService,
          useValue: {
            getOrCreate: jest.fn().mockResolvedValue({
              id: 'plan-1',
              cropNameBn: 'ধান',
              pesticideNameBn: 'নাটিভো',
              dosagePerBigha: '১০ মিলি',
              followUpLabelBn: '৭ দিন',
              weatherAdvisory: { reasonBn: 'বৃষ্টি নেই' },
              steps: [],
            }),
          },
        },
        {
          provide: AI_TTS,
          useValue: {
            synthesize: jest.fn().mockResolvedValue(Buffer.from('RIFFaudio')),
          },
        },
      ],
      prisma: {
        diagnosis: {
          findUnique: jest.fn().mockResolvedValue(diagnosis),
        },
        report: {
          create: jest.fn().mockResolvedValue({
            id: 'report-1',
            createdAt: new Date('2026-09-01T00:00:00.000Z'),
          }),
          findUnique: jest.fn().mockResolvedValue({
            id: 'report-1',
            userId: USER.id,
            diagnosisId: 'diag-1',
            treatmentPlanId: 'plan-1',
            pdfObjectKey: null,
            createdAt: new Date('2026-09-01T00:00:00.000Z'),
            user: { displayName: 'Farmer' },
            diagnosis,
          }),
        },
      },
    });
  });

  afterAll(async () => {
    await api?.close();
  });

  coverRoutes(() => api.app, [
    {
      method: 'post',
      path: '/api/reports',
      access: 'user',
      body: { diagnosisId: 'diag-1' },
      badBody: {},
    },
    { method: 'get', path: '/api/reports/report-1', access: 'user' },
    { method: 'post', path: '/api/reports/report-1/pdf', access: 'user' },
    {
      method: 'post',
      path: '/api/tts',
      access: 'user',
      body: { textBn: 'ধন্যবাদ' },
      badBody: { textBn: '' },
    },
  ]);

  it('GET /api/tts/audio/:id returns stored audio without a session', async () => {
    const created = await call(api.app, 'post', '/api/tts', {
      person: USER,
      body: { textBn: 'ধন্যবাদ' },
    });
    expectOk(created);
    const id = created.body.data.id as string;
    const audio = await call(api.app, 'get', `/api/tts/audio/${id}`);
    expect(audio.status).toBe(200);
    expect(audio.headers['content-type']).toMatch(/audio\/wav/);
  });
});
