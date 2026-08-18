import { Module } from '@nestjs/common';
import { ToolsController } from './tools.controller';
import { AiModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [AiModule, StorageModule],
  controllers: [ToolsController],
})
export class ToolsModule {}
