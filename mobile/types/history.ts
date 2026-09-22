import type { LoanStatus } from "@/components/ui";
import type { SeverityLevel } from "./diagnosis";

export type HistoryEntryKind = "disease" | "yield" | "loan";

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

export type YieldTrend = "up" | "down" | "flat";

export type YieldHistoryEntry = HistoryEntryBase & {
  kind: "yield";
  cropNameBn: string;
  yieldValue: number;
  yieldUnitBn: string;
  /** Relative to the prior yield entry for the same crop. */
  trend: YieldTrend;
};

export type LoanHistoryEntry = HistoryEntryBase & {
  kind: "loan";
  title: string;
  amount: string;
  status: LoanStatus;
  nextPaymentDate?: string;
};

export type HistoryEntry =
  | DiseaseHistoryEntry
  | YieldHistoryEntry
  | LoanHistoryEntry;
