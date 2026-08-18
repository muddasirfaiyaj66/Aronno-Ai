import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { Public } from '../common/decorators/public.decorator';

@Controller('uploads')
export class UploadsController {
  @Public()
  @Get(':key')
  stream(@Param('key') key: string, @Res() res: Response) {
    const filename = key.replace('/', '-');
    const path = join(process.cwd(), 'uploads', filename);
    res.setHeader('Content-Type', 'application/octet-stream');
    createReadStream(path).on('error', () => res.status(404).end()).pipe(res);
  }
}
