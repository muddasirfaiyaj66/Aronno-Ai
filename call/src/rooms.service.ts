import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { assertConsultId, assertServiceSecret, readJoinCheck } from './access';
import {
  AccessToken,
  RoomServiceClient,
  WebhookReceiver,
  type WebhookEvent,
} from 'livekit-server-sdk';
import { RoomStore } from './store';

const VIDEO = { width: 1280, height: 720, maxBitrate: 1_500_000 };

@Injectable()
export class RoomsService implements OnModuleInit {
  private readonly store = new RoomStore();
  private rooms: RoomServiceClient | null = null;
  private hooks: WebhookReceiver | null = null;

  async onModuleInit() {
    await this.store.init();
    const { key, secret, httpUrl } = this.livekit();
    if (key && secret && httpUrl) {
      this.rooms = new RoomServiceClient(httpUrl, key, secret);
      this.hooks = new WebhookReceiver(key, secret);
    }
  }

  async open(authorization: string | undefined, consultId: string) {
    this.assertSecret(authorization);
    this.assertId(consultId);
    const client = this.client();
    const roomName = `consult-${consultId}`;
    await client.createRoom({ name: roomName, emptyTimeout: 5 * 60, maxParticipants: 2 });
    await this.store.upsertOpen(consultId, roomName);
    return { consultId, roomName };
  }

  async close(authorization: string | undefined, consultId: string) {
    this.assertSecret(authorization);
    this.assertId(consultId);
    const room = await this.store.get(consultId);
    if (room && this.rooms) {
      await this.rooms.deleteRoom(room.roomName).catch(() => undefined);
    }
    await this.store.close(consultId);
    return { consultId, status: 'closed' };
  }

  async join(consultId: string, cookieHeader: string | undefined) {
    this.assertId(consultId);
    const person = await this.checkParticipant(consultId, cookieHeader);
    const room = await this.store.get(consultId);
    if (!room || room.status !== 'open') {
      throw new BadRequestException('Room is not open');
    }
    const { key, secret, wsUrl } = this.livekit();
    if (!key || !secret || !wsUrl) throw new ServiceUnavailableException('Video is not configured');
    const token = new AccessToken(key, secret, {
      identity: person.userId,
      name: person.displayName,
      ttl: '2h',
    });
    token.addGrant({
      roomJoin: true,
      room: room.roomName,
      canPublish: true,
      canSubscribe: true,
    });
    return {
      token: await token.toJwt(),
      url: wsUrl,
      video: VIDEO,
    };
  }

  async leave(consultId: string, cookieHeader: string | undefined) {
    this.assertId(consultId);
    const person = await this.checkParticipant(consultId, cookieHeader);
    const room = await this.store.get(consultId);
    if (room && this.rooms) {
      await this.rooms.removeParticipant(room.roomName, person.userId).catch(() => undefined);
      const left = await this.rooms.listParticipants(room.roomName).catch(() => []);
      if (left.length === 0) {
        await this.store.close(consultId);
        await this.notify(consultId, 'ended');
      }
    }
    return { consultId, status: 'left' };
  }

  async webhook(rawBody: string, authHeader: string | undefined) {
    if (!this.hooks) throw new ServiceUnavailableException('Video is not configured');
    const event = await this.hooks.receive(rawBody, authHeader);
    await this.onLiveKitEvent(event);
    return { ok: true };
  }

  private async onLiveKitEvent(event: WebhookEvent) {
    const roomName = event.room?.name ?? '';
    const consultId = roomName.startsWith('consult-') ? roomName.slice('consult-'.length) : '';
    if (!consultId) return;
    if (event.event === 'participant_joined') {
      await this.notify(consultId, 'in_call');
      return;
    }
    if (event.event === 'room_finished') {
      await this.store.close(consultId);
      await this.notify(consultId, 'ended');
      return;
    }
    if (event.event === 'participant_left' && this.rooms) {
      const left = await this.rooms.listParticipants(roomName).catch(() => []);
      if (left.length === 0) {
        await this.store.close(consultId);
        await this.notify(consultId, 'ended');
      }
    }
  }

  private client() {
    if (!this.rooms) throw new ServiceUnavailableException('Video is not configured');
    return this.rooms;
  }

  private livekit() {
    const key = process.env.LIVEKIT_API_KEY?.trim() ?? '';
    const secret = process.env.LIVEKIT_API_SECRET?.trim() ?? '';
    const wsUrl = process.env.LIVEKIT_URL?.trim() ?? '';
    const httpUrl = process.env.LIVEKIT_HTTP_URL?.trim() || 'http://127.0.0.1:7880';
    return { key, secret, wsUrl, httpUrl };
  }

  private assertSecret(authorization: string | undefined) {
    assertServiceSecret(authorization, process.env.CALL_SERVICE_SECRET ?? '');
  }

  private assertId(id: string) {
    assertConsultId(id);
  }

  private async checkParticipant(consultId: string, cookieHeader: string | undefined) {
    if (!cookieHeader?.includes('aronno_access=')) {
      throw new UnauthorizedException('Missing session');
    }
    const base = (process.env.ARONNO_API_URL ?? 'https://aronno-api.vercel.app/api').replace(/\/$/, '');
    const secret = process.env.CALL_SERVICE_SECRET ?? '';
    let res: Response;
    try {
      res = await fetch(`${base}/internal/consults/${consultId}/join-check`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          cookie: cookieHeader,
        },
      });
    } catch {
      throw new ServiceUnavailableException('API did not respond');
    }
    const body = await res.json().catch(() => null);
    return readJoinCheck(res.status, body);
  }

  private async notify(consultId: string, status: 'in_call' | 'ended') {
    const base = (process.env.ARONNO_API_URL ?? 'https://aronno-api.vercel.app/api').replace(/\/$/, '');
    const secret = process.env.CALL_SERVICE_SECRET ?? '';
    await fetch(`${base}/internal/consults/${consultId}/call-status`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status }),
    }).catch(() => undefined);
  }
}
