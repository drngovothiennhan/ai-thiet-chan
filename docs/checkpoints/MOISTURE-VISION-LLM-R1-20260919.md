# AITC Moisture Vision + LLM R1 Checkpoint — 2026-09-19

## Locked objective

Complete the local path `image -> deterministic moisture observation -> LLM interpretation` without giving the LLM direct image authority, and improve the pre-production benchmark so the owner's >=95% target is measured as structured-observation agreement rather than claimed clinical accuracy.

Branch: `vision/mentor-multicase-r2-20260919`
PR: #39 (Draft)
Production: **not changed**

## Evidence basis

This phase is based on:
- the owner's THIỆT CHẨN(1) atlas dry/moist examples;
- OA17 / PMID 25699260: controlled-image gloss is associated with tongue-surface moisture, with major lighting/geometry/timing confounders;
- OA18 / PMID 35047962: tongue-body dry/wet and coating dry/wet are separate expert labels and coating moisture is less consistently rated;
- existing project policy that Local Vision is the only image-observation authority and the LLM only receives structured output.

No threshold from a small research study is treated as a universal diagnostic threshold.

## Measured baseline weakness before R1

Real shadow telemetry already present in `public.ai_thiet_chan_vision_shadow_events_v2` contained 4 Android/high-tier events:
- 3/4 had `candidate_moisture_score = 0`;
- the remaining event had score 0.0347;
- reported moisture reliability was 0.9816–1.0.

This is evidence that the old shadow moisture proxy was poorly calibrated: it was essentially a glare ratio while confidence stayed near maximum when no moisture evidence existed.

These 4 events have no independent moisture mentor/gold labels, so they **cannot** be used to calculate accuracy or agreement.

## R1 Local Vision moisture path

### Pixel observation

`public/academic-vision.js` now computes a dedicated `tongue-moisture-features-v1` block inside the already-segmented tongue ROI.

Separate feature groups are emitted for:
- whole visible surface;
- tongue body excluding likely coating;
- likely coating.

Features include:
- soft local gloss ratio;
- strict gloss ratio;
- largest gloss-component dominance;
- distributed gloss ratio;
- local microtexture/roughness;
- mean intensity;
- overexposed and underexposed ratios;
- sampled-pixel support.

The existing relative coating map is reused only to split body/coating observation. It is not treated as a clinical label.

### QC and fail-closed policy

`moisture-observation-policy.mjs` adds `tongue-moisture-policy-v1`.

Candidate states:
- moist / `nhuận/ướt`;
- dry / `khô`;
- balanced / `khô ướt vừa phải`;
- unknown / `Không xác định`.

The policy:
- separates surface, tongue body, and coating;
- combines gloss, distributed reflection, and microtexture;
- penalizes overexposure and dominant flash/specular components;
- returns unknown for poor QC, insufficient pixels, or high flash risk;
- never uses fissure alone to call dryness;
- never treats a bright flash spot as wetness;
- remains `calibrated:false` and `productionEligible:false` until the benchmark gate is satisfied.

### Verified payload

`academic-server.mjs` sanitizes every moisture feature before Local Vision may consume it. Invalid schemas, non-finite ratios, or out-of-range values cause the moisture feature block to be rejected.

### Local Vision output

`local-vision-engine.mjs` now calls the moisture policy and emits:
- legacy-compatible `top.moisture` text;
- structured `top.moistureObservation`;
- body/coating moisture evidence;
- QC limitation text.

The local visual layer remains the authority. Gemini/LLM cannot create or repair moisture observations.

## LLM training/grounding contract

The safe context is upgraded to `aitc-llm-observation-context-v3` and the stored structured feature vector to `tongue-dual-view-feature-vector-v3`.

New hard policy flags:
- `moistureObservationOnly:true`;
- `flashGlareCannotEqualWetness:true`;
- `fissureAloneCannotEqualDryness:true`;
- `bodyAndCoatingMoistureAreSeparate:true`.

`local-grounded-reasoning.mjs` now has a dedicated moisture explanation path. It reports only the Local Vision labels/confidence/QC and keeps unknown as unknown. It does not derive a YHCT cause, disease, treatment, or hidden visual feature from moisture alone.

## Shadow benchmark R4

The prior glare-only proxy in `shadow-feature-extractor-v3` is replaced by `shadow-feature-extractor-v4`.

R4 candidate moisture now uses:
- local soft/strict gloss;
- distributed-vs-dominant highlight geometry;
- roughness/microtexture;
- sampled support;
- overexposure and flash risk;
- evidence-aware reliability.

A zero score no longer automatically receives reliability near 1.0.

Shadow remains:
- non-blocking;
- post-response;
- `authority:false`;
- `productionEligible:false`;
- `clinicalGold:false`.

## Benchmark telemetry upgrade

The A.I Thiệt Chẩn Supabase telemetry table and RPC were extended with nullable moisture evidence fields:
- label candidate;
- gloss ratio;
- strict gloss ratio;
- distributed gloss ratio;
- largest gloss-component ratio;
- roughness;
- overexposed ratio;
- sampled pixels.

Migration: `20260919_ai_thiet_chan_moisture_shadow_telemetry_v1.sql`.

This changes benchmark observability only; it does not activate the candidate in serving.

## >=95% promotion gate

`ml/evaluation/evaluate_visual_mentor_agreement.mjs` defines the first executable R1 mentor-agreement gate.

The target is explicitly:
**>=95% engineering agreement with independent structured mentor labels, not clinical diagnostic accuracy.**

Required structured fields:
1. body color;
2. coating color;
3. coating thickness;
4. coating distribution;
5. median sulcus;
6. fissure;
7. surface moisture;
8. tongue-body moisture;
9. coating moisture;
10. ventral bilateral visible structure.

Current gate:
- >=50 independent holdout rows;
- >=10 mentor-known samples for every required field;
- micro agreement >=0.95;
- macro agreement >=0.95;
- zero fail-closed safety leaks;
- candidate unknown while mentor known counts as disagreement;
- candidate known when mentor is unknown, or candidate known on poor-QC input, counts as a safety leak.

Synthetic smoke fixtures only verify that the gate code behaves correctly. They are not model evidence.

## Current benchmark truth

Actual >=95% agreement is **not yet verified** because the current telemetry rows do not have independent structured moisture mentor labels.

Production promotion stays blocked until:
1. an independent annotated holdout is collected and locked;
2. the executable gate passes;
3. fail-closed safety leaks are zero;
4. CI is green;
5. an explicit production approval is given.

## Resume rule

If the session stops:
1. continue from `vision/mentor-multicase-r2-20260919`;
2. inspect PR #39 and the latest CI run before changing code;
3. do not repeat OA/atlas ingestion already completed;
4. do not replace the moisture method with raw brightness/glare;
5. do not relax unknown/fail-closed behavior merely to raise agreement;
6. do not report synthetic smoke tests as real benchmark performance;
7. do not merge or deploy production until the independent holdout gate is genuinely satisfied.
