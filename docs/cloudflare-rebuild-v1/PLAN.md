# A.I Thiệt Chẩn — Cloudflare rebuild v1

## Locked source checkpoint
- Source repository: `drngovothiennhan/ai-thiet-chan`
- Frozen source SHA: `8fb4f6d90b2a8d787ecdd781fe71a2c72abfdbec`
- Source branch at freeze time: `restructure-local-vision-v1`
- Cloudflare rebuild branch: `cloudflare-rebuild-v1`
- The source application remains untouched. No merge to main/production is allowed from this branch until the Cloudflare E2E parity gate passes.

## Architecture to preserve
1. PWA/static UI and mobile behavior.
2. Device-side Local Vision and shadow validation; Gemini never becomes image authority.
3. Existing structured `/api/analyze` contract.
4. Supabase auth/data/telemetry.
5. Gemini text consultation plus existing provider resilience.
6. AITC case RAG corpus `AITC-LLM-Case-Reasoning-v1`: 44,643 records, bounded top-k retrieval.
7. Adaptive symptom questioning and deterministic case-RAG intermediate questions.
8. Existing safety/grounding rules, rate limits, and fail-closed behavior where currently required.

## Target Cloudflare architecture
- Cloudflare Worker + Static Assets: one deployment unit for PWA/static files + Express API compatibility adapter.
- Cloudflare D1: shadow copy of the existing 44,643-case SQLite corpus with FTS5.
- Supabase: unchanged during migration.
- Gemini / AI Gateway: unchanged providers, moved to Worker secrets/bindings only.
- Local Vision: remains on-device and unchanged during infrastructure migration.
- Cloudflare Access: protected test environment before any public cutover.
- Existing Vercel/Render services remain rollback paths until final acceptance.

## Execution gates

### Stage 0 — Freeze + parity contract
Status: STARTED
- Freeze exact source SHA above.
- Create Cloudflare-only branch.
- Inventory routes, environment variables, PWA/static assets, data stores, model authority rules.
- Add migration tracker/checkpoint.
Exit gate: no production code changed.

### Stage 1 — Worker/Express compatibility shell
Status: PENDING
- Split startup from Express app construction without changing route logic.
- Node/Render adapter keeps `app.listen()`.
- Cloudflare adapter uses Workers HTTP server compatibility.
- Static assets served by Workers Static Assets.
Exit gate: existing Node smoke tests unchanged + Cloudflare local smoke for / and /api/health.

### Stage 2 — RAG database parity in D1
Status: PENDING
- Export current SQLite to D1-compatible SQL; no synthetic records.
- Import all 44,643 records.
- Recreate/verify FTS5 schema.
- Verify exact source counts: TCMChat 44,623 + PMC 20.
- Run query parity on fixed real queries. D1 remains shadow-only until parity passes.
Exit gate: schema/count/hash-manifest and top-k retrieval evidence recorded.

### Stage 3 — External services + secrets
Status: PENDING
- Supabase bindings stay pointed to the existing project.
- Gemini/API gateway keys move to Cloudflare secrets; never commit secrets.
- Preserve provider order, budgets, grounding rules, and API response schemas.
Exit gate: /api/health, /api/chat, /api/report, /api/symptom-next pass without changing clinical logic.

### Stage 4 — Device/PWA parity
Status: PENDING
- Keep Local Vision, QC/ROI, bottom-view shadow, median-sulcus/fissure, color/moisture logic on device.
- Preserve service worker/PWA behavior and mobile UI.
- Verify shadow telemetry remains non-authoritative.
Exit gate: physical-device top+bottom run writes real telemetry and primary analysis is not blocked by shadow failure.

### Stage 5 — Differential validation
Status: PENDING
- Compare frozen source vs Cloudflare for representative route inputs.
- Verify no regression in structured assessment fields, safety rules, retrieval top-k, consultation grounding, and access control.
- Record latency separately; no fabricated averages or accuracy claims.
Exit gate: all blocking differences explained or fixed.

### Stage 6 — Protected preview + cutover
Status: PENDING
- Protect Cloudflare preview with controlled access.
- User acceptance on mobile.
- Keep Vercel/Render rollback for at least one acceptance cycle.
- Only after explicit approval: switch canonical URL.
Exit gate: user-approved cutover; no automatic production promotion.

## Cost/limit guardrails
- Target Workers Free while within current limits.
- Current case DB snapshot (~149 MB) fits within D1 Free's 500 MB per-database limit.
- D1 Free usage must be monitored because read/write limits are enforced daily.
- No paid resource may be created without explicit user approval.

## Resume rule
If work is interrupted, continue from branch `cloudflare-rebuild-v1` and this document. Do not recreate completed stages. Do not change the frozen source SHA. Do not modify production/main until Stage 6 explicit approval.
