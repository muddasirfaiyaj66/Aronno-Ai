/**
 * RAG-lite: keyword retrieval over bn_knowledge_base.json.
 * Returns short Bangla fact strings to inject into the on-device LLM prompt.
 * Not shown to the user as canned chat replies.
 */
import kb from "@/assets/models/kb/bn_knowledge_base.json";

function normalize(s: string) {
  return s.toLowerCase().replace(/[।,.!?]/g, "").trim();
}

/** Returns 0–3 short Bangla fact strings relevant to the user's message. */
export function retrieveContext(userTextBn: string): string[] {
  const text = normalize(userTextBn);
  const hits: string[] = [];

  for (const d of kb.diseases) {
    if (
      text.includes(normalize(d.diseaseNameBn)) ||
      text.includes(normalize(d.diseaseNameEn))
    ) {
      hits.push(
        `${d.diseaseNameBn} (${d.diseaseNameEn}): লক্ষণ- ${d.symptomsBn}। চিকিৎসা- ${d.treatmentBn}। প্রতিরোধ- ${d.preventionBn}`,
      );
    }
  }

  for (const t of kb.tools) {
    if (
      text.includes(normalize(t.toolNameBn)) ||
      text.includes(normalize(t.toolNameEn))
    ) {
      hits.push(`${t.toolNameBn} (${t.toolNameEn}): ${t.usageBn}`);
    }
  }

  for (const f of kb.faq) {
    if (f.patternsBn.some((p) => text.includes(normalize(p)))) {
      hits.push(`FAQ (${f.intent}): ${f.responseBn}`);
    }
  }

  return hits.slice(0, 3);
}

/** Build grounding block from a vision label (disease/tool id) after offline scan. */
export function retrieveContextForLabel(
  kind: "disease" | "tool",
  idOrName: string,
): string[] {
  const key = normalize(idOrName);
  if (kind === "disease") {
    const d = kb.diseases.find(
      (x) =>
        normalize(x.id) === key ||
        normalize(x.diseaseNameEn) === key ||
        normalize(x.diseaseNameBn) === key,
    );
    if (!d) return [];
    return [
      `${d.diseaseNameBn} (${d.diseaseNameEn}): লক্ষণ- ${d.symptomsBn}। চিকিৎসা- ${d.treatmentBn}। প্রতিরোধ- ${d.preventionBn}`,
    ];
  }
  const t = kb.tools.find(
    (x) =>
      normalize(x.id) === key ||
      normalize(x.toolNameEn) === key ||
      normalize(x.toolNameBn) === key,
  );
  if (!t) return [];
  return [`${t.toolNameBn} (${t.toolNameEn}): ${t.usageBn}`];
}
