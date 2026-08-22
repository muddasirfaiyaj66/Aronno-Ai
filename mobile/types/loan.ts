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

export function toLoanHistoryFields(application: LoanApplication) {
  return {
    title: `কৃষি ঋণ — ${LOAN_PURPOSE_LABELS[application.purpose]}`,
    amount: application.amountBn,
    status: application.status,
    nextPaymentDate: application.nextPaymentDateBn,
  };
}
