export type UserRole = "SUPERADMIN" | "ADMIN" | "USER";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  emailVerifiedAt: string | null;
  createdAt?: string;
  role: { slug: UserRole; nameBn: string; nameEn: string };
  profession: { slug: string; nameBn: string; nameEn: string } | null;
  district: { slug: string; nameBn: string } | null;
};

export type LoanStatus = "pending" | "approved" | "repaying" | "rejected";

export type AdminLoan = {
  id: string;
  amountBdt: number;
  status: LoanStatus;
  repaymentPeriod: "THREE_MONTHS" | "SIX_MONTHS" | "TWELVE_MONTHS";
  nextPaymentDue: string | null;
  createdAt: string;
  purpose: { id: string; nameBn: string };
  user: { id: string; displayName: string; email: string };
};

export type ApiErrorBody = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

export type ApiSuccess<T> = { success: true; data: T };

export function isStaff(role?: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export const LOAN_STATUS_BN: Record<LoanStatus, string> = {
  pending: "অপেক্ষমাণ",
  approved: "অনুমোদিত",
  repaying: "পরিশোধ চলছে",
  rejected: "প্রত্যাখ্যাত",
};
