import { Injectable } from '@nestjs/common';
import type {
  AiFertilizerPort,
  AiPlanningPort,
  AiReceiptPort,
  AiToolsPort,
  AiTreatmentPort,
  AiVisionPort,
  AiYieldPort,
  CostEstimatePort,
  FertilizerResult,
  PlanResult,
  ReceiptResult,
  ToolResult,
  TreatmentResult,
  TtsPort,
  VisionInput,
  VisionResult,
  WeatherPort,
  YieldResult,
} from './ports';

const DIAGNOSES: VisionResult[] = [
  {
    diseaseNameBn: 'বাদামি দাগ রোগ',
    diseaseNameEn: 'Brown Spot Disease',
    confidence: 87,
    severity: 'medium',
  },
  {
    diseaseNameBn: 'পাতা ঝলসানো রোগ',
    diseaseNameEn: 'Leaf Blight',
    confidence: 74,
    severity: 'high',
  },
  {
    diseaseNameBn: 'সুস্থ পাতা',
    diseaseNameEn: 'Healthy Leaf',
    confidence: 95,
    severity: 'low',
  },
];

@Injectable()
export class MockVisionAdapter implements AiVisionPort {
  // TODO(gemini): replace with Gemini/Gamma vision call
  async diagnose(_input: VisionInput): Promise<VisionResult> {
    await delay(400);
    return DIAGNOSES[Math.floor(Math.random() * DIAGNOSES.length)];
  }
}

@Injectable()
export class MockTreatmentAdapter implements AiTreatmentPort {
  // TODO(gemini): generate treatment from diagnosis via Gemini/Gamma
  async plan(diseaseNameBn: string): Promise<TreatmentResult> {
    await delay(300);
    return {
      pesticideNameBn: 'প্রোপিকোনাজল ২৫% ইসি',
      dosagePerBigha: '৫০ মিলি/বিঘা',
      followUpLabelBn: '৭ দিন পর আবার দেখুন',
      steps: [
        { step: 1, instructionBn: '১৬ লিটার পানির সাথে ৫০ মিলি ওষুধ মেশান।' },
        { step: 2, instructionBn: 'মিশ্রণটি ভালোভাবে ঝাঁকিয়ে নিন।' },
        { step: 3, instructionBn: 'বিকেলে রোদ কম থাকা অবস্থায় পুরো পাতায় স্প্রে করুন।' },
        { step: 4, instructionBn: 'স্প্রে করার পর হাত ও মুখ ভালোভাবে ধুয়ে ফেলুন।' },
      ],
      safety: [
        'হাতে গ্লাভস পরুন',
        'মুখে মাস্ক পরুন',
        'শিশুদের ক্ষেত থেকে দূরে রাখুন',
        'বাতাসের বিপরীতে স্প্রে করবেন না',
      ],
    };
  }
}

@Injectable()
export class MockToolsAdapter implements AiToolsPort {
  // TODO(gemini): tool identification vision / transcript matching
  async identify(input: VisionInput): Promise<ToolResult> {
    await delay(400);
    const grass = input.transcriptBn?.includes('ঘাস');
    if (grass) {
      return {
        toolNameBn: 'ব্রাশ কাটার',
        toolNameEn: 'Brush Cutter',
        reasonBn: 'ঘাস ও ছোট ঝোপ হাতে কাটার চেয়ে অনেক কম সময়ে পরিষ্কার করা যায়।',
        listings: [
          {
            sourceName: 'দারাজ',
            thumbnailUrl: '',
            priceBn: '৳ ৪,৫০০',
            externalUrl: 'https://example.com/listing/brush-cutter-daraz',
          },
          {
            sourceName: 'স্থানীয় কৃষি দোকান',
            thumbnailUrl: '',
            priceBn: '৳ ৪,২০০',
            externalUrl: 'https://example.com/listing/brush-cutter-local',
          },
        ],
      };
    }
    return {
      toolNameBn: 'হ্যান্ড স্প্রেয়ার',
      toolNameEn: 'Hand Sprayer',
      reasonBn: 'ছোট জমিতে সঠিক মাত্রায় কীটনাশক স্প্রে করার জন্য উপযুক্ত।',
      listings: [
        {
          sourceName: 'দারাজ',
          thumbnailUrl: '',
          priceBn: '৳ ৬৫০',
          externalUrl: 'https://example.com/listing/sprayer-daraz',
        },
        {
          sourceName: 'স্থানীয় কৃষি দোকান',
          thumbnailUrl: '',
          priceBn: '৳ ৫৮০',
          externalUrl: 'https://example.com/listing/sprayer-local',
        },
      ],
    };
  }
}

@Injectable()
export class MockReceiptAdapter implements AiReceiptPort {
  // TODO(gemini): receipt OCR
  async scan(_imageBuffer: Buffer): Promise<ReceiptResult> {
    await delay(400);
    return {
      totalBdt: 3200,
      summaryBn: 'মোট ৩,২০০ টাকা খরচ হয়েছে, যার মধ্যে সার ২,০০০ টাকা।',
      items: [
        { nameBn: 'ইউরিয়া সার', quantity: '২ ব্যাগ', priceBn: '৳ ২,০০০' },
        { nameBn: 'কীটনাশক', quantity: '১ বোতল', priceBn: '৳ ৮০০' },
        { nameBn: 'বীজ', quantity: '৫ কেজি', priceBn: '৳ ৪০০' },
      ],
    };
  }
}

