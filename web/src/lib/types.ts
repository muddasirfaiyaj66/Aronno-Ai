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
  specialistApproved?: boolean;
  specialistReviewStatus?: "none" | "pending" | "approved" | "rejected";
  specialistCertificateUrl?: string | null;
  specialistNidUrl?: string | null;
  specialistReviewNote?: string | null;
  specialistSubmittedAt?: string | null;
};

export type ApiErrorBody = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

export type ApiSuccess<T> = { success: true; data: T };

export function isStaff(role?: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}
