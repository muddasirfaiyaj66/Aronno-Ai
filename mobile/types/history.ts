import type { SeverityLevel } from "./diagnosis";

export type HistoryEntryKind = "disease";

type HistoryEntryBase = {
  id: string;
  /** ISO date (YYYY-MM-DD), used for sorting. */
  date: string;
  dateBn: string;
};

export type DiseaseHistoryEntry = HistoryEntryBase & {
  kind: "disease";
  cropNameBn: string;
  diseaseNameBn: string;
  diseaseNameEn: string;
  severity: SeverityLevel;
  confidence: number;
  imageUrl: string;
  /** Server diagnosis id when known (history event sourceId). */
  sourceId?: string;
};

export type HistoryEntry = DiseaseHistoryEntry;
