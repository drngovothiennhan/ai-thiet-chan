# Local Runtime execution

Branch: `feat/local-runtime-v1-20260921`. Production/main untouched.

## Verified checkpoint — 2026-09-21

Last verified commit: `7d075ffcc33d045f686140fbdb2c4c052de904d5`.

Completed and evidenced:
- Local Runtime core contracts/smoke: PASS.
- Rust native core compile/check: PASS.
- Windows NSIS build: PASS.
- Android aarch64 APK build: PASS.
- Native SQLite/FTS5 retrieval compiles on Windows and Android with bundled SQLite.
- Local case snapshot remains read-only and fail-closed when `cases.sqlite` is absent/invalid.
- Shadow/candidate vision output remains blocked from validated observations.

CI evidence:
- Workflow run: `35556726415` — SUCCESS.
- Windows artifact: `aitc-local-runtime-windows` (artifact id `10620941281`).
- Android artifact: `aitc-local-runtime-android` (artifact id `10620737560`).

Historical failures that were fixed:
- `8c099d6a...`: missing `UnicodeNormalization` trait/dependency.
- `f8afd719...`: incorrect `.nfkc().chars()`; fixed to iterate the NFKC stream directly.

Next scope:
1. signed-pack atomic install/rollback;
2. pack health gate and active/previous version pointers;
3. ONNX/provider probe that reports only actually loadable/benchmarked providers;
4. do not enable production vision until a validated ONNX artifact exists.
