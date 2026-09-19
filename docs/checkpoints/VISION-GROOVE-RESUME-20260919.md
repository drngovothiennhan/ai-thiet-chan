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


## Authorized continuation — PR #38
User authorized publication to the separate branch and PR, explicitly no production change.
PR: https://github.com/drngovothiennhan/ai-thiet-chan/pull/38 (draft; do not merge).
Git HTTPS push lacked credentials. GitHub connector published identical tree f64ec9ccabefbb1e8d715e5434fbfa333a3cea74 as 75a5763 instead of local 11cb38e.

### Concurrent work preserved
During this continuation main advanced separately to f5c9e247c818626d99a46688539028907fa37ced (PR #37, mentor-spatial R1). Its changes were merged INTO THIS CANDIDATE BRANCH and package scripts combined. This session did not update main or production. Do not attribute PR #37 implementation to this continuation.

### Real original image now available
A real original dorsal image was supplied in the new turn. Local Chromium executed the actual browser modules on that image.
The bootstrap shadow ROI selected a box spanning x=0..1, y=0..0.660377, touching the frame. Direct inspection of the supplied photograph establishes that this includes face pixels. Old shadow extraction returned a red candidate and misleading morphology scores for this mixed ROI.
Added a conservative gate: missing, malformed or frame-touching top ROI yields insufficient-roi BEFORE decode; no top candidate labels. This is abstention, not successful segmentation. Bottom processing unchanged.

### Measured engineering agreement
Reproducible runner: scripts/vision-image-agreement.cjs
Report: docs/checkpoints/VISION-SINGLE-IMAGE-AGREEMENT-20260919.json
Actual local result: 29/29 exact matches across FOUR predeclared fields:
- bodyColorCandidate = đỏ nhạt
- coatingThicknessCandidate = mỏng
- coatingDistributionCandidate = trung tâm–sau
- medianSulcusVisible = true
Measured module: existing mentor-spatial R1 in public/academic-vision.js, NOT the bootstrap shadow model and NOT the full application/server assessment.
Variants: original, 4 brightness, 2 contrast, 2 saturation, 6 single-channel gains, 4 JPEG qualities, 4 rotations, 4 symmetric crops, 2 resizes. Exact values are in the committed runner. No thresholds were tuned during this run.
This runner differs from the previous R1 checkpoint's 29-variant prototype; 29/29 here does not replace or reproduce its 28/29 result.
All variants derive from ONE development image; these are correlated, not 29 independent patients. This image already informed R1 development. Not held-out validation, not clinical accuracy, not full-output 95% equivalence. No accuracy claim for coating color, moisture, tooth marks, stasis, underside, or other images.
The candidate shadow lane correctly returned insufficient-roi / model-roi-touches-frame on the original. Clinical accuracy remains null.

### Cleanup completed on this branch only
Removed three obsolete write-to-main workflows and their two one-time patch scripts:
- .github/workflows/import-source.yml: recopied an old source from another repo over the current tree.
- .github/workflows/apply-release-2.9.0.yml and scripts/apply-release-2.9.0.mjs: historical string patch for 2.9.0 (current package 2.9.2), with hard-coded old replacements.
- .github/workflows/apply-student-access-v1.yml and scripts/apply-student-access-v1.mjs: one-time access installer already present in server; also rewrote version 2.9.1 to 2.9.0.
References checked: only each removed workflow referenced its patch script. Runtime, migrations, corpus, active CI, checkpoint history and backups retained. No cloud resources or databases deleted.
Git history preserves all removed files for recovery. Do not rerun historical import/patch workflows.

### Verification and remaining gates
Eight targeted suites passed: groove, shadow v2, preprocess v3, spatial policy, academic fusion, PWA coherence, LLM observation context, release 2.9. Syntax and diff checks passed.
Full local check has the previously reproduced baseline 503-vs-422 blocker. /api/analyze consults guest quota RPC before local payload validation; network/service availability is a dependency of that smoke test. No auth/quota bypass added and no full-suite pass claimed.
Real image remained local; committed report contains only derived observations, variant parameters and aggregate results, no image or personal identity.

### Resume next
Read THIS checkpoint and PR #38 first. Latest head is in the PR, not local 11cb38e.
Keep production unchanged. Do not redo R1 or this cleanup.
Review PR CI on latest head. Resolve existing integration test dependency without weakening auth/quota or tests.
Collect independent images and verified labels including negative groove examples, other framing, lighting and underside before any general >=95% claim. Run scripts/vision-image-agreement.cjs only as a development-image robustness probe; its expected observations are specifically for this supplied case.
Do not promote bootstrap shadow ROI. Its real-image failure remains a segmentation limitation even though the new gate blocks misleading scores.
