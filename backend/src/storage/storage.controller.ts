import {
  BadRequestException,
  Controller,
  Delete,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { StorageService } from './storage.service';

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingle(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No image file provided in upload request.');
    }
    const data = await this.storageService.uploadImage(file);
    return { success: true, data };
  }

  @Post('upload-multiple')
  @UseInterceptors(FilesInterceptor('files', 5))
  async uploadMultiple(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || !files.length) {
      throw new BadRequestException('No image files provided in upload request.');
    }
    const uploads = await Promise.all(
      files.map((file) => this.storageService.uploadImage(file)),
    );
    return { success: true, data: uploads };
  }

  @Delete('image')
  async deleteImage(@Query('publicId') publicId: string) {
    if (!publicId) {
      throw new BadRequestException('publicId parameter is required.');
    }
    const deleted = await this.storageService.deleteImage(publicId);
    return { success: true, data: { deleted, publicId } };
  }
}
