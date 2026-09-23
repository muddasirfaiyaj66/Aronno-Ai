# On-device LLM — Gemma 3 (GGUF via llama.rn)

| Field | Value |
|-------|-------|
| Status | **Production path** — download via Model Manager; chat + live voice + optional vision |
| Catalog | `mobile/lib/modelManager/catalog.ts` |
| Engine | `mobile/lib/modelManager/llmEngine.ts` (`initMultimodal` for 4B) |
| Vision helpers | `mobile/lib/offlineVision/gemmaVision.ts` |
| Prompts / RAG / intents | `chatLoop.ts`, `intents.ts`, `retrieve.ts` |
| Sizes | 270M Instruct Q8 (~300 MB); **1B Instruct Q4 recommended** (~690 MB); **4B Instruct Q4_K_M + mmproj-F16** (~3.3 GB — text + vision) |
| License | Google Gemma Terms — free for commercial use; keep notice in-app |

## Honest expectations

- **270M:** fast, simpler Bangla — OK for short grounded Q&A; may struggle with nuance.
- **1B Instruct:** better fluency; preferred default for most phones.
- **4B Instruct + mmproj:** best Bangla + **on-device images** (disease/tool fallback, Bangla receipt). Needs ~7 GB RAM and a full download of GGUF **and** `mmproj-F16.gguf`.
- Chat prefers **intent/KB facts first**; if no facts, the app **skips** instead of guessing.
- Greetings, clock time, and cached weather use **deterministic** replies (not the LLM).

## Multimodal setup (4B)

1. Model Manager → download **জেমা ৩ · ৪বি (লেখা + ছবি)**.
2. Engine loads GGUF with `ctx_shift: false`, then `initMultimodal({ path: mmproj-F16.gguf })`.
3. Scan offline path: TFLite first; Gemma vision if TFLite misses / for receipts.

Full prompt templates and build commands: [`docs/offline_ai/README.md`](../offline_ai/README.md).
