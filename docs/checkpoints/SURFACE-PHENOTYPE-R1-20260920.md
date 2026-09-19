# Surface Phenotype R1 Checkpoint — 2026-09-20

Branch: `vision/toothmark-shape-coating-r1-20260920`
PR: #40 (Draft)
Base production source at branch start: `37a1718aff7897c64730d7d56a5b348413599311`
Production touched: **no**

## Locked scope
Add three Local Vision observation capabilities without changing unrelated stable systems:
1. tooth-mark / scalloped lateral-edge signal;
2. relative tongue shape: broad-full / slender / intermediate;
3. visible coating texture.

Local Vision remains image authority. LLM receives only verified structured observations.

## Evidence actually used
- TCATLAS1 owner atlas silver examples: p10, p12, p18, p20, p33, p36, p37, p39.
- OA10 PMID 40025207: tongue segmentation before shape classification; lip interference is a confounder.
- OA20 PMID 35492602: tooth-mark recognition/localization from local candidate regions.
- OA21 PMID 32368332: tooth-mark recognition across different image equipment/illumination.
- OA22 PMID 36212950: expert-separated tooth-marked / greasy / peeled / rotten coating labels in multi-label image analysis.
- OA23 PMID 34896205: graded greasy-coating classification and cross-camera evaluation.

PMID 30661421 was discovered but is marked Retracted Publication and is deliberately excluded from the project evidence corpus.

## Implemented primary image features
`public/academic-vision.js` now emits `tongue-spatial-observation-v3` with a `tongue-surface-phenotype-features-v1` block:
- toothmark geometry: repeated inward lateral contour concavities, left/right count, max relative depth, bilateral signal, edge sample support;
- shape geometry: segmented box aspect, mid-width/height, silhouette fill and profile support;
- coating texture: coating-local microtexture, high-frequency, fine/coarse granularity, connected-component dominance/patchiness, edge/center distribution.

All geometry is relative to the segmented tongue ROI. No absolute physical size is inferred.

## Interpretation policy
`surface-phenotype-policy.mjs` = `tongue-surface-phenotype-policy-v1`.

Fail closed:
- poor QC -> unknown;
- weak edge support -> toothmarks unknown;
- insufficient shape profile -> shape unknown;
- weak/insufficient coating texture -> coating texture unknown.

Hard semantic limits:
- broad/full silhouette can be described as “gợi dạng mập-bệu”; 2D image does not prove softness/non;
- toothmarks do not equal Tỳ hư or another syndrome;
- coating adhesion / ease of scraping cannot be inferred from a static image;
- texture classes do not independently establish thấp/đàm/thực tích.

Candidate remains `calibrated:false` and `productionEligible:false`.

## LLM integration
Safe context: `aitc-llm-observation-context-v4`.
Feature vector: `tongue-dual-view-feature-vector-v4`.

New policy flags explicitly prevent:
- toothmark -> Tỳ hư shortcut;
- broad/full -> softness shortcut;
- coating texture -> adhesion/scrapability shortcut.

Knowledge version: `thiet-chan-kb-2026-09-20.6doc+oa23-surface-phenotype-v3`.
Ontology: `aitc-tongue-ontology-v3`.

## Benchmark
The independent mentor >=95% engineering-agreement gate now also requires:
- `toothmarks`
- `tongueShape`
- `coatingTexture`

This is not clinical accuracy. The new fields have not yet passed an independent locked holdout, so no >=95% claim is allowed.

## Resume rule
If interrupted:
1. continue from this branch and PR #40;
2. inspect latest CI before more code;
3. do not use the retracted fractal-coating paper as evidence;
4. do not relax fail-closed gates merely to raise agreement;
5. do not merge/deploy production until requested and current CI/preview are verified.
