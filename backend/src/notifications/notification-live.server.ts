import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { COOKIE } from '../common/constants';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationHub } from './notification-hub';

const LIVE_PATH = '/api/notifications/live';

@Injectable()
export class NotificationLiveServer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationLiveServer.name);
  private wss: WebSocketServer | null = null;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly hub: NotificationHub,
  ) {}

  onModuleInit() {
    const server = this.adapterHost.httpAdapter.getHttpServer() as {
      on?: (
        event: 'upgrade',
        listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void,
      ) => void;
    };
    if (typeof server?.on !== 'function') {
      this.logger.warn('Live notifications stay on the list API until the server is long-running.');
      return;
    }
    this.wss = new WebSocketServer({ noServer: true });
    server.on('upgrade', (req, socket, head) => {
      const path = (req.url ?? '').split('?')[0];
      if (path !== LIVE_PATH) return;
      void this.accept(req, socket, head);
    });
    this.logger.log(`Live notifications on ${LIVE_PATH}`);
  }

  onModuleDestroy() {
    this.wss?.close();
    this.wss = null;
  }

  private async accept(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const userId = await this.userIdFrom(req);
    if (!userId || !this.wss) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      this.hub.add(userId, ws);
      ws.send(JSON.stringify({ type: 'ready' }));
    });
  }

  private async userIdFrom(req: IncomingMessage) {
    const token = readCookie(req.headers.cookie, COOKIE.ACCESS);
    if (!token) return null;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, isActive: true },
      });
      if (!user?.isActive) return null;
      return user.id;
    } catch {
      return null;
    }
  }
}

function readCookie(header: string | undefined, name: string) {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    const key = part.slice(0, eq).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}
