# On-device LLM — Gemma 3 (GGUF via llama.rn)

| Field | Value |
|-------|-------|
| Status | **Production path** — download via Model Manager; chat + live voice |
| Catalog | `mobile/lib/modelManager/catalog.ts` |
| Engine | `mobile/lib/modelManager/llmEngine.ts` |
| Prompts / RAG | `mobile/lib/offlineChat/chatLoop.ts`, `mobile/lib/offlineNlu/retrieve.ts` |
| Sizes | 270M Instruct Q8 (~300 MB); **1B Instruct Q4 recommended** (~690 MB); **4B Instruct Q4_K_M** (~2.5 GB, stronger Bangla, needs ~6 GB RAM) |
| License | Google Gemma Terms — free for commercial use; keep notice in-app |

## Honest expectations

- **270M:** fast, simpler Bangla — OK for short grounded Q&A; may struggle with nuance.
- **1B Instruct:** better fluency; preferred default for most phones.
- **4B Instruct:** best Bangla quality in-catalog; download ~2.5 GB; needs a phone with enough free RAM (~6 GB+).
- Always keep RAG-lite grounding so pesticide doses stay tied to agronomist facts.
- Greetings, clock time, and cached weather use **deterministic** replies (not the LLM).

Full prompt templates and build commands: [`docs/offline_ai/README.md`](../offline_ai/README.md).
