import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private isConfigured = false;

  constructor(private readonly config: ConfigService) {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.isConfigured = true;
      this.logger.log('Cloudinary SDK configured securely on backend.');
    } else {
      this.logger.warn(
        'Cloudinary environment variables missing (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).',
      );
    }
  }

  urlFor(key: string) {
    if (key.startsWith('http://') || key.startsWith('https://')) return key;
    return key;
  }

  async uploadImage(
    file: Express.Multer.File,
    folder = 'aronno/products',
  ): Promise<{ url: string; publicId: string }> {
    if (!this.isConfigured) {
      throw new InternalServerErrorException(
        'Backend image storage service is not configured.',
      );
    }

    if (!file) {
      throw new BadRequestException('No image file provided.');
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file format. Only JPG, PNG, WEBP, and GIF images are allowed.',
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10MB limit
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds maximum limit of 10MB.');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          quality: 'auto:good',
        },
        (error: Error | undefined, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            this.logger.error('Cloudinary upload error', error);
            return reject(
              new InternalServerErrorException('Image upload to Cloudinary failed.'),
            );
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        },
      );
      uploadStream.end(file.buffer);
    });
  }

  async deleteImage(publicId: string): Promise<boolean> {
    if (!this.isConfigured || !publicId) return false;
    try {
      const res = await cloudinary.uploader.destroy(publicId);
      return res.result === 'ok';
    } catch (err) {
      this.logger.error(`Failed to delete Cloudinary image: ${publicId}`, err);
      return false;
    }
  }
}
