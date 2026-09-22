import kb from "@/assets/models/kb/bn_knowledge_base.json";

export type KbDisease = (typeof kb.diseases)[number];
export type KbTool = (typeof kb.tools)[number];
export type KbFaq = (typeof kb.faq)[number];

export function getKnowledgeBase() {
  return kb;
}

export function findDiseaseById(id: string): KbDisease | undefined {
  return kb.diseases.find((d) => d.id === id);
}

export function findToolById(id: string): KbTool | undefined {
  return kb.tools.find((t) => t.id === id);
}

/**
 * KB is grounding context for the on-device LLM (see retrieve.ts),
 * not a canned reply table shown directly to the user.
 */
