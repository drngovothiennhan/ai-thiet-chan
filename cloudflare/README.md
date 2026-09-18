# Cloudflare adapter — Stage 1 scaffold

This directory is isolated to branch `cloudflare-rebuild-v1`.

Current stage:
- Reuses the same Express API application from `server.mjs`.
- Keeps normal Node/Render startup unchanged.
- Cloudflare adapter uses `cloudflare:node` `httpServerHandler`.
- Static files are served through Workers Static Assets.
- API routes run Worker-first.
- Until D1 parity is proven, case retrieval remains on the existing verified Render retrieval endpoint.

Not yet enabled:
- D1 binding/import.
- Cloudflare secrets.
- Cloudflare Access.
- Production/canonical routing.

Do not deploy this scaffold as production. Connect the Cloudflare integration, create a protected preview, configure secrets, and pass Stage 1 local/remote smoke tests first.
