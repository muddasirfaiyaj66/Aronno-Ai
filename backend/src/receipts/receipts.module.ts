import { Module } from '@nestjs/common';
import { ReceiptsController } from './receipts.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [ReceiptsController],
})
export class ReceiptsModule {}
