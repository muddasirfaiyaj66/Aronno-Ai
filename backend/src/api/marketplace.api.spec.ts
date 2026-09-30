import { CartController } from '../marketplace/controllers/cart.controller';
import { OrderController } from '../marketplace/controllers/order.controller';
import { ProductController } from '../marketplace/controllers/product.controller';
import { ShopController } from '../marketplace/controllers/shop.controller';
import { SslCommerzController } from '../marketplace/controllers/sslcommerz.controller';
import { WalletController } from '../marketplace/controllers/wallet.controller';
import { CartService } from '../marketplace/services/cart.service';
import { OrderService } from '../marketplace/services/order.service';
import { PaymentService } from '../marketplace/services/payment.service';
import { ProductService } from '../marketplace/services/product.service';
import { ReviewService } from '../marketplace/services/review.service';
import { ShopService } from '../marketplace/services/shop.service';
import { WalletService } from '../marketplace/services/wallet.service';
import {
  type ApiApp,
  coverRoutes,
  createApiApp,
  stubMap,
} from './api-harness';

describe('marketplace API', () => {
  let api: ApiApp;

  beforeAll(async () => {
    api = await createApiApp({
      controllers: [
        ProductController,
        CartController,
        OrderController,
        ShopController,
        WalletController,
        SslCommerzController,
      ],
      providers: [
        {
          provide: ProductService,
          useValue: stubMap({
            filterProducts: [],
            getProductsBySeller: [],
            getProductById: { id: 'prod-1' },
            createProduct: { id: 'prod-1' },
            updateProduct: { id: 'prod-1' },
            deleteProduct: { deleted: true },
          }),
        },
        {
          provide: ReviewService,
          useValue: stubMap({
            getProductReviews: [],
            createReview: { id: 'rev-1' },
          }),
        },
        {
          provide: CartService,
          useValue: stubMap({
            getCart: { items: [] },
            addItem: { items: [] },
            updateItemQuantity: { items: [] },
            removeItem: { items: [] },
            clearCart: { cleared: true },
          }),
        },
        {
          provide: OrderService,
          useValue: stubMap({
            quote: { deliveryBdt: 60 },
            createOrder: { id: 'order-1' },
            getBuyerOrders: [],
            getShopOrders: [],
            getOrderById: { id: 'order-1' },
            updateOrderStatus: { id: 'order-1', status: 'shipped' },
          }),
        },
        {
          provide: ShopService,
          useValue: stubMap({
            filterShops: [],
            createShop: { id: 'shop-1' },
            getShopByOwner: { id: 'shop-1' },
            updateShop: { id: 'shop-1' },
            reportShop: { id: 'report-1' },
            getPublicShopById: { id: 'shop-1' },
          }),
        },
        {
          provide: WalletService,
          useValue: stubMap({
            summary: { balanceBdt: 0 },
            requestPayout: { id: 'payout-1' },
          }),
        },
        {
          provide: PaymentService,
          useValue: {
            handleCallback: jest.fn(async (kind: string) => ({
              result: kind === 'success' || kind === 'ipn' ? 'paid' : 'failed',
              orderId: 'order-1',
            })),
          },
        },
      ],
    });
  });

  afterAll(async () => {
    await api?.close();
  });

  const html = (res: { status: number; text: string }) => {
    expect(res.status).toBe(200);
    expect(res.text).toContain('orderId=');
  };

  coverRoutes(() => api.app, [
    { method: 'get', path: '/api/marketplace/products', access: 'public' },
    {
      method: 'get',
      path: '/api/marketplace/products/my-products',
      access: 'user',
    },
    {
      method: 'get',
      path: '/api/marketplace/products/prod-1',
      access: 'public',
    },
    {
      method: 'get',
      path: '/api/marketplace/products/prod-1/reviews',
      access: 'public',
    },
    {
      method: 'post',
      path: '/api/marketplace/products',
      access: 'user',
      body: { name: 'ইউরিয়া', priceBdt: 100 },
    },
    {
      method: 'patch',
      path: '/api/marketplace/products/prod-1',
      access: 'user',
      body: { name: 'ইউরিয়া' },
    },
    {
      method: 'delete',
      path: '/api/marketplace/products/prod-1',
      access: 'user',
    },
    { method: 'get', path: '/api/marketplace/cart', access: 'user' },
    {
      method: 'post',
      path: '/api/marketplace/cart/items',
      access: 'user',
      body: { productId: 'prod-1', quantity: 1 },
    },
    {
      method: 'patch',
      path: '/api/marketplace/cart/items/prod-1',
      access: 'user',
      body: { quantity: 2 },
    },
    {
      method: 'delete',
      path: '/api/marketplace/cart/items/prod-1',
      access: 'user',
    },
    { method: 'delete', path: '/api/marketplace/cart', access: 'user' },
    {
      method: 'post',
      path: '/api/marketplace/orders/quote',
      access: 'user',
      body: { shopId: 'shop-1', districtId: 'dist-1' },
    },
    {
      method: 'post',
      path: '/api/marketplace/orders',
      access: 'user',
      body: { shopId: 'shop-1', districtId: 'dist-1' },
    },
    {
      method: 'get',
      path: '/api/marketplace/orders/my-orders',
      access: 'user',
    },
    {
      method: 'get',
      path: '/api/marketplace/orders/shop-orders',
      access: 'user',
    },
    {
      method: 'get',
      path: '/api/marketplace/orders/order-1',
      access: 'user',
    },
    {
      method: 'patch',
      path: '/api/marketplace/orders/order-1/status',
      access: 'user',
      body: { status: 'shipped' },
    },
    {
      method: 'post',
      path: '/api/marketplace/orders/order-1/reviews',
      access: 'user',
      body: { rating: 5, comment: 'ভালো' },
    },
    { method: 'get', path: '/api/marketplace/shops', access: 'public' },
    {
      method: 'post',
      path: '/api/marketplace/shops',
      access: 'user',
      body: { name: 'কৃষি দোকান' },
    },
    { method: 'get', path: '/api/marketplace/shops/me', access: 'user' },
    {
      method: 'patch',
      path: '/api/marketplace/shops/me',
      access: 'user',
      body: { name: 'কৃষি দোকান' },
    },
    {
      method: 'post',
      path: '/api/marketplace/shops/shop-1/report',
      access: 'user',
      body: { reason: 'ভুয়া দোকান', details: 'ডেলিভারি হয় না' },
      badBody: { reason: 'x' },
    },
    {
      method: 'get',
      path: '/api/marketplace/shops/shop-1',
      access: 'public',
    },
    { method: 'get', path: '/api/marketplace/wallet', access: 'user' },
    {
      method: 'post',
      path: '/api/marketplace/wallet/payouts',
      access: 'user',
      body: {
        amountBdt: 500,
        channel: 'bkash',
        accountName: 'Farmer',
        accountNumber: '01700000000',
      },
    },
    {
      method: 'get',
      path: '/api/marketplace/payments/sslcommerz/success',
      access: 'public',
      assert: html,
    },
    {
      method: 'post',
      path: '/api/marketplace/payments/sslcommerz/success',
      access: 'public',
      body: { tran_id: 't1' },
      assert: html,
    },
    {
      method: 'get',
      path: '/api/marketplace/payments/sslcommerz/fail',
      access: 'public',
      assert: html,
    },
    {
      method: 'post',
      path: '/api/marketplace/payments/sslcommerz/fail',
      access: 'public',
      body: { tran_id: 't1' },
      assert: html,
    },
    {
      method: 'get',
      path: '/api/marketplace/payments/sslcommerz/cancel',
      access: 'public',
      assert: html,
    },
    {
      method: 'post',
      path: '/api/marketplace/payments/sslcommerz/cancel',
      access: 'public',
      body: { tran_id: 't1' },
      assert: html,
    },
    {
      method: 'post',
      path: '/api/marketplace/payments/sslcommerz/ipn',
      access: 'public',
      body: { tran_id: 't1', status: 'VALID' },
      assert: (res) => {
        expect(res.status).toBe(200);
        expect(res.text).toBe('OK');
      },
    },
  ]);
});
