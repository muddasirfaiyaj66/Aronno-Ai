import { z } from 'zod';

export const httpUrl = z
  .string()
  .url()
  .refine((v) => v.startsWith('https://') || v.startsWith('http://'), {
    message: 'url',
  });

export const imageUrlSchema = z.object({ imageUrl: httpUrl }).strict();
