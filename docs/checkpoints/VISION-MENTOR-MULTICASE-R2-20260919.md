# AITC Vision Mentor Multicase R2 Checkpoint — 2026-09-19

## Locked objective

Improve A.I Thiệt Chẩn visual observation so deterministic local/device processing reproduces the structured observations that a careful human/AI reviewer can make from the supplied tongue photographs, while preserving stable auth/quota/RAG/Gemini/taskbar behavior and avoiding fabricated clinical-accuracy claims.

Branch: `vision/mentor-multicase-r2-20260919`

## Private comparison batch

The owner supplied 10 real photographs for this engineering pass. Raw images are private and are **not committed** to the repository.

Role split used for engineering only:
- 7 dorsal/top-tongue images.
- 3 ventral/underside images.

Reviewer-level visible observations used as the mentor contract:
- dorsal tongue body is predominantly pale-red/pink in this batch;
- coating is predominantly white and generally thin, with several images showing stronger central/posterior distribution;
- warm light / flash can shift the legacy global color ratios and must not automatically become yellow coating, purple tongue, or pale tongue;
- a visible longitudinal median groove is an observation distinct from pathological fissure;
- underside images show bilateral visible dark vascular/linear structures, but a 2D image alone must not be converted into claims of stasis, dilation, tortuosity, or absolute vessel size.

These are image observations for software validation, not diagnoses.

## Baseline failure modes reproduced

The previous global coarse classifier could change body/coating labels under illumination and flash because it used global color proportions. In this private batch, examples included legacy candidates for purple/pale body and yellow/thick coating that were inconsistent with the structured visual review.

The previous underside feature ratio was diluted by the full-frame central rectangle and could miss visibly bilateral underside structures.

## R2 algorithm changes

### 1. Bounded color normalization

`public/academic-vision.js` now estimates a low-saturation off-tongue neutral reference and applies bounded RGB gains in the range 0.8–1.2. If there is not enough neutral evidence, gains remain 1.0.

Purpose: reduce warm/cool illumination drift without generative recoloring.

### 2. Relative coating map

Spatial observation v2 keeps a strict coating map and adds a looser relative coating map against the subject's lateral tongue-body baseline. It emits:
- coating candidate ratio;
- white-like and yellow-like ratios;
- coating color candidate;
- thickness candidate;
- central/middle/posterior/anterior distribution.

The server only surfaces these fields when image QC is not poor.

### 3. Body-color candidate from normalized tongue baseline

The normalized lateral tongue-body baseline becomes the primary QC-gated body-color observation. The legacy global coarse result remains only as fallback.

### 4. Median sulcus remains separate from fissure

The symmetry-relative midline detector continues to produce only a visible longitudinal median-sulcus signal. It never promotes that signal to pathological fissure.

### 5. Ventral role-specific bilateral detector

Device worker v3 adds underside-specific local-contrast measurements:
- left/right dark-line ratios;
- bilateral balance;
- left/right row continuity;
- bilateral visible-structure signal.

The server re-validates the feature vector through `ventral-observation-policy.mjs` before it may surface a bilateral visible-structure observation.

Disease-level inferences remain forbidden:
- venous dilation;
- tortuosity;
- blood stasis;
- absolute vessel size.

## Private ventral fixtures

Three feature fixtures derived from the owner-supplied underside images passed the bilateral observation gate:

| Fixture | Left ratio | Right ratio | Balance | Left continuity | Right continuity |
| --- | ---: | ---: | ---: | ---: | ---: |
| V1 | 0.1597 | 0.0536 | 0.3357 | 0.8030 | 0.7424 |
| V2 | 0.0742 | 0.0842 | 0.8815 | 0.7273 | 0.8030 |
| V3 | 0.0926 | 0.0799 | 0.8631 | 0.7727 | 0.7727 |

A deliberately weakened fixture and poor-QC input fail closed.

## 95% target definition

The requested “95% like ChatGPT” is treated as an **engineering agreement target**, not a clinical-accuracy claim.

A valid 95% gate must be measured on an independent holdout set with pre-defined structured fields such as:
- tongue body color;
- coating color;
- coating thickness;
- coating distribution;
- median sulcus;
- fissure kept independent;
- underside bilateral visible structure.

No 95% sensitivity, specificity, diagnostic accuracy, or population-level performance is claimed from these 10 images.

The prior R1 result of 28/29 = 96.55% was only same-image perturbation agreement for one image and is not reused as a general accuracy number.

## Credit / runtime policy

This path remains deterministic and local/device-first:
- no Gemini Vision call;
- no provider image inference;
- no generative image transformation;
- no server-side LLM is needed to create the visual observations.

Gemini/LLM may only reason over already-created structured text afterward under the existing policy. Therefore this vision improvement itself is intended to add no provider-image-token/credit cost.

## Files changed in R2

- `public/academic-vision.js`
- `academic-server.mjs`
- `spatial-observation-policy.mjs`
- `ventral-observation-policy.mjs`
- `public/device-analysis-worker.js`
- `local-vision-engine.mjs`
- `tests/spatial-observation-policy-smoke.mjs`
- `tests/ventral-observation-policy-smoke.mjs`
- `package.json`
- `public/release-meta.js`
- `tests/pwa-coherence-smoke.mjs`
- `public/sw.js`

## Stable systems deliberately untouched

- authentication and member/admin rules;
- quota rules;
- Supabase case storage;
- Case RAG;
- Local Grounded primary reasoning architecture;
- Gemini auxiliary-only policy;
- taskbar/navigation behavior;
- clinical gold/promotion policy.

## Resume rule

If execution is interrupted:
1. continue from `vision/mentor-multicase-r2-20260919`;
2. do not repeat completed code changes;
3. inspect PR and CI first;
4. do not merge if CI fails;
5. do not describe the 95% target as clinical accuracy;
6. after any later production approval, verify release id, server health, PWA cache generation, device worker v3, dorsal spatial v2, and ventral fail-closed behavior.
