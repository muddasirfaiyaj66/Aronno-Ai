# On-device LLM — Gemma 3 (GGUF via llama.rn)

| Field | Value |
|-------|-------|
| Status | **Scaffold** — catalog + download/delete + engine stubs; install `llama.rn` in Sprint 2 |
| Catalog | `mobile/lib/modelManager/catalog.ts` |
| Engine | `mobile/lib/modelManager/llmEngine.ts` |
| Grounding | `mobile/lib/offlineNlu/retrieve.ts` + `bn_knowledge_base.json` |
| Sizes (user choice) | 270M Q8 (~300 MB, recommended), 1B Q4 (~700 MB); 4B later |
| License | Google Gemma Terms — free for commercial use; keep notice in-app |

## Honest expectations

- **270M:** fast, simpler Bangla, occasional English mix — OK for short grounded Q&A.
- **1B:** better fluency; ~1–3 s to first token on mid-range phones.
- Always keep RAG-lite grounding so pesticide doses stay tied to agronomist facts.
