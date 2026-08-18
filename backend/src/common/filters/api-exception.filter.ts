import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ThrottlerException) {
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'অনেকবার অনুরোধ হয়েছে। কিছুক্ষণ পর চেষ্টা করুন।',
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (
        typeof payload === 'object' &&
        payload !== null &&
        'success' in payload
      ) {
        res.status(status).json(payload);
        return;
      }
      res.status(status).json({
        success: false,
        error: {
          code: 'HTTP_ERROR',
          message:
            typeof payload === 'string'
              ? payload
              : ((payload as { message?: string }).message ?? 'অনুরোধ ব্যর্থ হয়েছে।'),
        },
      });
      return;
    }

    this.logger.error(exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: { code: 'INTERNAL', message: 'সার্ভারে সমস্যা হয়েছে।' },
    });
  }
}
