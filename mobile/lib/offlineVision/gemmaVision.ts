/**
 * Offline Gemma receipt reader. Disease and tool photos go through the backend Gemini API.
 * Requires a multimodal catalog entry (GGUF + mmproj) loaded via llmEngine.
 */
import {
  completeLlmVision,
  isVisionLlmReady,
  autoLoadLlm,
  hasInstalledVisionLlm,
} from "@/lib/modelManager/llmEngine";
import { catalogById, isMultimodalCatalogEntry } from "@/lib/modelManager/catalog";
import { listInstalled } from "@/lib/modelManager/modelManager";
import type { ReceiptItem, ReceiptSummary } from "@/types/receipt";
import { markStart } from "@/lib/offline/metrics";
import { newLocalId } from "@/lib/offlineDb/db";
import { formatTakaBn, parseNumberInput } from "@/utils/number";

async function ensureVisionReady(): Promise<boolean> {
  if (isVisionLlmReady()) return true;
  if (!(await hasInstalledVisionLlm())) return false;
  const installed = await listInstalled();
  const vision =
    installed.find((e) => e.kind === "llm" && isMultimodalCatalogEntry(e)) ??
    catalogById("gemma3-4b-it-q4");
  if (!vision) return false;
  await autoLoadLlm(vision.id);
  return isVisionLlmReady();
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Read a Bangla shop receipt photo offline with Gemma vision.
 */
export async function scanReceiptWithGemma(
  imageUri: string,
): Promise<ReceiptSummary | null> {
  const end = markStart("vision.gemma.receipt");
  if (!(await ensureVisionReady())) {
    end("not-ready");
    return null;
  }

  const prompt = [
    "You are Aronno. Read this Bangla/English shop receipt photo line by line.",
    "Bangla digits: ০=0 ১=1 ২=2 ৩=3 ৪=4 ৫=5 ৬=6 ৭=7 ৮=8 ৯=9. ৪ is FOUR (not 8), ৭ is SEVEN (not 9).",
    "Extract each purchased item and the grand total in Bangladeshi Taka. Ignore phone numbers, dates and memo numbers.",
    'Reply ONLY JSON: {"totalBdt":number,"summaryBn":"বাংলায় এক বাক্য সারাংশ","items":[{"nameBn":"...","quantity":"...","priceBdt":number}]}',
    "totalBdt and priceBdt use ASCII digits. If an amount is unreadable use 0 — never guess.",
    "If unreadable, reply {\"totalBdt\":0,\"summaryBn\":\"রসিদ পড়া যায়নি।\",\"items\":[]}",
  ].join("\n");

  try {
    const raw = await completeLlmVision(prompt, imageUri);
    const json = extractJsonObject(raw);
    if (!json) {
      end("parse-fail");
      return null;
    }
    const total = parseNumberInput(String(json.totalBdt ?? ""));
    const summaryBn =
      String(json.summaryBn ?? "").trim() ||
      (Number.isFinite(total) && total > 0
        ? `মোট খরচ প্রায় ${Math.round(total)} টাকা।`
        : "রসিদ থেকে নিশ্চিত হিসাব পাওয়া যায়নি।");
    const rawItems = Array.isArray(json.items) ? json.items : [];
    const items: ReceiptItem[] = rawItems
      .slice(0, 40)
      .map((it, i) => {
        const row = (it ?? {}) as Record<string, unknown>;
        const parsed = parseNumberInput(String(row.priceBdt ?? row.price ?? ""));
        const priceBdt = Number.isFinite(parsed) ? parsed : 0;
        return {
          id: `ri_${i}`,
          nameBn: String(row.nameBn ?? row.name ?? "আইটেম").trim() || "আইটেম",
          quantity: String(row.quantity ?? "১").trim() || "১",
          price: priceBdt > 0 ? `৳ ${formatTakaBn(priceBdt)}` : "অস্পষ্ট",
          priceBdt,
        };
      })
      .filter((it) => it.nameBn.length > 0);

    if ((!Number.isFinite(total) || total <= 0) && items.length === 0) {
      end("empty");
      return null;
    }

    end("ok");
    return {
      id: newLocalId("rcpt"),
      totalBdt: Number.isFinite(total) && total > 0 ? Math.round(total) : 0,
      items,
      summaryBn: summaryBn.slice(0, 400),
    };
  } catch (err) {
    end(err instanceof Error ? err.message : "failed");
    return null;
  }
}

export async function isGemmaVisionAvailable(): Promise<boolean> {
  if (isVisionLlmReady()) return true;
  return hasInstalledVisionLlm();
}
