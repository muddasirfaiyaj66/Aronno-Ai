/**
 * Offline treatment plan built from bn_knowledge_base when the API is unavailable.
 */
import type { TreatmentPlan } from "@/types/treatment";
import type { SeverityLevel } from "@/types/diagnosis";
import {
  findDiseaseByName,
  type KbDisease,
} from "@/lib/offlineNlu/knowledgeBase";

const DANDA = "\u0964"; // Bengali danda ।

function cropFromDisease(d: KbDisease): string {
  const id = d.id.toLowerCase();
  if (id.includes("tomato")) return "টমেটো";
  if (id.includes("potato")) return "আলু";
  if (id.includes("pepper") || id.includes("bell")) return "মরিচ";
  return "ফসল";
}

function stepsFromText(treatmentBn: string): TreatmentPlan["steps"] {
  const parts = treatmentBn
    .split(new RegExp(`[;${DANDA}]`))
    .map((s) => s.trim())
    .filter((s) => s.length > 4);
  const list = parts.length ? parts : [treatmentBn];
  return list.slice(0, 5).map((instructionBn, i) => ({
    step: i + 1,
    instructionBn: instructionBn.endsWith(DANDA)
      ? instructionBn
      : `${instructionBn}${DANDA}`,
  }));
}

export function buildOfflineTreatmentPlan(
  diseaseNameBn?: string | null,
  diseaseNameEn?: string | null,
  severity: SeverityLevel = "medium",
): TreatmentPlan | null {
  const d = findDiseaseByName(diseaseNameBn, diseaseNameEn);
  if (!d) return null;

  const wait =
    severity === "high" || d.severity === "high"
      ? {
          level: "caution" as const,
          reasonBn:
            "রোগের তীব্রতা বেশি — আজকের আবহাওয়া দেখে স্প্রে করুন; ভারী বৃষ্টিতে অপেক্ষা করুন।",
        }
      : {
          level: "safe" as const,
          reasonBn: "নিয়মিত পর্যবেক্ষণ রাখুন; ভেজা পাতায় স্প্রে এড়িয়ে চলুন।",
        };

  return {
    id: `offline-${d.id}`,
    cropNameBn: cropFromDisease(d),
    diseaseNameBn: d.diseaseNameBn,
    pesticideNameBn: "কৃষি সম্প্রসারণ অফিসের নির্দেশিত ছত্রাকনাশক/ব্যাকটেরিসাইড",
    dosagePerBigha: "লেবেল অনুযায়ী নির্দেশিত মাত্রা",
    steps: stepsFromText(d.treatmentBn),
    safetyChecklist: [
      { id: "mask", labelBn: "মাস্ক ও হাতমোজা পরুন" },
      { id: "wind", labelBn: "বাতাসের দিকে স্প্রে করবেন না" },
      { id: "wash", labelBn: "কাজ শেষে হাত-মুখ ধুয়ে নিন" },
      { id: "kids", labelBn: "শিশু ও গবাদি পশু দূরে রাখুন" },
    ],
    followUpLabelBn: "৭ দিন পর আবার পাতা পরীক্ষা করুন",
    weatherAdvisory: wait,
  };
}

export function adviceFromKb(
  diseaseNameBn?: string | null,
  diseaseNameEn?: string | null,
): {
  symptomsBn: string;
  treatmentBn: string;
  preventionBn: string;
  listenBn: string;
} | null {
  const d = findDiseaseByName(diseaseNameBn, diseaseNameEn);
  if (!d) return null;
  return {
    symptomsBn: d.symptomsBn,
    treatmentBn: d.treatmentBn,
    preventionBn: d.preventionBn,
    listenBn: `${d.diseaseNameBn}${DANDA} লক্ষণ: ${d.symptomsBn}${DANDA} চিকিৎসা: ${d.treatmentBn}${DANDA} প্রতিরোধ: ${d.preventionBn}`,
  };
}
