import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type GatewaySessionInput = {
  tranId: string;
  totalBdt: number;
  method: 'online' | 'mobile_banking';
  orderId: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  productName: string;
  itemCount: number;
};

export type GatewayValidation = {
  status: string;
  tranId: string;
  valId: string;
  amountBdt: number;
  currency: string;
  orderId: string;
  gateway: string | null;
};

const SSL_HOSTS = new Set(['sandbox.sslcommerz.com', 'securepay.sslcommerz.com']);

@Injectable()
export class SslCommerzService {
  constructor(private readonly config: ConfigService) {}

  private credentials() {
    const storeId = this.config.get<string>('SSLCOMMERZ_STORE_ID')?.trim();
    const storePassword = this.config.get<string>('SSLCOMMERZ_STORE_PASSWORD')?.trim();
    const isLive = this.config.get<string>('SSLCOMMERZ_IS_LIVE') === 'true';
    if (!storeId || !storePassword) {
      throw new ServiceUnavailableException('Online payment is not configured.');
    }
    const origin = this.config.get<string>('API_PUBLIC_URL')?.trim().replace(/\/$/, '');
    if (!origin || !/^https:\/\//i.test(origin)) {
      throw new ServiceUnavailableException('Online payment callbacks are not configured.');
    }
    return { storeId, storePassword, isLive, origin };
  }

  async createSession(input: GatewaySessionInput): Promise<string> {
    const { storeId, storePassword, isLive, origin } = this.credentials();
    const base = isLive
      ? 'https://securepay.sslcommerz.com'
      : 'https://sandbox.sslcommerz.com';
    const callback = `${origin}/api/marketplace/payments/sslcommerz`;
    const body = new URLSearchParams({
      store_id: storeId,
      store_passwd: storePassword,
      total_amount: input.totalBdt.toFixed(2),
      currency: 'BDT',
      tran_id: input.tranId,
      success_url: `${callback}/success`,
      fail_url: `${callback}/fail`,
      cancel_url: `${callback}/cancel`,
      ipn_url: `${callback}/ipn`,
      cus_name: input.customerName.slice(0, 50),
      cus_email: input.email,
      cus_add1: input.address.slice(0, 200) || 'Bangladesh',
      cus_city: input.city.slice(0, 50) || 'Dhaka',
      cus_postcode: '1000',
      cus_country: 'Bangladesh',
      cus_phone: input.phone.slice(0, 20),
      shipping_method: 'YES',
      num_of_item: String(input.itemCount),
      product_name: input.productName.slice(0, 200),
      product_category: 'general',
      product_profile: 'general',
      value_a: input.orderId,
      value_b: input.method,
    });
    if (input.method === 'mobile_banking') {
      body.set('multi_card_name', 'bkash,nagad,rocket');
    }

    const response = await fetch(`${base}/gwprocess/v4/api.php`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    const payload = (await response.json()) as { status?: string; GatewayPageURL?: string };
    const page = payload.GatewayPageURL ?? '';
    if (payload.status !== 'SUCCESS' || !this.isGatewayUrl(page, isLive)) {
      throw new BadRequestException('Could not start the payment session.');
    }
    return page;
  }

  async validate(valId: string): Promise<GatewayValidation> {
    const { storeId, storePassword, isLive } = this.credentials();
    const base = isLive
      ? 'https://securepay.sslcommerz.com'
      : 'https://sandbox.sslcommerz.com';
    const url = new URL(`${base}/validator/api/validationserverAPI.php`);
    url.searchParams.set('val_id', valId);
    url.searchParams.set('store_id', storeId);
    url.searchParams.set('store_passwd', storePassword);
    url.searchParams.set('format', 'json');
    url.searchParams.set('v', '1');

    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const payload = (await response.json()) as Record<string, string | undefined>;
    const amount = Number(payload.amount ?? payload.currency_amount);
    return {
      status: String(payload.status ?? ''),
      tranId: String(payload.tran_id ?? ''),
      valId: String(payload.val_id ?? valId),
      amountBdt: Number.isFinite(amount) ? amount : Number.NaN,
      currency: String(payload.currency_type ?? payload.currency ?? ''),
      orderId: String(payload.value_a ?? ''),
      gateway: payload.card_type ? String(payload.card_type) : null,
    };
  }

  private isGatewayUrl(page: string, isLive: boolean): boolean {
    try {
      const url = new URL(page);
      if (url.protocol !== 'https:') return false;
      if (!SSL_HOSTS.has(url.hostname) && !url.hostname.endsWith('.sslcommerz.com')) return false;
      if (isLive && url.hostname === 'sandbox.sslcommerz.com') return false;
      return true;
    } catch {
      return false;
    }
  }
}
