import { Injectable } from '@nestjs/common';
import type { CostEstimatePort, TtsPort } from './ports';
import {
  cultivationCost,
  toBigha,
  type CostCropSlug,
} from '../cost/cultivation-costs';

/** Local spray-cost formula + per-crop cultivation table — not an AI mock. */
@Injectable()
export class MockCostAdapter implements CostEstimatePort {
  estimate(
    cropSlug: CostCropSlug,
    landSize: number,
    landUnit: 'bigha' | 'acre',
  ) {
    const COST_PER_BIGHA_BDT = 220;
    const PESTICIDE_ML_PER_BIGHA = 50;
    const bigha = toBigha(landSize, landUnit);
    const spraySessions = bigha > 5 ? 3 : bigha > 2 ? 2 : 1;
    return {
      pesticideQuantity: `${Math.round(bigha * PESTICIDE_ML_PER_BIGHA)} মিলি`,
      totalCostBdt: Math.round(bigha * COST_PER_BIGHA_BDT * spraySessions),
      spraySessions,
      cultivation: cultivationCost(cropSlug, bigha),
    };
  }
}

@Injectable()
export class MockTtsAdapter implements TtsPort {
  async synthesize(_textBn: string): Promise<Buffer> {
    return silenceWav(0.4);
  }
}

function silenceWav(seconds: number): Buffer {
  const sampleRate = 8000;
  const samples = Math.floor(sampleRate * seconds);
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}
