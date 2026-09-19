# Local Vision V2 — Shadow ROI + input normalization checkpoint

Date: 2026-09-19
Base production: `ada58ee6c41539b3784ded69c1397fdb0e02e391`
Branch: `vision/local-v2-shadow-roi-normalization-20260919`

## Locked scope

This stage upgrades only the non-authoritative Local Vision shadow lane.

Unchanged by design:
- production Local Vision authority and `/api/analyze` response contract;
- taskbar/PWA workspace behavior;
- student auth/quota;
- Adaptive Symptom Intake;
- Case RAG;
- Local Grounded primary reasoning;
- Gemini text-only auxiliary role;
- production database schema and promotion policy.

## Implemented in this checkpoint

1. The existing shadow ROI candidate now exposes normalized bounding-box geometry.
2. Shadow feature extraction can use that model-derived geometry to restrict its own candidate ROI search.
3. A new `shadow-preprocess-v3` module estimates a neutral reference only from low-saturation pixels outside the candidate tongue ROI.
4. Color-channel gains are bounded to a maximum configured deviation of 20% and never mutate the original image.
5. If the neutral reference is insufficient, preprocessing fails closed to identity gains.
6. Both raw and normalized color candidates remain shadow-only and non-authoritative.
7. Shadow telemetry records preprocessing provenance and bounded gains; it stores no image/base64 payload.
8. The shadow worker is versioned independently as `vision-v3` so the installed PWA can fetch the new experimental lane without changing the serving PWA release.

## What this checkpoint does NOT claim

- No new clinical accuracy value is produced.
- No Dice/IoU/sensitivity/specificity improvement is claimed.
- The 479 silver/weak-supervision samples remain non-gold.
- No feature classifier is promoted to production.
- No new medical diagnosis/treatment behavior is introduced.
- No automatic model promotion is allowed.

## Promotion gate remains unchanged

Verified independent clinical labels -> adjudication -> immutable holdout -> real gold metrics -> physical-device shadow evidence -> manual promotion review.

Until those gates contain real evidence, the new preprocessing and ROI behavior remains candidate/shadow-only.
