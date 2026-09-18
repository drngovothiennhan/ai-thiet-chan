# Session 6 — Real-device evidence

Current staging head: `de71d0b1e1dd6a0556c58dc3ea943e468fd919f0`

## Android high — user-supplied physical run

Source report schema: `aitc-real-device-validation-v1`.

Observed on Android / Chrome mobile, runtime tier `high`, backend `worker-canvas-cpu`:
- exact main-thread vs worker signature parity: PASS;
- worker elapsed for the submitted run: 448 ms;
- reload recovery: PASS;
- JS camera release: tracks ended and video stream reference cleared;
- manual thermal observation: cool;
- manual camera indicator: not observed, therefore physical camera-indicator gate remains OPEN;
- service-worker result from validation-v1 was partial because the standalone harness did not register the service worker itself; this result is not treated as an application SW failure.

The submitted `performance.memory` values were coarse/repeated and are not treated as proof of stable memory usage.

## Follow-up harness v2

`public/device-validation-v2.html` now:
- runs same-image parity five times on the real detected tier without hardware override;
- records per-run elapsed time and available browser heap readings;
- retains manual thermal/camera-indicator observations;
- explicitly registers `/sw.js`, waits for ready, reloads when necessary, and checks a controlled session;
- explicitly states that a controlled-session pass does not close the distinct-release update-race gate.

## Session status

`PARTIAL_REAL_DEVICE_EVIDENCE`

Still open:
- Android constrained/low current-head physical run;
- Android balanced/mid current-head physical run;
- iOS/Safari fallback current-head physical run;
- physical camera indicator confirmation;
- controlled PWA/SW session on current head and later distinct-release update-race test;
- stronger memory/thermal repeated-run observations;
- one real current-head analysis proving `deviceCompute` persistence in Supabase;
- real Gemini/provider fallback preserving auth/quota/error semantics.

No synthetic benchmark data was created. No production merge/deploy was performed by this checkpoint.
