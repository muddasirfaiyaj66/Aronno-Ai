import { Module } from '@nestjs/common';
import { ReportsTtsController } from './reports-tts.controller';
import { StorageModule } from '../storage/storage.module';
import { TreatmentModule } from '../treatment/treatment.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [StorageModule, TreatmentModule, AiModule],
  controllers: [ReportsTtsController],
})
export class ReportsModule {}
