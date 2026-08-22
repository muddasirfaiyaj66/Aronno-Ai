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
  MockYieldAdapter,
} from './mock.adapters';
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

function useLiveAi(gemini: GeminiClient) {
  return gemini.isEnabled();
}

@Module({
  imports: [WeatherModule],
  providers: [
    GeminiClient,
    MockVisionAdapter,
    MockTreatmentAdapter,
    MockToolsAdapter,
    MockReceiptAdapter,
    MockFertilizerAdapter,
    MockYieldAdapter,
    MockPlanningAdapter,
    MockTtsAdapter,
    MockCostAdapter,
    GeminiVisionAdapter,
    GeminiTreatmentAdapter,
    GeminiToolsAdapter,
    GeminiReceiptAdapter,
    GeminiFertilizerAdapter,
    GeminiYieldAdapter,
    {
      provide: AI_VISION,
      useFactory: (gemini: GeminiClient, live: GeminiVisionAdapter, mock: MockVisionAdapter) =>
        useLiveAi(gemini) ? live : mock,
      inject: [GeminiClient, GeminiVisionAdapter, MockVisionAdapter],
    },
    {
      provide: AI_TREATMENT,
      useFactory: (
        gemini: GeminiClient,
        live: GeminiTreatmentAdapter,
        mock: MockTreatmentAdapter,
      ) => (useLiveAi(gemini) ? live : mock),
      inject: [GeminiClient, GeminiTreatmentAdapter, MockTreatmentAdapter],
    },
    {
      provide: AI_TOOLS,
      useFactory: (gemini: GeminiClient, live: GeminiToolsAdapter, mock: MockToolsAdapter) =>
        useLiveAi(gemini) ? live : mock,
      inject: [GeminiClient, GeminiToolsAdapter, MockToolsAdapter],
    },
    {
      provide: AI_RECEIPT,
      useFactory: (gemini: GeminiClient, live: GeminiReceiptAdapter, mock: MockReceiptAdapter) =>
        useLiveAi(gemini) ? live : mock,
      inject: [GeminiClient, GeminiReceiptAdapter, MockReceiptAdapter],
    },
    {
      provide: AI_FERTILIZER,
      useFactory: (
        gemini: GeminiClient,
        live: GeminiFertilizerAdapter,
        mock: MockFertilizerAdapter,
      ) => (useLiveAi(gemini) ? live : mock),
      inject: [GeminiClient, GeminiFertilizerAdapter, MockFertilizerAdapter],
    },
    {
      provide: AI_YIELD,
      useFactory: (gemini: GeminiClient, live: GeminiYieldAdapter, mock: MockYieldAdapter) =>
        useLiveAi(gemini) ? live : mock,
      inject: [GeminiClient, GeminiYieldAdapter, MockYieldAdapter],
    },
    { provide: AI_PLANNING, useClass: MockPlanningAdapter },
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
    AI_PLANNING,
    AI_TTS,
    WEATHER,
    COST_ESTIMATE,
  ],
})
export class AiModule {}
