# A.I Thiệt Chẩn — independent gold annotation protocol v1

Scope is deliberately narrow: **tongue presence, tongue ROI segmentation, and image usability**. This protocol does not ask an annotator to diagnose disease, syndrome, treatment, or to validate a model-generated diagnosis.

## Independence rules

Each gold sample requires two annotations from different annotators. Before submission, an annotator must see only the source image(s), acquisition/QC metadata required to judge usability, and this protocol. They must not see the candidate model output, the current production output, another annotator's annotation, weak labels, or aggregate statistics for the sample.

A separate adjudicator resolves the final gold result after at least two independent submissions. The adjudicator must not be one of the source annotators. Disagreement is preserved in the audit trail; adjudication creates a new immutable final record rather than overwriting either source annotation.

## Required fields

`tongue_present` is boolean. `image_quality` is exactly one of `usable`, `uncertain`, or `reject`. If `tongue_present=true`, `roi_mask_rle` is required and describes the visible tongue body ROI in the declared image coordinate space. Optional `notes` may document ambiguity, obstruction, blur, lighting, partial crop, or other reasons relevant to the ROI decision.

The gold mask is an observation target, not a diagnosis label. Teeth, lips, face/background and unrelated objects are excluded from the tongue ROI. If the tongue boundary cannot be judged reliably, use `uncertain` or `reject` rather than guessing.

## Holdout rule

Holdout membership is not chosen by label or model performance. The predeclared rule is stored in `ml/gold/gold-holdout-policy-v1.json`: correlated samples share a `group_hash`; the holdout is group-based and selected by a fixed hash bucket. The selection policy was committed while the live gold-ready count was zero, before any real gold label or gold metric existed.

## Promotion rule

Annotation completion alone cannot promote a model. Required order remains:

`independent gold -> immutable holdout -> measured gold metrics -> physical-device shadow evidence -> manual promotion review`.

Any missing gate is a hard stop. No synthetic annotation, inferred clinician label, model-generated label, or weak bootstrap mask may be substituted for gold.
