# Preview verification checkpoint

Purpose: trigger and record a full Vercel Preview verification for the current restructure branch without merging or promoting to production.

Locked rules:
- Branch: `restructure-local-vision-v1`
- Base production branch: `main`
- Production merge: forbidden during this verification.
- Production promotion: forbidden during this verification.
- Required preview checks: CI green, preview deployment on current HEAD, /api/health, core static routes, access/status, new contribution/adjudication pages, runtime error scan, Supabase gate state, and no production SHA change.
- Physical-device-only claims remain open until tested on real devices.
- No fabricated PASS states.

Created for the user-approved step: preview verification first, promotion considered only after preview verification.


## Real preview test — 2026-09-18 04:01–04:04Z

Observed on deployment `dpl_A6Wko48cRqcTfLbkvTXZi3SGzmHS` / SHA `ca72162ee0ef0623daf72b9ce1a073ae0d167c47`:
- GET / and /api/access/status returned 200 during the user's device test.
- POST /api/analyze returned 200 three times but logged `academic_fusion_error gemini is not defined`.
- Root cause: stale variable reference in `public/academic-fusion-core.js`; local structured reasoning was incorrectly reading `gemini.patternCandidates` instead of `reasoning.patternCandidates`.
- Fix committed and regression-tested at branch HEAD `8cccd9ad2080138bdeeec2f1a3356993a64a9ade`; GitHub Actions run 35305673443 PASS.
- POST /api/chat returned 200 twice. Provider attempts observed transient 503 and 429/timeout; text failover reached the local-knowledge fallback rather than failing the request.
- This provider behavior is not counted as a full Gemini-provider PASS; only application-level graceful fallback was observed.
- Vercel had not yet produced a Preview deployment for HEAD `8cccd9ad...` at the time of this checkpoint. Therefore the old Preview must not be used to validate the fix.

Promotion remains BLOCKED until the fixed HEAD is deployed and re-tested.
