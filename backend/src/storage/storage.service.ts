import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Errors } from '../common/errors';

const MAX_BYTES = 8 * 1024 * 1024;
const MAGIC: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 },
  { mime: 'image/png', ext: 'png', test: (b) => b[0] === 0x89 && b[1] === 0x50 },
  {
    mime: 'image/webp',
    ext: 'webp',
    test: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  },
];

@Injectable()
export class StorageService {
  private readonly root = join(process.cwd(), 'uploads');

  async saveImage(file?: Express.Multer.File, prefix = 'img'): Promise<string> {
    if (!file?.buffer) throw Errors.validation({ image: 'required' });
    if (file.size > MAX_BYTES) throw Errors.payloadTooLarge();
    const kind = MAGIC.find((m) => m.test(file.buffer));
    if (!kind) throw Errors.unsupportedMedia();
    // TODO(storage): virus-scan hook + S3 object storage
    await mkdir(this.root, { recursive: true });
    const key = `${prefix}/${randomUUID()}.${kind.ext}`;
    await writeFile(join(this.root, key.replace('/', '-')), file.buffer);
    return key;
  }

  async savePdf(buffer: Buffer, prefix = 'pdf'): Promise<string> {
    await mkdir(this.root, { recursive: true });
    const key = `${prefix}/${randomUUID()}.pdf`;
    await writeFile(join(this.root, key.replace('/', '-')), buffer);
    return key;
  }

  urlFor(key: string) {
    return `/api/uploads/${encodeURIComponent(key)}`;
  }
}
