# AITC Vision Real-Image Upgrade Checkpoint — 2026-09-19

## Scope locked
Improve real image-analysis consistency for A.I Thiệt Chẩn without inventing clinical metrics, without promoting unvalidated shadow classifiers, and without changing stable unrelated features.

## Trigger case
User supplied a real top-tongue image and screenshots of production output.

### Direct visual observations from the supplied image
These are image-level observations only, not a diagnosis:
- dorsal tongue is centered and substantially visible;
- body color appears pink / pale-red under the supplied lighting;
- whitish coating is visible, more evident centrally/posteriorly than at the tip;
- a clear longitudinal midline groove/line is visible;
- no strong evidence from this single image to confidently call tooth marks, stasis spots, or pathological fissures;
- moisture and posterior/root completeness are not reliable enough to assert from this single photograph.

### Production output observed in screenshots
- tongue color: đỏ nhạt;
- coating: trắng, mỏng;
- fissure: “Chưa đủ căn cứ đánh giá nứt lưỡi”;
- tooth marks: Không xác định;
- red papilla/spots: “Không thấy tín hiệu điểm đỏ/gai nổi bật”;
- stasis marks: Không xác định;
- quality: fair.

The direct visual layer is broadly conservative, but the theory layer simultaneously emitted:
- Tín hiệu hư hàn;
- Tín hiệu khí huyết ứ trệ;
- Tín hiệu âm dịch hao tổn / nhiệt thương tân.

## Proven deterministic defect
`public/academic-fusion-core.js::directPatterns()` previously concatenated free-text fields and searched substrings.

This caused negated/unknown text to become positive evidence:
- “chưa đủ căn cứ đánh giá nứt lưỡi” contains “nứt”;
- “Không xác định” can match the prefix “khô” in naive substring logic;
- “nứt” contains the character “ứ”, which could trigger the stasis rule;
- “Không thấy tín hiệu điểm đỏ” still contains “đỏ”.

This explains the contradiction between the structured visual result and theory output without requiring speculation.

## Changes completed on branch
Branch: `fix/vision-theory-structured-evidence-20260919`

1. Reworked `directPatterns()` to read structured fields separately.
2. Added explicit unknown/negation blocking.
3. Positive morphology rules now require explicit positive observations.
4. Strong-red rules no longer treat `đỏ nhạt` as strong red.
5. Added regression tests using a screenshot-like assessment payload.
6. Regression requires that the screenshot-like payload cannot emit:
   - khí huyết ứ trệ;
   - âm dịch hao tổn / nhiệt thương tân.
7. Positive-control test still allows heat / yin-fluid candidates when fields are explicitly positive.

Commits:
- `1d3ffd049f77c8807b63fcde095189d419920374`
- `17cde73201ef92cbce965d5722b686f6631b4571`

## Confidence statement
No claim of >=95% clinical accuracy is made.

Engineering confidence is >95% that this specific patch improves real output consistency for this false-positive class because the defect is deterministic and the regression test directly covers the observed production contradiction.

## Next gate
1. Open PR to trigger CI.
2. Require CI success.
3. Merge only if CI passes.
4. Verify production /api/health and deployment SHA.
5. Re-test the same real image in production.
6. Do not promote Local Vision V2/V3 shadow morphology into authority until real validation data supports it.

## Follow-on image capability work (not yet promoted)
Highest-value next target is to distinguish:
- median sulcus / central longitudinal groove
from
- pathological fissure candidates.

The supplied image visibly contains a central longitudinal groove that production currently collapses into “cannot conclude fissure”. Shadow V3 already computes separate `medianSulcus` and `fissure` candidate scores. Those outputs remain non-authoritative until validated on a real labeled set.

## Resume instruction for another chat
Continue from branch `fix/vision-theory-structured-evidence-20260919`.
Do not repeat completed work.
First check PR/CI status, then merge only after CI success.
After production deploy, verify same-image behavior: no false stasis or yin-fluid signal from negated/unknown strings.
