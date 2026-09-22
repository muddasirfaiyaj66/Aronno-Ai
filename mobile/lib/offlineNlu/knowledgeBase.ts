import kb from "@/assets/models/kb/bn_knowledge_base.json";

export type KbDisease = (typeof kb.diseases)[number];
export type KbTool = (typeof kb.tools)[number];
export type KbFaq = (typeof kb.faq)[number];

export function getKnowledgeBase() {
  return kb;
}

/** Normalize PlantVillage / YOLO labels for lookup (underscores, case). */
function normId(id: string) {
  return id.trim().toLowerCase().replace(/_+/g, "_");
}

export function findDiseaseById(id: string): KbDisease | undefined {
  const key = normId(id);
  return (
    kb.diseases.find((d) => d.id === id) ??
    kb.diseases.find((d) => normId(d.id) === key)
  );
}

export function findToolById(id: string): KbTool | undefined {
  const key = id.trim().toLowerCase();
  return (
    kb.tools.find((t) => t.id === id) ??
    kb.tools.find((t) => t.id.toLowerCase() === key)
  );
}

/**
 * KB is grounding context for the on-device LLM (see retrieve.ts),
 * not a canned reply table shown directly to the user.
 */
