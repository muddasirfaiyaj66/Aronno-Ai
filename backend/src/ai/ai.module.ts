import { Module } from '@nestjs/common';
import {
  AI_FERTILIZER,
  AI_RECEIPT,
  AI_TOOLS,
  AI_TREATMENT,
  AI_TTS,
  AI_VISION,
  COST_ESTIMATE,
} from './ai.tokens';
import { MockCostAdapter } from './mock.adapters';
import { GeminiTtsAdapter } from './gemini-tts.adapter';
import { GeminiClient } from './gemini.client';
import {
  GeminiReceiptAdapter,
  GeminiToolsAdapter,
  GeminiTreatmentAdapter,
  GeminiVisionAdapter,
} from './gemini.adapters';
import { WeatherModule } from '../weather/weather.module';
import { RulesFertilizerAdapter } from '../fertilizer/fertilizer.rules';

@Module({
  imports: [WeatherModule],
  providers: [
    GeminiClient,
    { provide: AI_VISION, useClass: GeminiVisionAdapter },
    { provide: AI_TREATMENT, useClass: GeminiTreatmentAdapter },
    { provide: AI_TOOLS, useClass: GeminiToolsAdapter },
    { provide: AI_RECEIPT, useClass: GeminiReceiptAdapter },
    { provide: AI_FERTILIZER, useClass: RulesFertilizerAdapter },
    { provide: AI_TTS, useClass: GeminiTtsAdapter },
    { provide: COST_ESTIMATE, useClass: MockCostAdapter },
  ],
  exports: [
    AI_VISION,
    AI_TREATMENT,
    AI_TOOLS,
    AI_RECEIPT,
    AI_FERTILIZER,
    AI_TTS,
    WeatherModule,
    COST_ESTIMATE,
    GeminiClient,
  ],
})
export class AiModule {}
