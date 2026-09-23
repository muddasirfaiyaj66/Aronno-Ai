const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** "৳ ১,২০০" → "৳ 1,200". Leaves every other character untouched. */
export function bnDigitsToAscii(text: string): string {
  return text.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

/** 1200 → "১২০০" */
export function asciiDigitsToBn(text: string | number): string {
  return String(text).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

/**
 * Taka amount from free text in either script: "৳ ১,২০০/-" → 1200,
 * "Tk 850.50" → 850.5. Returns 0 when no number is present.
 */
export function parseTaka(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const ascii = bnDigitsToAscii(value).replace(/,/g, '');
  const match = ascii.match(/\d+(?:\.\d+)?/);
  if (!match) return 0;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : 0;
}

/** 3200 → "৩,২০০" */
export function formatTakaBn(amount: number): string {
  return new Intl.NumberFormat('bn-BD').format(Math.round(amount));
}
