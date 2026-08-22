/** Strip control chars (Android oneTimeCode autofill can inject \\u0000). */
export function sanitizeOtpInput(text: string): string {
  return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").slice(0, 6);
}
