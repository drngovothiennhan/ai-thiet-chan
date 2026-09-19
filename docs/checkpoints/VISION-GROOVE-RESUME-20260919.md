# Vision groove continuation — 2026-09-19

## Scope and baseline
Continue the approved image-analysis work; preserve serving behavior. User requested economy (half credits); actual platform credit use cannot be capped or verified here.
Base: a8919098a9594ae3e3ec800c1e56beab7150bb1f (PR #36 merged).
GitHub combined status for that SHA reported Vercel success; no live same-image replay was performed.
Branch: fix/vision-validation-resume-20260919.

## Implemented
- Added pure bounded multiscale median-groove pixel geometry (1–3 pixel shoulders).
- Require bilateral contrast and in-ROI support, preventing mask edges and one-sided shadows from counting as a groove.
- Require vertically connected support instead of unrelated central dark pixels extending a run.
- Shadow medianSulcus now uses this score and retains legacyScore for comparison.
- Scores explicitly remain uncalibrated, authority=false, productionEligible=false.
- Bumped shadow import/worker query keys. No serving diagnosis, auth, quota, database or UI changes.
- Added synthetic regression and wired it into test/check scripts.

## Actual verification
Passed locally:
1. tests/vision-shadow-groove-smoke.mjs
2. tests/vision-shadow-v2-smoke.mjs
3. tests/vision-shadow-v3-preprocess-smoke.mjs
4. tests/academic-fusion-local-reasoning-smoke.mjs
Syntax checks and git diff --check passed.
Synthetic cases cover flat surface, narrow/wide groove, one-sided edge, off-center line, disconnected points, missing ROI shoulders, invalid input and input immutability.

Full npm run check did NOT pass: tests/smoke.mjs:66 expected 422, received 503.
Reproduced the identical failure by running tests/smoke.mjs on a separate clean worktree at baseline a891909. Cause not yet established; do not call this a production outage or bypass the gate.

## Evidence limits
The supplied attachments are screenshots of a previous conversation and result, not original validation images. No real image dataset was evaluated in this continuation. No measured 95% agreement or clinical accuracy exists from these tests. Synthetic software checks must never be reported as clinical validation.
No new clinical labels, benchmark rows, telemetry, or patient images were published.

## Resume precisely
1. Inspect this branch/PR and CI; do not redo implemented work.
2. Resolve the existing smoke 422-versus-503 gate with evidence before merging.
3. Run original real tongue images through baseline and candidate on physical devices.
4. Obtain independently reviewed, locked labels distinguishing median groove, fissure, uncertain and image-quality failure. Keep development images out of held-out evaluation.
5. Report per-label agreement, abstention/coverage, sample count and confidence intervals against those labels. Agreement with ChatGPT is not diagnostic accuracy.
6. Only claim >95% after the specified real evaluation supports it. Until then keep shadow non-authoritative; no automatic promotion.
Rollback for this candidate: revert the candidate commit; no data migration involved.
