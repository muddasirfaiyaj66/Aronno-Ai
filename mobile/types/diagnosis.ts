import type { SeverityLevel } from "@/components/ui";

export type { SeverityLevel };

export type DiagnosisResult = {
  diseaseNameBn: string;
  diseaseNameEn: string;
  /** 0-100 */
  confidence: number;
  severity: SeverityLevel;
  imageUrl: string;
};
