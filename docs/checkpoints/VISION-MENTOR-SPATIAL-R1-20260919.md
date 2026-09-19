# AITC Vision Mentor-Spatial R1 Checkpoint — 2026-09-19

## Locked objective
Improve A.I Thiệt Chẩn image observations so the deterministic app output follows the same structured visual reasoning used in the owner-provided real image comparison, without changing stable auth/quota/RAG/Gemini/taskbar behavior and without fabricating clinical accuracy.

Branch: `vision/mentor-spatial-r1-20260919`
Base main: `a8919098a9594ae3e3ec800c1e56beab7150bb1f`

## Real-image target
The user supplied one dorsal-tongue photograph. The image itself is **not committed to the public repository**.

Structured mentor observation used for engineering comparison:
- tongue body: pale-red / pink (`đỏ nhạt`);
- coating: white, thin;
- coating distribution: more central/posterior than anterior;
- a clear longitudinal median groove is visible;
- the median groove must not be promoted to pathological fissure;
- tooth marks / stasis / moisture remain unsupported by this image unless a separate validated detector supplies positive evidence.

## Measured same-image robustness gate
Private local engineering evaluation was run at the app analysis scale (max side 192 px) against 29 deterministic variants of the supplied image:
- original;
- brightness changes;
- contrast changes;
- bounded RGB/white-balance shifts;
- JPEG recompression;
- small crops/shifts;
- rotations up to ±2 degrees.

Target fields:
1. `đỏ nhạt`
2. `rêu trắng` (existing production observation retained)
3. `mỏng`
4. `trung tâm–sau`
5. median sulcus visible signal
6. fissure remains unknown / not inferred from the sulcus

Measured exact structured agreement across the target fields: **28/29 = 96.55%** at max-side 192 for the prototype spatial algorithm.

This is **not** a clinical accuracy, sensitivity, specificity, or general-population metric. It is a same-image perturbation agreement test against the assistant's structured observation for this one supplied case. General clinical promotion still requires the existing independent gold pipeline.

## Base derived spatial fixture (image not stored)
Approximate base metrics at max-side 192:
- body saturation: 0.3765
- body luma: 113.26 / 255
- coating candidate ratio: 0.2714
- coating central ratio: 0.6996
- coating middle ratio: 0.4648
- coating posterior ratio: 0.2696
- coating anterior ratio: 0.1266
- median-sulcus score: 1.0
- continuity: 0.5536
- centrality: 0.7556

## Algorithm added
### 1. Secondary spatial ROI
A conservative center/lower-frame tongue mask is computed separately from the legacy signature path. Failure does not replace the legacy production observation; it simply yields no spatial observation.

### 2. Relative coating map
Within the spatial ROI:
- estimate lateral tongue-body luminance and saturation;
- define coating candidate pixels relative to the lateral body baseline;
- measure central, middle, posterior and anterior coating ratios;
- surface `trung tâm–sau` only when the relative distribution gate is satisfied.

### 3. Symmetry-relative median sulcus
- estimate tongue symmetry axis from row-wise mask midpoints;
- search only within ±15% of tongue width around that axis;
- measure a narrow dark-line contrast against a wider local horizontal baseline;
- require score >= 0.62, continuity >= 0.22 and centrality >= 0.35;
- a passing result is a **direct visible median-sulcus signal**, not a disease label.

### 4. Fissure separation
The median sulcus is explicitly separated from pathological fissure. A median-sulcus signal never converts fissure to positive.

### 5. QC fail-closed
Poor-QC images do not receive spatial coating distribution or median-sulcus promotion.

## Files changed
- `public/academic-vision.js`
- `academic-server.mjs`
- `spatial-observation-policy.mjs`
- `local-vision-engine.mjs`
- `local-grounded-reasoning.mjs`
- `public/app.js`
- `tests/spatial-observation-policy-smoke.mjs`
- `package.json`
- `public/release-meta.js`
- `public/sw.js`

## Stable systems deliberately untouched
- student/admin authentication and quota;
- Supabase case store;
- Case RAG;
- Local Grounded primary architecture;
- Gemini auxiliary-only policy;
- taskbar navigation behavior;
- existing Local Vision color/coating primary fields;
- clinical gold/promotion policy.

## Promotion interpretation
The new median-sulcus and coating-distribution fields are direct deterministic image observations only. They are not a clinical diagnosis and do not bypass the existing gold evaluation gate for disease-level or morphology-disease claims.

## Resume rule
If execution is interrupted:
1. continue from branch `vision/mentor-spatial-r1-20260919`;
2. do not repeat completed code changes;
3. open/inspect PR and CI;
4. merge only if CI passes;
5. verify production SHA, `/api/health`, release ID, and live `academic-vision.js`;
6. re-run the same real image on production and confirm:
   - `Phân bố rêu = trung tâm–sau` when QC is fair/good;
   - `Rãnh giữa = Có tín hiệu rãnh dọc giữa`;
   - `Nứt` remains conservative and is not inferred from the median groove.
