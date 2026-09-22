import type { CropSuitability, SoilReading } from "./types";

type CropRule = {
  cropSlug: string;
  nameBn: string;
  nameEn: string;
  ph: [number, number];
  moisture: [number, number];
  /** Prefer moderate-high N for leafy; lower for legumes etc. */
  preferN?: "low" | "mid" | "high";
};

const CROPS: CropRule[] = [
  {
    cropSlug: "rice",
    nameBn: "ধান",
    nameEn: "Rice",
    ph: [5.5, 7.0],
    moisture: [60, 90],
    preferN: "high",
  },
  {
    cropSlug: "potato",
    nameBn: "আলু",
    nameEn: "Potato",
    ph: [5.0, 6.5],
    moisture: [40, 70],
    preferN: "mid",
  },
  {
    cropSlug: "tomato",
    nameBn: "টমেটো",
    nameEn: "Tomato",
    ph: [6.0, 7.0],
    moisture: [45, 70],
    preferN: "mid",
  },
  {
    cropSlug: "vegetable",
    nameBn: "সবজি",
    nameEn: "Vegetables",
    ph: [5.8, 7.2],
    moisture: [40, 75],
    preferN: "mid",
  },
  {
    cropSlug: "wheat",
    nameBn: "গম",
    nameEn: "Wheat",
    ph: [6.0, 7.5],
    moisture: [35, 65],
    preferN: "mid",
  },
  {
    cropSlug: "jute",
    nameBn: "পাট",
    nameEn: "Jute",
    ph: [6.0, 7.5],
    moisture: [50, 80],
    preferN: "high",
  },
  {
    cropSlug: "maize",
    nameBn: "ভুট্টা",
    nameEn: "Maize",
    ph: [5.5, 7.5],
    moisture: [40, 70],
    preferN: "high",
  },
  {
    cropSlug: "onion",
    nameBn: "পেঁয়াজ",
    nameEn: "Onion",
    ph: [6.0, 7.0],
    moisture: [40, 65],
    preferN: "low",
  },
];

function inRange(v: number, lo: number, hi: number): boolean {
  return v >= lo && v <= hi;
}

function fitFromScore(score: number): CropSuitability["fit"] {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  return "poor";
}

/**
 * Local rule engine — works offline. Hardware test can verify UI without Gemini.
 */
export function recommendCropsFromSoil(reading: SoilReading): CropSuitability[] {
  const results: CropSuitability[] = CROPS.map((crop) => {
    const reasonsBn: string[] = [];
    let score = 50;

    if (inRange(reading.ph, crop.ph[0], crop.ph[1])) {
      score += 20;
      reasonsBn.push(`pH ${reading.ph.toFixed(1)} এই ফসলের জন্য উপযোগী`);
    } else {
      score -= 15;
      reasonsBn.push(
        `pH ${reading.ph.toFixed(1)} — আদর্শ ${crop.ph[0]}–${crop.ph[1]}`,
      );
    }

    if (inRange(reading.moisturePct, crop.moisture[0], crop.moisture[1])) {
      score += 15;
      reasonsBn.push(`আর্দ্রতা ${Math.round(reading.moisturePct)}% ভালো`);
    } else {
      score -= 12;
      reasonsBn.push(
        `আর্দ্রতা ${Math.round(reading.moisturePct)}% — চাই ${crop.moisture[0]}–${crop.moisture[1]}%`,
      );
    }

    const n = reading.nitrogenPpm;
    if (crop.preferN === "high") {
      if (n >= 40) {
        score += 10;
        reasonsBn.push("নাইট্রোজেন পর্যাপ্ত");
      } else {
        score -= 8;
        reasonsBn.push("নাইট্রোজেন কম — সার লাগতে পারে");
      }
    } else if (crop.preferN === "low") {
      if (n <= 50) {
        score += 8;
      } else {
        score -= 5;
        reasonsBn.push("নাইট্রোজেন বেশি — পাতা বেশি হতে পারে");
      }
    } else if (n >= 20 && n <= 80) {
      score += 8;
      reasonsBn.push("নাইট্রোজেন মাঝারি ভালো");
    }

    if (reading.ecMsCm > 4) {
      score -= 10;
      reasonsBn.push("লবণাক্ততা (EC) বেশি — সাবধান");
    } else if (reading.ecMsCm <= 2.5) {
      score += 5;
    }

    if (reading.temperatureC < 10 || reading.temperatureC > 40) {
      score -= 8;
      reasonsBn.push(`মাটির তাপমাত্রা ${reading.temperatureC.toFixed(0)}°C চরম`);
    }

    score = Math.max(0, Math.min(100, score));
    return {
      cropSlug: crop.cropSlug,
      nameBn: crop.nameBn,
      nameEn: crop.nameEn,
      score,
      fit: fitFromScore(score),
      reasonsBn,
    };
  });

  return results.sort((a, b) => b.score - a.score);
}
