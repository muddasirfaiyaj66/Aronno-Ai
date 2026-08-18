import { Injectable } from '@nestjs/common';

@Injectable()
export class StorageService {
  urlFor(key: string) {
    if (key.startsWith('http://') || key.startsWith('https://')) return key;
    return key;
  }
}
