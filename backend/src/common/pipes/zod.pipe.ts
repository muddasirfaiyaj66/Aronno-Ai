import { Injectable, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { Errors } from '../errors';
import { messageFromZodError } from '../zod-messages';

@Injectable()
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw Errors.validation(
        result.error.flatten(),
        messageFromZodError(result.error),
      );
    }
    return result.data;
  }
}
