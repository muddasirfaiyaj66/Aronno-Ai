import type { ZodError } from 'zod';

/** First / joined Bangla messages from Zod issues (never English defaults). */
export function messageFromZodError(error: ZodError): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const issue of error.issues) {
    const msg = issue.message?.trim();
    if (!msg || seen.has(msg)) continue;
    // Skip raw Zod English defaults if any slip through
    if (/^(Required|Invalid|Expected|Too small|Too big)/i.test(msg)) continue;
    seen.add(msg);
    parts.push(msg);
  }
  if (parts.length === 0) return 'অবৈধ তথ্য দেওয়া হয়েছে।';
  // Password often fails several rules at once — show all
  return parts.join(' ');
}
