import { Injectable } from '@nestjs/common';
import type { WebSocket } from 'ws';
import type { NotificationDto } from './notification.types';

@Injectable()
export class NotificationHub {
  private readonly sockets = new Map<string, Set<WebSocket>>();

  add(userId: string, socket: WebSocket) {
    const set = this.sockets.get(userId) ?? new Set<WebSocket>();
    set.add(socket);
    this.sockets.set(userId, set);
    socket.once('close', () => this.remove(userId, socket));
  }

  remove(userId: string, socket: WebSocket) {
    const set = this.sockets.get(userId);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) this.sockets.delete(userId);
  }

  push(userId: string, item: NotificationDto) {
    const set = this.sockets.get(userId);
    if (!set) return;
    const payload = JSON.stringify({ type: 'notification', item });
    for (const socket of set) {
      if (socket.readyState !== socket.OPEN) continue;
      socket.send(payload);
    }
  }
}
