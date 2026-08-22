import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

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

  async sendOtp(to: string, subject: string, code: string, bodyBn: string) {
    const from = this.config.get<string>(
      'SMTP_FROM',
      'Aronno <noreply@aronno.local>',
    );
    const html = `
      <div style="font-family:sans-serif;max-width:480px">
        <h2>আরণ্য</h2>
        <p>${bodyBn}</p>
        <p style="font-size:28px;letter-spacing:6px;font-weight:700">${code}</p>
        <p>এই কোড ১৫ মিনিটের মধ্যে ব্যবহার করুন।</p>
      </div>
    `;
    if (!this.transporter) {
      this.logger.log(`[dev] ${subject} → ${to} OTP=${code}`);
      return;
    }
    await this.transporter.sendMail({
      from,
      to,
      subject,
      text: `${bodyBn} ${code}`,
      html,
    });
  }
}
