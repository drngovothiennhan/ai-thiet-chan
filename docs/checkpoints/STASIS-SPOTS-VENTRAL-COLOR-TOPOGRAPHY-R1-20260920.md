# STASIS-SPOTS-VENTRAL-COLOR-TOPOGRAPHY-R1 — checkpoint 2026-09-20

Branch: `vision/stasis-spots-ventral-color-topography-r1-20260920`
Draft PR: #41
Depends on: PR #40 / `vision/toothmark-shape-coating-r1-20260920`
Production changed: **no**

## Locked request
Add Local Vision observation support for:
- localized dark-purple small spots (ứng viên điểm ứ)
- localized dark-purple larger patches (ứng viên ban ứ)
- visible sublingual vessel color
- educational TCM tongue-region mapping and labelled syndrome suggestions for the LLM/result text

No modern-disease diagnosis is generated from the tongue image. New image fields remain candidate/un-calibrated until independent mentor validation.

## Academic basis actually used
- PMID 38083193 — multi-stage localization/segmentation of tongue ecchymosis.
- PMID 36185091 / PMC9522517 — tongue segmentation, root/center/tip/margin partition, blob/color feature filtering; cracks may cause false positives.
- PMID 36212950 / PMC9536899 — stasis tongue and spotted tongue are separate expert-labelled image features.
- PMID 38083316 — separate sublingual segmentation and color analysis.
- PMID 36388160 / PMC9663216 — sublingual-vein image classification methodology and observer subjectivity.
- PMID 12088588 — chromatic/geometric feature extraction after color-equalization-assisted segmentation.
- PMID 35392642 / PMC8983216 — dark-purple/varicose sublingual vein is one item in a multi-factor blood-stasis-constitution model; never used as a single-sign diagnosis.
- PMID 22693533 / PMC3369473 — TCM tongue topography used for regional feature extraction: tip/anterior Tâm-Phế; margins Can-Đởm; center Tỳ-Vị; root/posterior Thận with some maps extending lower burner/intestine/bladder.

## Open-source engineering references
- TonguePicture-SKaRD/TongueDiagnosis — architecture reference only; AGPL code/weights not copied.
- btbuIntelliSense/Intelligent-tongue-diagnosis-detection-dataset — label/region taxonomy reference only; no copy because repo license/provenance is not declared.
- BioHit/TongeImageDataset — standardized tongue/segmentation dataset reference only; no copy without license/provenance review.

## Implemented pipeline
Dorsal:
- `tongue-spatial-observation-v4`
- `tongue-stasis-spot-features-v1`
- `tongue-stasis-spot-policy-v1`
- local relative dark-purple component analysis after tongue segmentation, with coating/glare exclusion and explicit red-prickle separation
- normalized region IDs: `tip`, `margin`, `center`, `root`

Ventral:
- `device-analysis-worker-v4`
- `bottom-device-feature-v3`
- `ventral-structure-color-policy-v2`
- color is estimated only on verified vessel-like dark-line pixels and relative to surrounding mucosa; no absolute size/dilation/tortuosity/stasis inference

LLM/reasoning:
- `aitc-llm-observation-context-v5`
- `tongue-dual-view-feature-vector-v5`
- `aitc-yhct-educational-suggestions-v1`
- structured regional hints are explicitly “Đối chiếu đồ hình YHCT”
- syndrome hints are accepted multi-layer fusion signals only
- `modernDiseaseSuggestions: []`
- user-facing/report text is labelled “Gợi ý đối chiếu YHCT — không thay thế chẩn đoán lâm sàng”

Knowledge:
- `thiet-chan-kb-2026-09-20.6doc+oa28-stasis-ventral-topography-v4`
- `aitc-open-access-tongue-v4`
- `aitc-tongue-ontology-v4`

## Benchmark rule
Independent mentor gate >=95% engineering agreement now also includes:
- `stasisSmallSpot`
- `stasisPatch`
- `ventralVesselColor`

No >=95% claim is allowed until a new locked independent holdout has adequate support and passes all per-field gates. This is not clinical accuracy.

## Resume rule
If interrupted, continue on this branch/PR #41. Check latest CI before any merge/deploy. Do not weaken fail-closed gates or convert regional TCM mapping into organ disease diagnosis.
