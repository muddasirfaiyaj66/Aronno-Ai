import { AdminController } from '../admin/admin.controller';
import { AdminInsightsService } from '../admin/admin-insights.service';
import { AdminService } from '../admin/admin.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DeliverySettingsService } from '../marketplace/services/delivery-settings.service';
import { WalletService } from '../marketplace/services/wallet.service';
import {
  type ApiApp,
  STRONG_PASSWORD,
  USER,
  call,
  coverRoutes,
  createApiApp,
  stubMap,
} from './api-harness';

describe('admin API', () => {
  let api: ApiApp;

  beforeAll(async () => {
    api = await createApiApp({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: stubMap({
            listUsers: { items: [] },
            createAdmin: { id: 'admin-2' },
            patchRole: { id: 'user-2', role: 'USER' },
            reviewSpecialist: { id: 'user-2', status: 'approved' },
            patchActive: { id: 'user-2', isActive: true },
          }),
        },
        {
          provide: NotificationsService,
          useValue: stubMap({
            placeSuggestions: [],
            listBroadcasts: [],
            broadcast: { id: 'note-1' },
          }),
        },
        {
          provide: AdminInsightsService,
          useValue: stubMap({
            overview: { users: 1 },
            commerce: { orders: 0 },
            audit: null,
            setShopActive: { id: 'shop-1', isActive: false },
            setProductStatus: { id: 'prod-1', status: 'inactive' },
            listReports: [],
            resolveReport: { id: 'report-1' },
          }),
        },
        {
          provide: DeliverySettingsService,
          useValue: stubMap({
            current: { sameCityBdt: 60, otherCityBdt: 120 },
            update: { id: 'rates-1', sameCityBdt: 80, otherCityBdt: 140 },
          }),
        },
        {
          provide: WalletService,
          useValue: stubMap({
            listForAdmin: [],
            resolve: { id: 'payout-1', amountBdt: 500 },
          }),
        },
      ],
    });
  });

  afterAll(async () => {
    await api?.close();
  });

  coverRoutes(() => api.app, [
    { method: 'get', path: '/api/admin/delivery', access: 'admin' },
    {
      method: 'patch',
      path: '/api/admin/delivery',
      access: 'admin',
      body: { sameCityBdt: 80, otherCityBdt: 140 },
      badBody: {},
    },
    { method: 'get', path: '/api/admin/payouts', access: 'admin' },
    {
      method: 'post',
      path: '/api/admin/payouts/payout-1',
      access: 'admin',
      body: { action: 'paid' },
      badBody: {},
    },
    { method: 'get', path: '/api/admin/overview', access: 'admin' },
    { method: 'get', path: '/api/admin/commerce', access: 'admin' },
    {
      method: 'patch',
      path: '/api/admin/shops/shop-1',
      access: 'admin',
      body: { isActive: false },
      badBody: {},
    },
    {
      method: 'patch',
      path: '/api/admin/products/prod-1',
      access: 'admin',
      body: { status: 'inactive' },
      badBody: { status: 'deleted' },
    },
    { method: 'get', path: '/api/admin/reports', access: 'admin' },
    {
      method: 'post',
      path: '/api/admin/reports/report-1',
      access: 'admin',
      body: { action: 'dismiss' },
      badBody: {},
    },
    {
      method: 'get',
      path: '/api/admin/notifications/places',
      access: 'admin',
    },
    { method: 'get', path: '/api/admin/notifications', access: 'admin' },
    {
      method: 'post',
      path: '/api/admin/notifications',
      access: 'admin',
      body: {
        title: 'বন্যা সতর্কতা',
        body: 'নিচু জমি থেকে ফসল সরিয়ে নিন',
        priority: 'important',
        audience: 'all',
      },
      badBody: {},
    },
    { method: 'get', path: '/api/admin/users', access: 'admin' },
    {
      method: 'post',
      path: '/api/admin/users',
      access: 'admin',
      body: {
        email: 'new-admin@example.com',
        password: STRONG_PASSWORD,
        displayName: 'New Admin',
      },
      badBody: {},
    },
    {
      method: 'patch',
      path: '/api/admin/users/user-2/role',
      access: 'admin',
      body: { roleSlug: 'USER' },
      badBody: { roleSlug: 'NOPE' },
    },
    {
      method: 'patch',
      path: '/api/admin/users/user-2/specialist',
      access: 'admin',
      body: { decision: 'approve' },
      badBody: {},
    },
    {
      method: 'patch',
      path: '/api/admin/users/user-2/active',
      access: 'admin',
      body: { isActive: true },
      badBody: {},
    },
  ]);

  it('GET /api/admin/overview forbids a normal user', async () => {
    const res = await call(api.app, 'get', '/api/admin/overview', {
      person: USER,
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
