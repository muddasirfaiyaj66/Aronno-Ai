export type CookieRecord = {
  name: string;
  value: string;
  expires?: number;
};

export function splitCombinedSetCookie(raw: string): string[] {
  // Expires dates contain commas (Wed, 07 Oct ...). Only split before the next cookie name.
  return raw.split(/,(?=\s*[A-Za-z_][A-Za-z0-9_]*=)/);
}

export function parseSetCookie(header: string): CookieRecord | null {
  const parts = header.split(";").map((p) => p.trim());
  const [nv] = parts;
  const eq = nv.indexOf("=");
  if (eq < 1) return null;
  const name = nv.slice(0, eq).trim();
  const value = nv.slice(eq + 1).trim();
  let expires: number | undefined;
  for (const part of parts.slice(1)) {
    const [k, v] = part.split("=");
    if (!k) continue;
    if (k.toLowerCase() === "max-age" && v) {
      const seconds = Number(v);
      if (Number.isFinite(seconds)) expires = Date.now() + seconds * 1000;
    }
    if (k.toLowerCase() === "expires" && v) {
      const parsed = Date.parse(v);
      if (!Number.isNaN(parsed)) expires = parsed;
    }
  }
  return { name, value, expires };
}
