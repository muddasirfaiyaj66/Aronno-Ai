import { Module } from '@nestjs/common';
import { ToolsController } from './tools.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [ToolsController],
})
export class ToolsModule {}
