import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { map, Observable } from 'rxjs';

const SKIP = new Set(['/api/health']);

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    if (
      SKIP.has(req.path) ||
      req.path.startsWith('/api/uploads') ||
      req.path.startsWith('/api/tts/audio') ||
      req.path.startsWith('/api/marketplace/payments/sslcommerz') ||
      req.path.startsWith('/marketplace/payments/sslcommerz')
    ) {
      return next.handle();
    }
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'success' in data) return data;
        return { success: true, data };
      }),
    );
  }
}
