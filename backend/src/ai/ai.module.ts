import { Module } from '@nestjs/common';
import {
  AI_FERTILIZER,
  AI_PLANNING,
  AI_RECEIPT,
  AI_TOOLS,
  AI_TREATMENT,
  AI_TTS,
  AI_VISION,
  AI_YIELD,
  COST_ESTIMATE,
  WEATHER,
} from './ai.tokens';
import {
  MockCostAdapter,
  MockFertilizerAdapter,
  MockPlanningAdapter,
  MockReceiptAdapter,
  MockToolsAdapter,
  MockTreatmentAdapter,
  MockTtsAdapter,
  MockVisionAdapter,
  MockWeatherAdapter,
  MockYieldAdapter,
} from './mock.adapters';

@Module({
  providers: [
    { provide: AI_VISION, useClass: MockVisionAdapter },
    { provide: AI_TREATMENT, useClass: MockTreatmentAdapter },
    { provide: AI_TOOLS, useClass: MockToolsAdapter },
    { provide: AI_RECEIPT, useClass: MockReceiptAdapter },
    { provide: AI_FERTILIZER, useClass: MockFertilizerAdapter },
    { provide: AI_YIELD, useClass: MockYieldAdapter },
    { provide: AI_PLANNING, useClass: MockPlanningAdapter },
    { provide: AI_TTS, useClass: MockTtsAdapter },
    { provide: WEATHER, useClass: MockWeatherAdapter },
    { provide: COST_ESTIMATE, useClass: MockCostAdapter },
  ],
  exports: [
    AI_VISION,
    AI_TREATMENT,
    AI_TOOLS,
    AI_RECEIPT,
    AI_FERTILIZER,
    AI_YIELD,
    AI_PLANNING,
    AI_TTS,
    WEATHER,
    COST_ESTIMATE,
  ],
})
export class AiModule {}
