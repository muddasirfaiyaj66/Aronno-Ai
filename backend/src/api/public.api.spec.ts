import { AppController } from '../app.controller';
import { AppService } from '../app.service';
import { HealthController } from '../health/health.controller';
import { LookupsController } from '../lookups/lookups.controller';
import { MarketController } from '../market/market.controller';
import { HeatmapService } from '../market/heatmap.service';
import { StorageService } from '../storage/storage.service';
import {
  type ApiApp,
  coverRoutes,
  createApiApp,
  stubMap,
} from './api-harness';

const listingRow = {
  id: 'list-1',
  quantityBn: '১০ কেজি',
  askingPricePerKg: 45,
  thumbnailObjectKey: null,
  crop: { slug: 'rice', nameBn: 'ধান' },
  district: { slug: 'dhaka' },
  seller: { displayName: 'Farmer' },
};

describe('public and market API', () => {
  let api: ApiApp;

  beforeAll(async () => {
    api = await createApiApp({
      controllers: [
        AppController,
        HealthController,
        LookupsController,
        MarketController,
      ],
      providers: [
        AppService,
        {
          provide: HeatmapService,
          useValue: stubMap({ aggregate: { districts: [] } }),
        },
        {
          provide: StorageService,
          useValue: {
            urlFor: jest.fn().mockReturnValue('https://example.com/leaf.jpg'),
          },
        },
      ],
      prisma: {
        profession: {
          findMany: jest.fn().mockResolvedValue([{ slug: 'farmer', nameEn: 'Farmer' }]),
        },
        district: {
          findMany: jest.fn().mockResolvedValue([{ slug: 'dhaka', nameBn: 'ঢাকা' }]),
          findUnique: jest.fn().mockResolvedValue({ id: 'dist-1', slug: 'dhaka' }),
        },
        crop: {
          findMany: jest.fn().mockResolvedValue([{ slug: 'rice', nameBn: 'ধান' }]),
          findUnique: jest.fn().mockResolvedValue({ id: 'crop-1', slug: 'rice' }),
        },
        marketPrice: {
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue(null),
        },
        listing: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue(listingRow),
        },
      },
    });
  });

  afterAll(async () => {
    await api?.close();
  });

  coverRoutes(() => api.app, [
    {
      method: 'get',
      path: '/api',
      access: 'public',
      assert: (res) => {
        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('Aronno API');
      },
    },
    {
      method: 'get',
      path: '/api/health',
      access: 'public',
      assert: (res) => {
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(typeof res.body.uptime).toBe('number');
      },
    },
    { method: 'get', path: '/api/lookups/professions', access: 'public' },
    { method: 'get', path: '/api/lookups/districts', access: 'public' },
    { method: 'get', path: '/api/lookups/crops', access: 'public' },
    { method: 'get', path: '/api/market/prices', access: 'public' },
    { method: 'get', path: '/api/market/listings', access: 'public' },
    {
      method: 'post',
      path: '/api/market/listings',
      access: 'user',
      body: {
        cropSlug: 'rice',
        quantityBn: '১০ কেজি',
        askingPricePerKg: 45,
        districtSlug: 'dhaka',
      },
      badBody: {},
    },
    {
      method: 'post',
      path: '/api/market/listings/list-1/share',
      access: 'user',
    },
    { method: 'get', path: '/api/market/heatmap', access: 'public' },
  ]);
});
