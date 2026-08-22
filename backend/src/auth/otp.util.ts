const UNICODE_ZERO_POINTS = [
  0x0030, // ASCII
  0x0660, // Arabic-Indic
  0x06f0, // Extended Arabic-Indic
  0x0966, // Devanagari
  0x09e6, // Bengali
  0x0ae6, // Gujarati
  0x0be6, // Tamil
];

function toAsciiDigit(char: string): string | null {
  const code = char.codePointAt(0);
  if (code == null) return null;
  for (const zero of UNICODE_ZERO_POINTS) {
    const digit = code - zero;
    if (digit >= 0 && digit <= 9) return String(digit);
  }
  return null;
}

export function normalizeOtpCode(code: string): string {
  return [...code].map((char) => toAsciiDigit(char) ?? '').join('');
}
