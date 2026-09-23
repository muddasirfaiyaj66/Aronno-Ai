const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** "১২.৫" → "12.5" — Bangla keyboards type Bangla digits. */
export function bnDigitsToAscii(text: string) {
  return text.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

/**
 * Number from user input in either script: "২", "1.5", "১,২০০", "৳ 850".
 * Returns NaN when there is no number.
 */
export function parseNumberInput(text: string): number {
  const ascii = bnDigitsToAscii(text).replace(/,/g, "");
  const match = ascii.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

/** 3200 → "৩,২০০" */
export function formatTakaBn(amount: number) {
  return new Intl.NumberFormat("bn-BD").format(Math.round(amount));
}
