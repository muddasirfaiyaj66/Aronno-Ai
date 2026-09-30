import { getCookieHeader } from "@/services/cookieJar";

export const CALL_URL = (process.env.EXPO_PUBLIC_CALL_URL ?? "").replace(/\/$/, "");

export type JoinCallResult = {
  token: string;
  url: string;
  video: { width: number; height: number; maxBitrate: number };
};

function joinFailureMessage(status: number, raw: string) {
  if (/not configured/i.test(raw)) return "ভিডিও সেবা এখনো চালু হয়নি।";
  if (status === 401 || status === 403) return "ভিডিও সেবা কলটি যাচাই করতে পারেনি।";
  if (/room is not open/i.test(raw)) return "ভিডিও রুম খোলা হয়নি।";
  if (status >= 500) return "ভিডিও সেবা সাড়া দেয়নি।";
  return "এই কলে যোগ দেওয়া যায়নি।";
}

async function post(path: string) {
  if (!CALL_URL) throw new Error("ভিডিও সেবা এখনো চালু হয়নি।");
  const cookie = await getCookieHeader();
  let res: Response;
  try {
    res = await fetch(`${CALL_URL}${path}`, {
      method: "POST",
      headers: cookie ? { Cookie: cookie } : {},
    });
  } catch {
    throw new Error("ভিডিও সেবা সাড়া দেয়নি।");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const raw = Array.isArray(body?.message) ? body.message.join(" ") : (body?.message ?? "");
    throw new Error(joinFailureMessage(res.status, raw));
  }
  return res.json() as Promise<JoinCallResult>;
}

export function joinCall(consultId: string) {
  return post(`/v1/rooms/${consultId}/join`);
}

export function leaveCall(consultId: string) {
  return post(`/v1/rooms/${consultId}/leave`).catch(() => undefined);
}
