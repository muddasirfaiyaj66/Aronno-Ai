/**
 * Bangladesh local mobile: 11 digits with leading 0, e.g. 01712345678.
 * Also accepts +880 / 880 and normalizes to local 01xxxxxxxxx.
 */

const BN_DIGIT: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

export const BD_PHONE_MSG =
  'বাংলাদেশের মোবাইল নম্বর ১১ সংখ্যার হতে হবে (যেমন: 01712345678)।';

/** Strip spaces/dashes, map Bangla digits → ASCII, fold +880/880 → 0. */
export function normalizeBdMobile(raw: string): string {
  let s = raw.trim();
  s = [...s].map((ch) => BN_DIGIT[ch] ?? ch).join('');
  s = s.replace(/[\s\-()]/g, '');
  if (s.startsWith('+880')) s = `0${s.slice(4)}`;
  else if (s.startsWith('880')) s = `0${s.slice(3)}`;
  return s;
}

/** True for 01[3-9] + 8 digits (Grameen/Robi/Banglalink/Teletalk/etc.). */
export function isBdMobile(normalized: string): boolean {
  return /^01[3-9]\d{8}$/.test(normalized);
}
