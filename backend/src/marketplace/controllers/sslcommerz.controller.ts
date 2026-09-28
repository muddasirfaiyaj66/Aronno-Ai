import { Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { PaymentService } from '../services/payment.service';

type CallbackKind = 'success' | 'fail' | 'cancel' | 'ipn';

@Controller('marketplace/payments/sslcommerz')
export class SslCommerzController {
  constructor(private readonly payments: PaymentService) {}

  @Public()
  @Get('success')
  successGet(@Query() query: Record<string, unknown>, @Res() res: Response) {
    return this.finish('success', query, res);
  }

  @Public()
  @Post('success')
  successPost(@Req() req: Request, @Res() res: Response) {
    return this.finish('success', bodyOf(req), res);
  }

  @Public()
  @Get('fail')
  failGet(@Query() query: Record<string, unknown>, @Res() res: Response) {
    return this.finish('fail', query, res);
  }

  @Public()
  @Post('fail')
  failPost(@Req() req: Request, @Res() res: Response) {
    return this.finish('fail', bodyOf(req), res);
  }

  @Public()
  @Get('cancel')
  cancelGet(@Query() query: Record<string, unknown>, @Res() res: Response) {
    return this.finish('cancel', query, res);
  }

  @Public()
  @Post('cancel')
  cancelPost(@Req() req: Request, @Res() res: Response) {
    return this.finish('cancel', bodyOf(req), res);
  }

  @Public()
  @Post('ipn')
  async ipn(@Req() req: Request, @Res() res: Response) {
    await this.payments.handleCallback('ipn', bodyOf(req));
    res.status(200).type('text/plain').send('OK');
  }

  private async finish(kind: CallbackKind, payload: Record<string, unknown>, res: Response) {
    const outcome = await this.payments.handleCallback(kind, payload);
    const result =
      outcome.result === 'paid' ? 'paid' : outcome.result === 'pending' ? 'pending' : 'failed';
    const query = `orderId=${encodeURIComponent(outcome.orderId ?? '')}&result=${result}`;
    const target = `aronno://payment?${query}`;
    const intent = `intent://payment?${query}#Intent;scheme=aronno;package=app.aronno.mobile;end`;
    const title =
      result === 'paid' ? 'পেমেন্ট হয়েছে' : result === 'pending' ? 'পেমেন্ট যাচাই হচ্ছে' : 'পেমেন্ট হয়নি';
    const href = escapeAttr(target);
    res.status(200).type('html').send(`<!doctype html>
<html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="font-family:sans-serif;padding:32px;text-align:center">
<p>${title}</p>
<p>অ্যাপে ফিরে যাচ্ছি…</p>
<p><a id="back" href="${href}">অ্যাপে ফিরে যান</a></p>
<script>
  var appUrl = ${JSON.stringify(target)};
  var intentUrl = ${JSON.stringify(intent)};
  window.location.href = appUrl;
  setTimeout(function () { window.location.href = intentUrl; }, 300);
</script>
</body></html>`);
  }
}

function bodyOf(req: Request): Record<string, unknown> {
  const body = req.body;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
