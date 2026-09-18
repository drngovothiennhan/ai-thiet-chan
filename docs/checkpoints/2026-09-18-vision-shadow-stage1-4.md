# A.I Thiệt Chẩn — locked vision upgrade checkpoint

Date: 2026-09-18
Base head: 0f718eded507e4fe85344689b48f3c056af8b72f

Locked order:
1. QC/ROI shadow candidate
2. Bottom-view / sublingual vessel shadow candidate
3. Top-view candidates: median sulcus vs fissure, flash-robust color, moisture proxy
4. Shadow validation + real numeric telemetry
5. LLM/RAG latency optimization only after stages 1–4 CI pass

Safety boundary:
- Production authority remains unchanged.
- Existing Local Vision result path is unchanged.
- New candidates are shadow-only, non-blocking, clinicalGold=false, productionEligible=false, authority=false.
- No raw image/base64 is written to benchmark telemetry.
- No mm measurement is allowed without scale calibration.
- No accuracy claim is allowed before leakage-safe validation with real labels.
- SQLite/Render/Supabase retrieval infrastructure is not rebuilt.

Resume rule:
Continue from the latest commit on branch `restructure-local-vision-v1`; do not recreate completed stages. Stage 5 may begin only after the stage 1–4 CI gate passes.

## Stage 1–4 verification
- GitHub CI #562: PASS at commit 4be0d72322e319dec647d79f7b971ff2fe578b26.
- `npm run check`: PASS.
- Live RAG current-head probe: PASS after honoring the configured 15 s remote timeout.
- Measured Render cold-start incident immediately before this gate: service process started at 12:18:56.343Z and reported ready with 44,643 records at 12:18:56.940Z; the prior 12 s hard-coded probe timed out and was not counted as PASS.
- No shadow candidate has been promoted to production authority. No accuracy improvement is claimed.

## Stage 5 implementation
- Intermediate adaptive symptom questions are moved off Gemini to a deterministic, bounded case-RAG selector.
- New endpoint: `POST /api/symptom-next`.
- Input: existing structured assessment + user-confirmed symptom transcript.
- Retrieval: existing `AITC-LLM-Case-Reasoning-v1`, top-k <= 4.
- Question selection uses only symptom concepts actually present in retrieved `caseText`; corpus targets/answers are not used.
- If retrieval is unavailable or yields no supported missing symptom, response falls back to the neutral question “Bạn còn triệu chứng hoặc khó chịu nào khác không?” with `evidenceBased=false`.
- Final synthesis remains on the existing `/api/chat` path. Existing Gemini/provider resilience is not globally changed.
- Real per-request latency is logged as `symptom_rag_question.elapsedMs`; no speedup claim is allowed until measured on live requests.
