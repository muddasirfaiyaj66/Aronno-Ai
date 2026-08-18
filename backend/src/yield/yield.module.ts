import { Module } from '@nestjs/common';
import { YieldController } from './yield.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [YieldController],
})
export class YieldModule {}
