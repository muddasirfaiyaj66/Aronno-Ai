import { GeminiClient } from '../ai/gemini.client';
import { WEATHER } from '../ai/ai.tokens';
import { PlanningController } from '../planning/planning.controller';
import { WeatherController } from '../weather/weather.controller';
import { WeatherLocationService } from '../weather/weather-location.service';
import { SyncController } from '../sync/sync.controller';
import { SyncService } from '../sync/sync.service';
import { StorageController } from '../storage/storage.controller';
import { StorageService } from '../storage/storage.service';
import { type ApiApp, coverRoutes, createApiApp } from './api-harness';

const outlookMonth = {
  monthIso: '2026-10',
  monthBn: 'অক্টোবর',
  weatherIcon: 'cloud-rain',
  recommendedCropBn: 'ধান',
  tempC: 28,
  precipMm: 140,
};

const savedPlan = {
  id: 'plan-1',
  recommendationBn: 'অক্টোবর মাসে ধান রোপণ করুন।',
  costEstimate: null,
  months: [
    {
      monthBn: 'অক্টোবর',
      weatherIcon: 'cloud-rain',
      recommendedCropBn: 'ধান',
      tempC: 28,
      precipMm: 140,
      cropSlug: 'rice',
      plantingWindowBn: 'অক্টোবর মাসের ১ম–২য় সপ্তাহ',
      harvestWindowBn: 'ফেব্রুয়ারি–মার্চ',
      reasonBn: 'বৃষ্টি উপযোগী',
    },
  ],
};

describe('planning, weather, sync, and storage API', () => {
  let api: ApiApp;

  beforeAll(async () => {
    api = await createApiApp({
      controllers: [
        PlanningController,
        WeatherController,
        SyncController,
        StorageController,
      ],
      providers: [
        {
          provide: WEATHER,
          useValue: {
            current: jest.fn().mockResolvedValue({
              tempC: 30,
              humidity: 70,
              windKph: 8,
              weatherCode: 1,
              kind: 'clear',
              conditionBn: 'পরিষ্কার',
              conditionEn: 'Clear',
              precipitationMm: 0,
              precipProb: 0,
              locationBn: 'ঢাকা',
              source: 'test',
            }),
            sixMonthPlan: jest.fn().mockResolvedValue({
              recommendationBn: 'পরিকল্পনা',
              source: 'climatology',
              months: [outlookMonth],
            }),
          },
        },
        {
          provide: WeatherLocationService,
          useValue: {
            forUser: jest.fn().mockResolvedValue({
              lat: 23.8,
              lon: 90.4,
              locationBn: 'ঢাকা',
            }),
          },
        },
        {
          provide: GeminiClient,
          useValue: {
            generateJson: jest.fn().mockRejectedValue(new Error('offline')),
          },
        },
        {
          provide: SyncService,
          useValue: {
            uploadOffline: jest.fn().mockResolvedValue({ saved: 0 }),
            pullChat: jest.fn().mockResolvedValue({ messages: [] }),
          },
        },
        {
          provide: StorageService,
          useValue: {
            uploadImage: jest
              .fn()
              .mockResolvedValue({ url: 'https://example.com/leaf.jpg', publicId: 'img_1' }),
            deleteImage: jest.fn().mockResolvedValue(true),
          },
        },
      ],
      prisma: {
        cropPlan: {
          create: jest.fn(
            async (args: {
              data: {
                recommendationBn: string;
                costEstimate: unknown;
                months: { create: unknown[] };
              };
            }) => ({
              id: 'plan-1',
              recommendationBn: args.data.recommendationBn,
              costEstimate: args.data.costEstimate,
              months: args.data.months.create,
            }),
          ),
          findFirst: jest.fn().mockResolvedValue(savedPlan),
        },
        cropAdvice: {
          create: jest.fn().mockResolvedValue({
            id: 'advice-1',
            createdAt: new Date('2026-09-01T00:00:00.000Z'),
          }),
          findFirst: jest.fn().mockResolvedValue({
            id: 'advice-1',
            createdAt: new Date('2026-09-01T00:00:00.000Z'),
            input: { landSize: 2, landUnit: 'bigha' },
            result: {
              summaryBn: 'আলু এখন উপযোগী।',
              topCrops: [],
              wantedCheck: [],
              timeline: [],
              months: [],
              locationBn: 'ঢাকা',
              outlookSource: 'climatology',
              generatedBy: 'rules',
            },
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
      path: '/api/crop-plans/generate',
      access: 'user',
      body: {},
      badBody: { lat: 200 },
    },
    { method: 'get', path: '/api/crop-plans/latest', access: 'user' },
    {
      method: 'post',
      path: '/api/crop-plans/advise',
      access: 'user',
      body: {
        landSize: 2,
        landUnit: 'bigha',
        pastCrops: [{ nameBn: 'ধান' }],
        wantedCrops: ['আলু'],
      },
      badBody: {},
    },
    { method: 'get', path: '/api/crop-plans/advice/latest', access: 'user' },
    { method: 'get', path: '/api/weather/current', access: 'user' },
    {
      method: 'post',
      path: '/api/sync/offline',
      access: 'user',
      body: {},
      badBody: { extra: true },
    },
    { method: 'get', path: '/api/sync/chat', access: 'user' },
    {
      method: 'post',
      path: '/api/storage/upload',
      access: 'user',
      files: [{ field: 'file', filename: 'leaf.jpg' }],
      missingFile: true,
    },
    {
      method: 'post',
      path: '/api/storage/upload-multiple',
      access: 'user',
      files: [
        { field: 'files', filename: 'a.jpg' },
        { field: 'files', filename: 'b.jpg' },
      ],
      missingFile: true,
    },
    {
      method: 'delete',
      path: '/api/storage/image?publicId=img_1',
      access: 'user',
      invalidPath: '/api/storage/image',
    },
  ]);
});
