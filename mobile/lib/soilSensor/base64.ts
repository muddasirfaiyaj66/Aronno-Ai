/** Tiny base64 helpers — avoid Node Buffer in React Native. */
const CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function utf8ToBase64(text: string): string {
  const bytes = Array.from(text).map((c) => c.charCodeAt(0) & 0xff);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const bitmap = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += CHARS.charAt((bitmap >> 18) & 63);
    out += CHARS.charAt((bitmap >> 12) & 63);
    out += b === undefined ? "=" : CHARS.charAt((bitmap >> 6) & 63);
    out += c === undefined ? "=" : CHARS.charAt(bitmap & 63);
  }
  return out;
}

export function base64ToUtf8(b64: string): string {
  const str = b64.replace(/[^A-Za-z0-9+/=]/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i += 4) {
    const enc1 = CHARS.indexOf(str.charAt(i));
    const enc2 = CHARS.indexOf(str.charAt(i + 1));
    const enc3 = CHARS.indexOf(str.charAt(i + 2));
    const enc4 = CHARS.indexOf(str.charAt(i + 3));
    const bitmap = (enc1 << 18) | (enc2 << 12) | ((enc3 & 63) << 6) | (enc4 & 63);
    bytes.push((bitmap >> 16) & 255);
    if (str.charAt(i + 2) !== "=") bytes.push((bitmap >> 8) & 255);
    if (str.charAt(i + 3) !== "=") bytes.push(bitmap & 255);
  }
  return String.fromCharCode(...bytes);
}
