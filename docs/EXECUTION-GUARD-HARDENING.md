# A.I Thiệt Chẩn — Execution Guard for Hardening

Baseline production commit: `78a729d619e21a0e242f23a489766bb41d96ab5c`

## Standard action prompt

You are modifying the existing production project `drngovothiennhan/ai-thiet-chan`, not creating a new application.

Only execute the approved hardening scope:
1. protect the application shell and release path;
2. detect coarse device hardware capabilities and select safe processing limits;
3. reduce client image-processing pressure without changing clinical facts or fabricating accuracy;
4. make request/camera/AI failure paths isolated and recoverable;
5. improve chatbot, image analysis, machine-learning and AI layers only after the previous stage passes its tests.

Rules:
- Start from the current approved checkpoint; do not rewrite stable unrelated modules.
- One stage at a time. After each stage, run syntax, smoke and relevant regression tests before the next stage.
- Stop progression if a required test fails; fix only the failed scope before continuing.
- Do not deploy experimental code directly to production. Work on a branch/PR first.
- Every performance claim must come from measured telemetry or a reproducible benchmark. Do not improve numbers cosmetically.
- Historical image data may be used only for controlled before/after evaluation; do not alter source images or labels.
- Hardware detection must remain coarse and non-identifying. Do not store raw user-agent, device serials, advertising identifiers or precise hardware identity.
- Adaptive processing may reduce temporary processing resolution/extra enhancement work on constrained devices, but must preserve the original diagnostic image path and the existing color/glare rollback guards.
- A failure of Gemini, storage, telemetry or an optional module must not make the application shell or camera controls unusable.

## Stage gates

Stage 0 — baseline/checkpoint: record production health, runtime errors and benchmark baseline.

Stage 1 — hardware capability detection in observe-only mode. No processing behavior change until tests pass.

Stage 2 — adaptive image-processing policy. Compare deterministic output limits and real telemetry before/after; preserve non-generative color guards.

Stage 3 — request pipeline consolidation and client crash telemetry.

Stage 4 — PWA/service-worker release coherence and safe update behavior.

Stage 5 — chatbot/AI policy consistency.

Stage 6 — supervised-learning readiness: keep unverified model-generated samples separate from expert-verified labels.

A stage is complete only when its required tests pass and its measured result is recorded.