/**
 * Client-side auth field checks — same rules as backend passwordSchema.
 * Returns Bangla messages so the UI can show them before/without the API.
 */

const BN_DIGIT: Record<string, string> = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
};

export const BD_PHONE_MSG =
  "বাংলাদেশের মোবাইল নম্বর ১১ সংখ্যার হতে হবে (যেমন: 01712345678)।";

/** Local BD mobile: 01[3-9]xxxxxxxx — also folds +880/880 and Bangla digits. */
export function normalizeBdMobile(raw: string): string {
  let s = raw.trim();
  s = [...s].map((ch) => BN_DIGIT[ch] ?? ch).join("");
  s = s.replace(/[\s\-()]/g, "");
  if (s.startsWith("+880")) s = `0${s.slice(4)}`;
  else if (s.startsWith("880")) s = `0${s.slice(3)}`;
  return s;
}

export function isBdMobile(normalized: string): boolean {
  return /^01[3-9]\d{8}$/.test(normalized);
}

/**
 * Empty phone is allowed (optional). Non-empty must be valid BD mobile.
 * Returns `{ ok, value, message }` — value is normalized 01xxxxxxxxx when ok.
 */
export function validateBdPhoneBn(phone: string): {
  ok: boolean;
  value?: string;
  message?: string;
} {
  const trimmed = phone.trim();
  if (!trimmed) return { ok: true, value: undefined };
  const normalized = normalizeBdMobile(trimmed);
  if (!isBdMobile(normalized)) {
    return { ok: false, message: BD_PHONE_MSG };
  }
  return { ok: true, value: normalized };
}

export function validateEmailBn(email: string): string | null {
  const t = email.trim();
  if (!t) return "ইমেইল দিন।";
  // Practical email shape (not full RFC)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
    return "ইমেইল ঠিকানা সঠিক নয়। উদাহরণ: nam@example.com";
  }
  return null;
}

export function validatePasswordBn(password: string): string | null {
  const fails: string[] = [];
  if (!password) return "পাসওয়ার্ড দিন।";
  if (password.length < 10) {
    fails.push("পাসওয়ার্ড অন্তত ১০ অক্ষরের হতে হবে।");
  }
  if (!/[A-Z]/.test(password)) {
    fails.push("পাসওয়ার্ডে অন্তত একটি বড় হাতের অক্ষর (A–Z) থাকতে হবে।");
  }
  if (!/[a-z]/.test(password)) {
    fails.push("পাসওয়ার্ডে অন্তত একটি ছোট হাতের অক্ষর (a–z) থাকতে হবে।");
  }
  if (!/[0-9]/.test(password)) {
    fails.push("পাসওয়ার্ডে অন্তত একটি সংখ্যা থাকতে হবে।");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    fails.push("পাসওয়ার্ডে অন্তত একটি বিশেষ চিহ্ন (! @ # $ ইত্যাদি) থাকতে হবে।");
  }
  return fails.length ? fails.join(" ") : null;
}

export function validateDisplayNameBn(name: string): string | null {
  const t = name.trim();
  if (t.length < 2) return "নাম অন্তত ২ অক্ষরের হতে হবে।";
  if (t.length > 80) return "নাম খুব বড়। সর্বোচ্চ ৮০ অক্ষর দিন।";
  return null;
}

export function validateOtpBn(code: string): string | null {
  const digits = code.replace(/\D/g, "");
  if (digits.length !== 6) return "৬ সংখ্যার কোড দিন।";
  return null;
}

/** First failing field message for register form. */
export function validateRegisterBn(input: {
  email: string;
  password: string;
  displayName: string;
}): string | null {
  return (
    validateDisplayNameBn(input.displayName) ??
    validateEmailBn(input.email) ??
    validatePasswordBn(input.password)
  );
}

/** First failing field message for reset-password form. */
export function validateResetPasswordBn(input: {
  email: string;
  code: string;
  password: string;
}): string | null {
  return (
    validateEmailBn(input.email) ??
    validateOtpBn(input.code) ??
    validatePasswordBn(input.password)
  );
}
