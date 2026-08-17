import type { LoanStatus } from "@/components/ui";

export type LoanPurpose = "seed" | "fertilizer" | "equipment" | "other";
export type RepaymentPeriod = "3m" | "6m" | "12m";

export const LOAN_PURPOSE_LABELS: Record<LoanPurpose, string> = {
  seed: "বীজ",
  fertilizer: "সার",
  equipment: "যন্ত্র",
  other: "অন্যান্য",
};

export const REPAYMENT_PERIOD_LABELS: Record<RepaymentPeriod, string> = {
  "3m": "৩ মাস",
  "6m": "৬ মাস",
  "12m": "১২ মাস",
};

export type LoanApplication = {
  id: string;
  amountBdt: number;
  amountBn: string;
  purpose: LoanPurpose;
  repaymentPeriod: RepaymentPeriod;
  status: LoanStatus;
  submittedDateBn: string;
  nextPaymentDateBn?: string;
};

// TODO(nestjs): replace with a real GET /loan/current call once the
// backend is wired — a new farmer with no loan history yet would get
// `null` back, which is why the type below is nullable even though the
// mock value is always present.
export const MOCK_LOAN_APPLICATION: LoanApplication | null = {
  id: "loan-1",
  amountBdt: 50000,
  amountBn: "৳ ৫০,০০০",
  purpose: "fertilizer",
  repaymentPeriod: "6m",
  status: "repaying",
  submittedDateBn: "১০ আগস্ট, ২০২৬",
  nextPaymentDateBn: "১৫ সেপ্টেম্বর, ২০২৬",
};

/**
 * Confirms LoanApplication is shape-compatible with History's
 * LoanHistoryEntry ({ title, amount, status, nextPaymentDate }) — used by
 * the extended CropHealthHistoryScreen timeline from Sprint 3. Not wired
 * into MOCK_HISTORY_ENTRIES yet; that's live-data wiring, out of scope
 * here.
 */
export function toLoanHistoryFields(application: LoanApplication) {
  return {
    title: `কৃষি ঋণ — ${LOAN_PURPOSE_LABELS[application.purpose]}`,
    amount: application.amountBn,
    status: application.status,
    nextPaymentDate: application.nextPaymentDateBn,
  };
}
