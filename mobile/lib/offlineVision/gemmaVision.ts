/**
 * Offline Gemma 3 vision helpers — disease / tool / Bangla receipt.
 * Requires multimodal catalog entry (GGUF + mmproj) loaded via llmEngine.
 */
import kb from "@/assets/models/kb/bn_knowledge_base.json";
import {
  completeLlmVision,
  isVisionLlmReady,
  autoLoadLlm,
  hasInstalledVisionLlm,
} from "@/lib/modelManager/llmEngine";
import { catalogById, isMultimodalCatalogEntry } from "@/lib/modelManager/catalog";
import { listInstalled } from "@/lib/modelManager/modelManager";
import { diagnosisFromKbId, toolFromKbId } from "@/lib/offlineNlu/offlineMatch";
import type { DiagnosisResult } from "@/types/diagnosis";
import type { ToolResult } from "@/types/tools";
import type { ReceiptItem, ReceiptSummary } from "@/types/receipt";
import { logMetric, markStart } from "@/lib/offline/metrics";
import { newLocalId } from "@/lib/offlineDb/db";

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

function diseaseCatalogHint(): string {
  return kb.diseases
    .filter((d) => !/healthy/i.test(d.id))
    .map((d) => `${d.id} = ${d.diseaseNameBn}`)
    .join("; ");
}

function toolCatalogHint(): string {
  return kb.tools
    .map((t) => `${t.id} = ${t.toolNameBn}`)
    .join("; ");
}

/**
 * Classify a leaf photo with Gemma vision → KB disease id.
 */
export async function classifyLeafWithGemma(
  imageUri: string,
): Promise<DiagnosisResult | null> {
  const end = markStart("vision.gemma.disease");
  if (!(await ensureVisionReady())) {
    end("not-ready");
    return null;
  }

  const prompt = [
    "You are Aronno, a Bangladesh crop-disease assistant.",
    "Look at the leaf image. Pick ONE disease id from this list only:",
    diseaseCatalogHint(),
    'Reply ONLY JSON: {"id":"<exact_id_or_uncertain>","confidence":0-100,"noteBn":"এক লাইন বাংলা"}',
    "If unsure, id must be uncertain. Do not invent diseases.",
  ].join("\n");

  try {
    const raw = await completeLlmVision(prompt, imageUri);
    const json = extractJsonObject(raw);
    const id = String(json?.id ?? "").trim();
    if (!id || /^uncertain$/i.test(id)) {
      end("uncertain");
      return null;
    }
    const fromKb = diagnosisFromKbId(id, imageUri);
    if (!fromKb) {
      end("unknown-id");
      return null;
    }
    const conf = Number(json?.confidence);
    if (Number.isFinite(conf) && conf > 0) {
      fromKb.confidence = Math.max(40, Math.min(95, Math.round(conf)));
    } else {
      fromKb.confidence = Math.max(fromKb.confidence, 55);
    }
    logMetric("vision.gemma.disease.ok", fromKb.confidence, id);
    end("ok");
    return fromKb;
  } catch (err) {
    end(err instanceof Error ? err.message : "failed");
    return null;
  }
}

/**
 * Identify a farm tool from a photo with Gemma vision.
 */
export async function detectToolWithGemma(
  imageUri: string,
): Promise<ToolResult | null> {
  const end = markStart("vision.gemma.tool");
  if (!(await ensureVisionReady())) {
    end("not-ready");
    return null;
  }

  const prompt = [
    "You are Aronno. Identify the farm tool in the image.",
    "Pick ONE tool id from this list only:",
    toolCatalogHint(),
    'Reply ONLY JSON: {"id":"<exact_id_or_uncertain>","confidence":0-100,"reasonBn":"এক লাইন বাংলা কেন"}',
    "If unsure, id must be uncertain.",
  ].join("\n");

  try {
    const raw = await completeLlmVision(prompt, imageUri);
    const json = extractJsonObject(raw);
    const id = String(json?.id ?? "").trim();
    if (!id || /^uncertain$/i.test(id)) {
      end("uncertain");
      return null;
    }
    const tool = toolFromKbId(id);
    if (!tool) {
      end("unknown-id");
      return null;
    }
    const reason =
      String(json?.reasonBn ?? "").trim() || tool.reasonBn.slice(0, 160);
    end("ok");
    return { ...tool, reasonBn: reason };
  } catch (err) {
    end(err instanceof Error ? err.message : "failed");
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
    "You are Aronno. Read this Bangla/English shop receipt photo.",
    "Extract line items and total in Bangladeshi Taka.",
    'Reply ONLY JSON: {"totalBdt":number,"summaryBn":"বাংলায় এক বাক্য সারাংশ","items":[{"nameBn":"...","quantity":"...","price":"..."}]}',
    "If unreadable, reply {\"totalBdt\":0,\"summaryBn\":\"রসিদ পড়া যায়নি।\",\"items\":[]}",
    "Use digits for totalBdt. Do not invent items you cannot see.",
  ].join("\n");

  try {
    const raw = await completeLlmVision(prompt, imageUri);
    const json = extractJsonObject(raw);
    if (!json) {
      end("parse-fail");
      return null;
    }
    const total = Number(json.totalBdt);
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
        return {
          id: `ri_${i}`,
          nameBn: String(row.nameBn ?? row.name ?? "আইটেম").trim() || "আইটেম",
          quantity: String(row.quantity ?? "১").trim() || "১",
          price: String(row.price ?? "").trim() || "—",
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
