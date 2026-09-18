# A.I Thiệt Chẩn — Production release checkpoint

Final pre-migration runtime checkpoint: `8fb4f6d90b2a8d787ecdd781fe71a2c72abfdbec`

Production release merge: `8c214670117ae6254910ecb0e5d18d009543a59c`

Verified release candidate branch head: `acda3a6e9c978db19be6371b18afd7f48f6a8b2c`

Validation:
- GitHub Actions run `35358726717`: SUCCESS.
- `npm run check`: SUCCESS.
- Local Vision restructure smoke: PASS.
- Vision shadow v2 smoke: PASS.
- Live RAG current-head probe: PASS.
- Simulated upstream 504 -> 429 and 429 -> 504 paths: application grounded path returned HTTP 200 via local-knowledge fallback; no 429/504 exposed at that application boundary.
- Gemini Vision remains disabled; Local Vision remains image-observation authority.
- Cloudflare/data-job migration branches are excluded from this release.

Vercel READY runtime-equivalent candidate: `dpl_8RgJAuvqR3tTcwxk16WQibM1H8KZ` at runtime hotfix commit `2e5a5b74ca21e7c5e7c3d21aca6b0e709a95622f`. Later candidate commits are tests/docs only.
