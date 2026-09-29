import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CallClient {
  private readonly logger = new Logger(CallClient.name);

  constructor(private readonly config: ConfigService) {}

  get configured() {
    return Boolean(this.baseUrl() && this.secret());
  }

  async openRoom(consultId: string) {
    return this.post(`/v1/rooms`, { consultId });
  }

  async closeRoom(consultId: string) {
    return this.post(`/v1/rooms/${consultId}/close`, {});
  }

  private baseUrl() {
    return this.config.get<string>('CALL_SERVICE_URL')?.replace(/\/$/, '') ?? '';
  }

  private secret() {
    return this.config.get<string>('CALL_SERVICE_SECRET') ?? '';
  }

  private async post(path: string, body: unknown) {
    const base = this.baseUrl();
    const secret = this.secret();
    if (!base || !secret) return false;
    try {
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        this.logger.warn(`Call service ${path} returned ${res.status}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(`Call service ${path} failed: ${String(error)}`);
      return false;
    }
  }
}
