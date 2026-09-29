import { getCookieHeader } from "@/services/cookieJar";

export const CALL_URL = (process.env.EXPO_PUBLIC_CALL_URL ?? "").replace(/\/$/, "");

export type JoinCallResult = {
  token: string;
  url: string;
  video: { width: number; height: number; maxBitrate: number };
};

async function post(path: string) {
  if (!CALL_URL) throw new Error("ভিডিও সেবা এখনো চালু হয়নি।");
  const cookie = await getCookieHeader();
  const res = await fetch(`${CALL_URL}${path}`, {
    method: "POST",
    headers: cookie ? { Cookie: cookie } : {},
  });
  if (!res.ok) throw new Error("ভিডিও সেবা সাড়া দেয়নি।");
  return res.json() as Promise<JoinCallResult>;
}

export function joinCall(consultId: string) {
  return post(`/v1/rooms/${consultId}/join`);
}

export function leaveCall(consultId: string) {
  return post(`/v1/rooms/${consultId}/leave`).catch(() => undefined);
}
