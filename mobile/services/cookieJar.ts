import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const STORE_KEY = "aronno.cookie-jar";

type CookieRecord = {
  name: string;
  value: string;
  expires?: number;
};

let memory: CookieRecord[] = [];

async function load(): Promise<CookieRecord[]> {
  if (Platform.OS === "web") return memory;
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    memory = raw ? (JSON.parse(raw) as CookieRecord[]) : [];
  } catch {
    memory = [];
  }
  return memory;
}

async function persist(next: CookieRecord[]) {
  memory = next;
  if (Platform.OS === "web") return;
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(next));
}

function parseSetCookie(header: string): CookieRecord | null {
  const parts = header.split(";").map((p) => p.trim());
  const [nv] = parts;
  const eq = nv.indexOf("=");
  if (eq < 1) return null;
  const name = nv.slice(0, eq).trim();
  const value = nv.slice(eq + 1).trim();
  let expires: number | undefined;
  for (const part of parts.slice(1)) {
    const [k, v] = part.split("=");
    if (k.toLowerCase() === "max-age" && v) {
      expires = Date.now() + Number(v) * 1000;
    }
    if (k.toLowerCase() === "expires" && v) {
      expires = Date.parse(v);
    }
  }
  return { name, value, expires };
}

function collectSetCookie(res: Response): string[] {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const raw = res.headers.get("set-cookie");
  if (!raw) return [];
  return raw.split(/,(?=\s*[^;=]+=)/);
}

export async function ingestCookies(res: Response) {
  if (Platform.OS === "web") return;
  const headers = collectSetCookie(res);
  if (!headers.length) return;
  const current = await load();
  const byName = new Map(current.map((c) => [c.name, c]));
  for (const h of headers) {
    const parsed = parseSetCookie(h);
    if (!parsed) continue;
    byName.set(parsed.name, parsed);
  }
  await persist([...byName.values()]);
}

export async function getCookieHeader(): Promise<string> {
  if (Platform.OS === "web") return "";
  const now = Date.now();
  const current = (await load()).filter((c) => !c.expires || c.expires > now);
  if (current.length !== memory.length) await persist(current);
  return current.map((c) => `${c.name}=${c.value}`).join("; ");
}

export async function getCookie(name: string): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof document === "undefined") return null;
    const match = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
  }
  const current = await load();
  const found = current.find((c) => c.name === name);
  if (!found) return null;
  if (found.expires && found.expires < Date.now()) return null;
  return found.value;
}

export async function clearCookies() {
  memory = [];
  if (Platform.OS === "web") return;
  await SecureStore.deleteItemAsync(STORE_KEY);
}
