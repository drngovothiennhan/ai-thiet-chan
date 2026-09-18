# Cloudflare rebuild Stage 0→1 checkpoint

Frozen source: `8fb4f6d90b2a8d787ecdd781fe71a2c72abfdbec`
Branch: `cloudflare-rebuild-v1`

Implemented:
- Isolated migration branch.
- Locked architecture/migration plan.
- Shared Express app can now run without binding Node static serving/listen when `AITC_RUNTIME=cloudflare`.
- Added Cloudflare Worker entry using `httpServerHandler`.
- Added Workers Static Assets routing template.
- Kept current Render case retrieval as Stage 1 authority so migration does not alter RAG quality before D1 parity.
- Added regression smoke ensuring no secret is committed.

Blocked external action:
- Cloudflare account integration is not connected in this ChatGPT session.
- D1 database/project and protected preview cannot be created until the Cloudflare integration is installed/connected.

Resume:
1. Run CI on this branch.
2. Connect Cloudflare integration.
3. Create protected preview Worker.
4. Configure non-secret vars + secrets.
5. Verify /, /api/health, /api/analyze, /api/symptom-next, /api/chat before starting D1 import.
