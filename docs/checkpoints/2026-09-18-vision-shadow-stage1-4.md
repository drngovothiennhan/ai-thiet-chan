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
