/**
 * Resolve offline disease / tool answers from the knowledge base
 * when TFLite models are not yet installed (transcript / label match).
 */
import type { DiagnosisResult } from "@/types/diagnosis";
import type { ToolResult } from "@/types/tools";
import type { SeverityLevel } from "@/components/ui";
import kb from "@/assets/kb/bn_knowledge_base.json";
import { findDiseaseById, findToolById } from "@/lib/offlineNlu/knowledgeBase";

function normalize(s: string) {
  return s.toLowerCase().replace(/[।,.!?]/g, "").trim();
}

function mapSeverity(raw?: string): SeverityLevel {
  if (raw === "low") return "low";
  if (raw === "high") return "high";
  return "medium";
}

export function diagnosisFromKbId(
  id: string,
  imageUrl = "",
  confidence = 70,
): DiagnosisResult | null {
  const d = findDiseaseById(id);
  if (!d) return null;
  return {
    id: `offline-${d.id}`,
    diseaseNameBn: d.diseaseNameBn,
    diseaseNameEn: d.diseaseNameEn,
    confidence,
    severity: mapSeverity(d.severity),
    imageUrl,
  };
}

export function matchDiseaseFromTranscript(
  transcriptBn: string,
  imageUrl = "",
): DiagnosisResult | null {
  const text = normalize(transcriptBn);
  const hit = kb.diseases.find(
    (d) =>
      text.includes(normalize(d.diseaseNameBn)) ||
      text.includes(normalize(d.diseaseNameEn)) ||
      text.includes(normalize(d.id.replace(/_/g, " "))),
  );
  if (!hit) return null;
  return diagnosisFromKbId(hit.id, imageUrl, 65);
}

export function toolFromKbId(id: string): ToolResult | null {
  const t = findToolById(id);
  if (!t) return null;
  return {
    id: `offline-${t.id}`,
    toolNameBn: t.toolNameBn,
    toolNameEn: t.toolNameEn,
    reasonBn: t.usageBn,
    listings: [],
  };
}

export function matchToolFromTranscript(transcriptBn: string): ToolResult | null {
  const text = normalize(transcriptBn);
  const hit = kb.tools.find(
    (t) =>
      text.includes(normalize(t.toolNameBn)) ||
      text.includes(normalize(t.toolNameEn)),
  );
  if (!hit) return null;
  return toolFromKbId(hit.id);
}
