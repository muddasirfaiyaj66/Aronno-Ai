import { File } from "expo-file-system";

export async function readFileBase64(uri: string): Promise<string> {
  try {
    return await new File(uri).base64();
  } catch {
    const res = await fetch(uri);
    if (!res.ok) throw new Error("file-read-failed");
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }
}

export function mimeFromAudioUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".webm")) return "audio/webm";
  if (lower.endsWith(".3gp")) return "audio/3gpp";
  if (lower.endsWith(".caf")) return "audio/x-caf";
  return "audio/mp4";
}
