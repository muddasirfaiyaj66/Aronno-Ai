import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

export type MailDetail = { label: string; value: string };

export type MailMessage = {
  to: string;
  subject: string;
  title: string;
  intro: string;
  details?: MailDetail[];
  code?: string;
  note?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn('SMTP_HOST is not set — emails will be logged only');
      return;
    }
    this.transporter = nodemailer.createTransport({
      host,
      port: Number(this.config.get('SMTP_PORT', 587)),
      secure: this.config.get('SMTP_SECURE', 'false') === 'true',
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });
  }

  async send(input: MailMessage) {
    const from = this.config.get<string>('SMTP_FROM', 'Aronno <noreply@aronno.local>');
    const text = plainText(input);
    const html = renderEmail(input);
    if (!this.transporter) {
      this.logger.log(`[dev] ${input.subject} → ${input.to}\n${text}`);
      return;
    }
    await this.transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text,
      html,
    });
  }

  async sendOtp(to: string, subject: string, code: string, bodyBn: string) {
    const title = subject.replace(/^আরণ্য\s*[—-]\s*/, '');
    await this.send({
      to,
      subject,
      title,
      intro: bodyBn,
      code,
      note: 'এই কোড ১৫ মিনিটের মধ্যে ব্যবহার করুন। কোডটি কাউকে দেবেন না।',
    });
  }
}

function plainText(input: MailMessage) {
  const lines = [input.title, '', input.intro];
  if (input.code) lines.push('', input.code);
  for (const row of input.details ?? []) lines.push(`${row.label}: ${row.value}`);
  if (input.note) lines.push('', input.note);
  lines.push('', 'আরণ্য');
  return lines.join('\n');
}

function renderEmail(input: MailMessage) {
  const details = (input.details ?? [])
    .map(
      (row) => `
        <tr>
          <td class="label" style="padding:10px 0;border-bottom:1px solid #e6eeeb;color:#5f736c;font-size:13px;width:38%;vertical-align:top;">${escapeHtml(row.label)}</td>
          <td class="value" style="padding:10px 0;border-bottom:1px solid #e6eeeb;color:#13241f;font-size:15px;font-weight:600;vertical-align:top;">${escapeHtml(row.value)}</td>
        </tr>`,
    )
    .join('');
  const code = input.code
    ? `<p class="code" style="margin:20px 0 8px;padding:16px 12px;background:#f0fdfa;border:1px dashed #0f766e;border-radius:12px;text-align:center;font-size:32px;letter-spacing:8px;font-weight:700;color:#115e59;">${escapeHtml(input.code)}</p>`
    : '';
  const table = details
    ? `<table class="details" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-collapse:collapse;">${details}</table>`
    : '';
  const note = input.note
    ? `<p class="note" style="margin:20px 0 0;padding:12px 14px;background:#f4f7f6;border-radius:10px;color:#3d524c;font-size:13px;line-height:1.6;">${escapeHtml(input.note)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(input.subject)}</title>
  <style>
    body { margin: 0; padding: 0; background: #eef3f1; color: #13241f; }
    .shell { width: 100%; background: #eef3f1; padding: 28px 12px; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #d7e4df; }
    .brand { background: #0f766e; color: #ffffff; padding: 22px 28px; }
    .brand-mark { margin: 0; font-size: 22px; letter-spacing: 0.4px; }
    .brand-sub { margin: 4px 0 0; font-size: 13px; color: #d1fae5; }
    .content { padding: 28px; font-family: "Noto Sans Bengali", "Segoe UI", sans-serif; line-height: 1.7; }
    .title { margin: 0 0 10px; font-size: 22px; line-height: 1.4; color: #115e59; }
    .intro { margin: 0; font-size: 15px; color: #243833; }
    .footer { padding: 16px 28px 22px; color: #6b7f78; font-size: 12px; text-align: center; }
  </style>
</head>
<body style="margin:0;padding:0;background:#eef3f1;">
  <table class="shell" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#eef3f1;padding:28px 12px;">
    <tr>
      <td align="center">
        <table class="card" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #d7e4df;">
          <tr>
            <td class="brand" style="background:#0f766e;color:#ffffff;padding:22px 28px;">
              <p class="brand-mark" style="margin:0;font-size:22px;font-weight:700;">আরণ্য</p>
              <p class="brand-sub" style="margin:4px 0 0;font-size:13px;color:#d1fae5;">ক্ষেত, বাজার ও পরামর্শ</p>
            </td>
          </tr>
          <tr>
            <td class="content" style="padding:28px;font-family:'Noto Sans Bengali','Segoe UI',sans-serif;line-height:1.7;">
              <h1 class="title" style="margin:0 0 10px;font-size:22px;line-height:1.4;color:#115e59;">${escapeHtml(input.title)}</h1>
              <p class="intro" style="margin:0;font-size:15px;color:#243833;">${escapeHtml(input.intro)}</p>
              ${code}
              ${table}
              ${note}
            </td>
          </tr>
          <tr>
            <td class="footer" style="padding:4px 28px 22px;color:#6b7f78;font-size:12px;text-align:center;">
              এই ইমেইল আরণ্য থেকে পাঠানো হয়েছে।
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
