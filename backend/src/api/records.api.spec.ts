import { COST_ESTIMATE, AI_FERTILIZER, AI_RECEIPT, AI_TOOLS } from '../ai/ai.tokens';
import { CostController } from '../cost/cost.controller';
import { FertilizerController } from '../fertilizer/fertilizer.controller';
import { HistoryController } from '../history/history.controller';
import { HistoryService } from '../history/history.service';
import { ReceiptsController } from '../receipts/receipts.controller';
import { ToolsController } from '../tools/tools.controller';
import { TreatmentController } from '../treatment/treatment.controller';
import { TreatmentService } from '../treatment/treatment.service';
import { USER, type ApiApp, coverRoutes, createApiApp } from './api-harness';

const receiptRow = {
  id: 'receipt-1',
  userId: USER.id,
  totalBdt: 100,
  summaryBn: 'মোট ১০০ টাকা খরচ হয়েছে।',
  reviewedAt: null,
  items: [
    {
      id: 'item-1',
      nameBn: 'ইউরিয়া',
      quantity: '১',
      priceBn: '৳ ১০০',
      priceBdt: 100,
    },
  ],
};

const fertRow = {
  id: 'fert-1',
  userId: USER.id,
  fertilizerNameBn: 'ইউরিয়া',
  dosagePerBigha: '১ কেজি',
  applicationMethodBn: 'ছড়িয়ে দিন',
  timingBn: 'সকালে',
  warningBn: null,
  reasonBn: 'বৃদ্ধির জন্য',
  landSizeBigha: 1,
  cropAgeDays: 20,
  hasDisease: 'no',
  diseaseNameBn: null,
};

const costRow = {
  id: 'cost-1',
  userId: USER.id,
  pesticideQuantity: '100 ml',
  totalCostBdt: 500,
  spraySessions: 2,
  breakdown: { totalBdt: 1000, cropSlug: 'rice', cropNameBn: 'ধান', items: [] },
};

