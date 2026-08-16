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

// TODO(nestjs): replace with a real GET /history call once the backend is
// wired. Kept here (rather than a colocated file under app/) because Expo
// Router scans every .ts/.tsx file under app/ as a route candidate — even
// underscore-prefixed ones — so non-route helpers must live outside it.
export const MOCK_HISTORY_ENTRIES: HistoryEntry[] = [
  {
    kind: "loan",
    id: "loan-1",
    date: "2026-08-10",
    dateBn: "১০ আগস্ট, ২০২৬",
    title: "কৃষি ঋণ",
    amount: "৳ ৫০,০০০",
    status: "repaying",
    nextPaymentDate: "১৫ সেপ্টেম্বর, ২০২৬",
  },
  {
    kind: "yield",
    id: "yield-2",
    date: "2026-08-05",
    dateBn: "৫ আগস্ট, ২০২৬",
    cropNameBn: "ধান",
    yieldValue: 4.2,
    yieldUnitBn: "টন/একর",
    trend: "up",
  },
  {
    kind: "disease",
    id: "disease-5",
    date: "2026-08-02",
    dateBn: "২ আগস্ট, ২০২৬",
    cropNameBn: "টমেটো",
    diseaseNameBn: "পাতা ঝলসানো রোগ",
    diseaseNameEn: "Leaf Blight",
    severity: "high",
    confidence: 74,
    imageUrl: "",
  },
  {
    kind: "disease",
    id: "disease-4",
    date: "2026-07-28",
    dateBn: "২৮ জুলাই, ২০২৬",
    cropNameBn: "ধান",
    diseaseNameBn: "বাদামি দাগ রোগ",
    diseaseNameEn: "Brown Spot Disease",
    severity: "medium",
    confidence: 87,
    imageUrl: "",
  },
  {
    kind: "yield",
    id: "yield-1",
    date: "2026-07-20",
    dateBn: "২০ জুলাই, ২০২৬",
    cropNameBn: "ধান",
    yieldValue: 3.8,
    yieldUnitBn: "টন/একর",
    trend: "flat",
  },
  {
    kind: "disease",
    id: "disease-3",
    date: "2026-07-15",
    dateBn: "১৫ জুলাই, ২০২৬",
    cropNameBn: "টমেটো",
    diseaseNameBn: "সুস্থ পাতা",
    diseaseNameEn: "Healthy Leaf",
    severity: "low",
    confidence: 95,
    imageUrl: "",
  },
  {
    kind: "disease",
    id: "disease-2",
    date: "2026-07-10",
    dateBn: "১০ জুলাই, ২০২৬",
    cropNameBn: "ধান",
    diseaseNameBn: "পাতা ঝলসানো রোগ",
    diseaseNameEn: "Leaf Blight",
    severity: "high",
    confidence: 81,
    imageUrl: "",
  },
  {
    kind: "disease",
    id: "disease-1",
    date: "2026-07-01",
    dateBn: "১ জুলাই, ২০২৬",
    cropNameBn: "টমেটো",
    diseaseNameBn: "বাদামি দাগ রোগ",
    diseaseNameEn: "Brown Spot Disease",
    severity: "medium",
    confidence: 78,
    imageUrl: "",
  },
];

export function getHistoryEntryById(id: string) {
  return MOCK_HISTORY_ENTRIES.find((entry) => entry.id === id);
}
