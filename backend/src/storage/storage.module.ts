import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