@Injectable()
export class MockFertilizerAdapter implements AiFertilizerPort {
  // TODO(gemini): fertilizer recommendation
  async recommend(_input: {
    cropSlug: string;
    growthStage: string;
    soilColor: string;
    soilMoisture: string;
  }): Promise<FertilizerResult> {
    await delay(300);
    return {
      fertilizerNameBn: 'ইউরিয়া ও টিএসপি মিশ্রণ',
      dosagePerBigha: '১৫ কেজি ইউরিয়া + ১০ কেজি টিএসপি প্রতি বিঘা',
      applicationMethodBn: 'মাটির সাথে সমানভাবে মিশিয়ে সারিতে প্রয়োগ করুন।',
      timingBn: 'রোপণের ১৫–২০ দিন পর সকালে প্রয়োগ করুন।',
      warningBn:
        'অতিরিক্ত ইউরিয়া প্রয়োগ করলে গাছের ক্ষতি হতে পারে — নির্ধারিত মাত্রা মেনে চলুন।',
    };
  }
}

@Injectable()
export class MockYieldAdapter implements AiYieldPort {
  // TODO(gemini): yield prediction from crop, land, weather
  async predict(_cropSlug: string): Promise<YieldResult> {
    await delay(300);
    return {
      landSizeBn: '২ বিঘা',
      weatherSummaryBn: 'স্বাভাবিক বৃষ্টিপাত প্রত্যাশিত',
      estimatedMinMon: 32,
      estimatedMaxMon: 38,
      lastSeasonMon: 30,
      trend: 'up',
      changePercent: 15,
    };
  }
}

@Injectable()
export class MockPlanningAdapter implements AiPlanningPort {
  // TODO(gemini): 6-month weather-to-cultivation
  async generate(): Promise<PlanResult> {
    await delay(500);
    return {
      months: [
        { monthBn: 'শ্রাবণ', weatherIcon: 'rainy-outline', recommendedCropBn: 'আমন ধান' },
        { monthBn: 'ভাদ্র', weatherIcon: 'rainy-outline', recommendedCropBn: 'আমন ধান' },
        { monthBn: 'আশ্বিন', weatherIcon: 'partly-sunny-outline', recommendedCropBn: 'শাকসবজি' },
        { monthBn: 'কার্তিক', weatherIcon: 'sunny-outline', recommendedCropBn: 'আলু' },
        { monthBn: 'অগ্রহায়ণ', weatherIcon: 'sunny-outline', recommendedCropBn: 'আলু' },
        { monthBn: 'পৌষ', weatherIcon: 'cloudy-outline', recommendedCropBn: 'সরিষা' },
      ],
      recommendationBn:
        'আগামী ছয় মাসের আবহাওয়া পূর্বাভাস অনুযায়ী শ্রাবণ ও ভাদ্র মাসে পর্যাপ্ত বৃষ্টিপাত হবে, যা আমন ধান চাষের জন্য উপযুক্ত সময়। আশ্বিনের পর বৃষ্টি কমে আসবে বলে এই সময় শাকসবজি চাষ শুরু করা যেতে পারে। শীত মৌসুমে (কার্তিক–অগ্রহায়ণ) শুষ্ক ও ঠান্ডা আবহাওয়া আলু চাষের জন্য আদর্শ, তাই এই সময় আলু রোপণের পরিকল্পনা করুন। সবশেষে পৌষ মাসে সরিষা চাষ করে জমির সর্বোচ্চ ব্যবহার নিশ্চিত করা সম্ভব।',
    };
  }
}

@Injectable()
export class MockWeatherAdapter implements WeatherPort {
  // TODO(weather-api): live forecast
  async sprayAdvisory() {
    return {
      level: 'caution' as const,
      reasonBn: 'আজ বিকেলে হালকা বৃষ্টির সম্ভাবনা আছে, সকালে স্প্রে করুন।',
    };
  }
  async summaryBn() {
    return 'স্বাভাবিক বৃষ্টিপাত প্রত্যাশিত';
  }
}

@Injectable()
export class MockCostAdapter implements CostEstimatePort {
  estimate(landSize: number, landUnit: 'bigha' | 'acre') {
    const COST_PER_BIGHA_BDT = 220;
    const BIGHA_PER_ACRE = 3;
    const PESTICIDE_ML_PER_BIGHA = 50;
    const bigha = landUnit === 'acre' ? landSize * BIGHA_PER_ACRE : landSize;
    const spraySessions = bigha > 5 ? 3 : bigha > 2 ? 2 : 1;
    return {
      pesticideQuantity: `${Math.round(bigha * PESTICIDE_ML_PER_BIGHA)} মিলি`,
      totalCostBdt: Math.round(bigha * COST_PER_BIGHA_BDT * spraySessions),
      spraySessions,
    };
  }
}

@Injectable()
export class MockTtsAdapter implements TtsPort {
  // TODO(tts-provider): Bangla neural TTS
  async synthesize(_textBn: string): Promise<Buffer> {
    return silenceWav(0.4);
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
