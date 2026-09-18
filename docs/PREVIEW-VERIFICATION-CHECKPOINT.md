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
