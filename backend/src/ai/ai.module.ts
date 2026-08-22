import { Module } from '@nestjs/common';
import {
  AI_FERTILIZER,
  AI_RECEIPT,
  AI_TOOLS,
  AI_TREATMENT,
  AI_TTS,
  AI_VISION,
  AI_YIELD,
  COST_ESTIMATE,
} from './ai.tokens';
import { MockCostAdapter, MockTtsAdapter } from './mock.adapters';
import { GeminiClient } from './gemini.client';
import {
  GeminiFertilizerAdapter,
  GeminiReceiptAdapter,
  GeminiToolsAdapter,
  GeminiTreatmentAdapter,
  GeminiVisionAdapter,
  GeminiYieldAdapter,
} from './gemini.adapters';
import { WeatherModule } from '../weather/weather.module';

@Module({
  imports: [WeatherModule],
  providers: [
    GeminiClient,
    { provide: AI_VISION, useClass: GeminiVisionAdapter },
    { provide: AI_TREATMENT, useClass: GeminiTreatmentAdapter },
    { provide: AI_TOOLS, useClass: GeminiToolsAdapter },
    { provide: AI_RECEIPT, useClass: GeminiReceiptAdapter },
    { provide: AI_FERTILIZER, useClass: GeminiFertilizerAdapter },
    { provide: AI_YIELD, useClass: GeminiYieldAdapter },
    { provide: AI_TTS, useClass: MockTtsAdapter },
    { provide: COST_ESTIMATE, useClass: MockCostAdapter },
  ],
  exports: [
    AI_VISION,
    AI_TREATMENT,
    AI_TOOLS,
    AI_RECEIPT,
    AI_FERTILIZER,
    AI_YIELD,
    AI_TTS,
    WeatherModule,
    COST_ESTIMATE,
    GeminiClient,
  ],
})
export class AiModule {}
