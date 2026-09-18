# LLM resilience v2 — preview hardening

## Goal
Keep A.I Thiệt Chẩn usable when Gemini returns 429, 503 or stalls. Image analysis remains independent from cloud LLM availability.

## Runtime order
1. Local Vision remains the only image-observation authority.
2. Text reasoning primary: `gemini-3.8-flash`.
3. For transient 5xx/timeout, one bounded retry of the primary with exponential backoff + jitter.
4. Direct Gemini fallback: `gemini-3.6-flash`.
5. Independent-provider fallback through Vercel AI Gateway when an OIDC/API gateway credential is available. Default fallback model: `openai/gpt-5.6-sol`.
6. If all cloud text providers fail:
   - grounded consultation can fall back to local evidence/RAG;
   - explicitly external-Gemini-only consultation fails closed as unavailable;
   - Local Vision result remains available.

## Stability controls
- per-attempt timeout: 8s default;
- total cloud budget: 18s default;
- 429 opens a model circuit for at least 60s or the returned retry delay;
- repeated 5xx/transport failures open a shorter circuit;
- open circuits are skipped on warm instances;
- Retry-After and google.rpc.RetryInfo are honored within the bounded budget;
- QuotaFailure metric/id/dimensions are logged in sanitized form;
- API keys and raw image payloads are never logged;
- AI Gateway receives text messages only; inline media is blocked before all LLM network calls.

## Verification
CI run 35308443141 PASS at commit `dded9537c0037777eade50a97c4018b7ed98cf22`.

Regression gates include:
- bounded Gemini primary retry -> direct fallback;
- Gemini Vision blocked before network;
- independent-provider AI Gateway text-only fallback;
- sanitized 429 QuotaFailure / RetryInfo diagnostics;
- local academic fusion no longer references stale Gemini vision variables.

## Production rule
This remains Preview-only until real Preview runtime checks pass. Do not merge or promote to production from this document.
