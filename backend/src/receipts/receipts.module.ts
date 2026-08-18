import { Module } from '@nestjs/common';
import { ReceiptsController } from './receipts.controller';
import { AiModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [AiModule, StorageModule],
  controllers: [ReceiptsController],
})
export class ReceiptsModule {}