describe('farm record API', () => {
  let api: ApiApp;

  beforeAll(async () => {
    api = await createApiApp({
      controllers: [
        HistoryController,
        TreatmentController,
        CostController,
        FertilizerController,
        ReceiptsController,
        ToolsController,
      ],
      providers: [
        {
          provide: HistoryService,
          useValue: {
            list: jest.fn().mockResolvedValue({ items: [] }),
            get: jest.fn().mockResolvedValue({ id: 'hist-1' }),
            remove: jest.fn().mockResolvedValue({ deleted: true }),
          },
        },
        {
          provide: TreatmentService,
          useValue: {
            getOrCreate: jest.fn().mockResolvedValue({ id: 'plan-1' }),
          },
        },
        {
          provide: COST_ESTIMATE,
          useValue: {
            estimate: jest.fn().mockReturnValue({
              pesticideQuantity: '100 ml',
              totalCostBdt: 500,
              spraySessions: 2,
              cultivation: costRow.breakdown,
            }),
          },
        },
        {
          provide: AI_FERTILIZER,
          useValue: {
            recommend: jest.fn().mockResolvedValue({
              fertilizerNameBn: fertRow.fertilizerNameBn,
              dosagePerBigha: fertRow.dosagePerBigha,
              applicationMethodBn: fertRow.applicationMethodBn,
              timingBn: fertRow.timingBn,
              warningBn: null,
              reasonBn: fertRow.reasonBn,
            }),
          },
        },
        {
          provide: AI_RECEIPT,
          useValue: {
            scan: jest.fn().mockResolvedValue({
              totalBdt: 100,
              summaryBn: receiptRow.summaryBn,
              items: [
                {
                  nameBn: 'ইউরিয়া',
                  quantity: '১',
                  priceBn: '৳ ১০০',
                  priceBdt: 100,
                },
              ],
            }),
          },
        },
        {
          provide: AI_TOOLS,
          useValue: {
            identify: jest.fn().mockResolvedValue({
              toolNameBn: 'কোদাল',
              toolNameEn: 'Spade',
              reasonBn: 'মাটি খোঁড়ার জন্য',
              listings: [
                {
                  sourceName: 'Shop',
                  thumbnailUrl: 'https://example.com/t.jpg',
                  priceBn: '৳ 100',
                  externalUrl: 'https://example.com/item',
                },
              ],
            }),
          },
        },
      ],
      prisma: {
        crop: {
          findUnique: jest.fn().mockResolvedValue({ id: 'crop-1', slug: 'rice' }),
        },
        costEstimate: {
          create: jest.fn(
            async ({ data }: { data: Record<string, unknown> }) => ({
              id: 'cost-1',
              pesticideQuantity: data.pesticideQuantity,
              totalCostBdt: data.totalCostBdt,
              spraySessions: data.spraySessions,
              breakdown: data.breakdown,
            }),
          ),
          findUnique: jest.fn().mockResolvedValue(costRow),
        },
        fertilizerAdvice: {
          create: jest.fn().mockResolvedValue(fertRow),
          findUnique: jest.fn().mockResolvedValue(fertRow),
        },
        receipt: {
          create: jest.fn().mockResolvedValue(receiptRow),
          findUnique: jest.fn().mockResolvedValue(receiptRow),
        },
        withTransaction: jest.fn(
          async (fn: (tx: Record<string, unknown>) => Promise<unknown>) =>
            fn({
              receiptItem: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
              receipt: {
                update: jest.fn().mockResolvedValue({
                  ...receiptRow,
                  reviewedAt: new Date('2026-09-01T00:00:00.000Z'),
                }),
              },
            }),
        ),
        toolIdentification: {
          create: jest.fn(
            async ({
              data,
            }: {
              data: {
                toolNameBn: string;
                toolNameEn: string;
                reasonBn: string;
                listings: { create: Record<string, string>[] };
              };
            }) => ({
              id: 'tool-1',
              toolNameBn: data.toolNameBn,
              toolNameEn: data.toolNameEn,
              reasonBn: data.reasonBn,
              listings: data.listings.create.map((row, index) => ({
                id: `offer-${index}`,
                ...row,
              })),
            }),
          ),
          findUnique: jest.fn().mockResolvedValue({
            id: 'tool-1',
            userId: USER.id,
            toolNameBn: 'কোদাল',
            toolNameEn: 'Spade',
            reasonBn: 'মাটি খোঁড়ার জন্য',
            listings: [],
          }),
        },
      },
    });
  });

  afterAll(async () => {
    await api?.close();
  });

  coverRoutes(() => api.app, [
    { method: 'get', path: '/api/history', access: 'user' },
    { method: 'get', path: '/api/history/hist-1', access: 'user' },
    { method: 'delete', path: '/api/history/hist-1', access: 'user' },
    {
      method: 'get',
      path: '/api/treatment-plans?diagnosisId=diag-1',
      access: 'user',
      invalidPath: '/api/treatment-plans',
    },
    {
      method: 'post',
      path: '/api/cost-estimates',
      access: 'user',
      body: { cropSlug: 'rice', landSize: 1, landUnit: 'bigha' },
      badBody: {},
    },
    { method: 'get', path: '/api/cost-estimates/cost-1', access: 'user' },
    {
      method: 'post',
      path: '/api/fertilizer/recommend',
      access: 'user',
      body: {
        cropSlug: 'rice',
        growthStage: 'vegetative',
        soilColor: 'medium',
        soilMoisture: 'moist',
        landSizeBigha: 1,
        cropAgeDays: 20,
        hasDisease: 'no',
      },
      badBody: {},
    },
    { method: 'get', path: '/api/fertilizer/fert-1', access: 'user' },
    {
      method: 'post',
      path: '/api/receipts/scan',
      access: 'user',
      body: { imageUrl: 'https://example.com/receipt.jpg' },
      badBody: {},
    },
    {
      method: 'patch',
      path: '/api/receipts/receipt-1',
      access: 'user',
      body: {
        items: [{ nameBn: 'ইউরিয়া', quantity: '1', priceBdt: 100 }],
      },
      badBody: { items: [] },
    },
    { method: 'get', path: '/api/receipts/receipt-1', access: 'user' },
    {
      method: 'post',
      path: '/api/tools/identify/photo',
      access: 'user',
      body: { imageUrl: 'https://example.com/tool.jpg' },
      badBody: {},
    },
    {
      method: 'post',
      path: '/api/tools/identify/voice',
      access: 'user',
      body: { transcriptBn: 'কোদাল দেখা যাচ্ছে' },
      badBody: { transcriptBn: 'a' },
    },
    { method: 'get', path: '/api/tools/tool-1', access: 'user' },
  ]);
});
