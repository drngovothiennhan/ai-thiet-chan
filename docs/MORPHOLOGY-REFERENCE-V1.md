# AITC Morphology Reference Model v1 — research checkpoint

Status: **research / shadow comparator only**  
Production authority: **NO**  
Clinical gold: **NO**  
Model-weight training: **NO**  
Target features: **tongue relative size/shape + tooth marks**

## 1. Purpose

Create an independent reference model that can:

1. teach the LLM a stricter, source-grounded vocabulary for tongue size, shape and tooth marks;
2. read the same Local Vision feature payload independently;
3. compare the current app result with the reference result as `aligned / partial / conflict / insufficient`;
4. remain shadow-only until reviewed and validated.

The reference model does **not** diagnose a YHCT pattern or modern disease.

## 2. Evidence basis

### Internal documents already indexed

- TC1-022: puffy tongue / tooth marks in the internal teaching corpus.
- DY1-019: tongue shape including puffy/large vs thin/small.
- DY1-020: tooth marks at the tongue edge.
- DY1-026: morphology summary.
- DY1-047 / DY1-048: normal-relative and tooth-mark examples.

### External sources used as design evidence

- ISO 23961-1:2021 — tongue diagnostic vocabulary. The enlarged/thin concepts include comparison with a normal tongue and include size/thickness; therefore unscaled top-view 2D images cannot establish absolute enlargement/thinness.
- PMID 40025207 / PMC11873170 — IF-RCNet. Shape classification is performed after tongue segmentation and explicitly addresses lip interference and confusion between bulgy, normal and thin tongues.
- PMID 35492602 / PMC9039050 — weakly supervised tooth-mark recognition/localization. Contour distortion at lateral tongue edges is primary; local darker color may support subtle suspected marks.
- PMID 32368332 / PMC7186367 — CNN tooth-mark recognition. Isolating tongue ROI improves recognition and illumination/device variation matters.
- PMID 38452007 / PMC10919637 — feature-level object detection of tooth marks/fissures/coating supports localizable feature representation rather than whole-image text labels only.
- PMID 36212950 / PMC9536899 — expert-annotated multi-label tongue image analysis supports keeping tooth marks independent from other simultaneous morphology/coating labels.

Only metadata and short paraphrased evidence are stored.

## 3. Reference feature vector

### Shape / relative size

The model uses multiple features after ROI validation:

- width-to-height aspect;
- tongue area fill within its bounding box;
- root, shoulder, middle and tip width profiles;
- mean width profile;
- tip taper ratio;
- root-to-middle ratio;
- contour smoothness;
- centerline deviation;
- ROI width/height and top/bottom margins;
- edge-row coverage.

A single aspect ratio can never force a broad/puffy or narrow/thin result.

Outputs are deliberately relative:

- `broad`: broad/full relative 2D projection;
- `typical`: intermediate relative morphology;
- `narrow`: narrow/slender relative 2D projection;
- `unknown`: visibility/QC insufficient.

The model never sets `enlargedConfirmed` or `thinConfirmed` from an unscaled 2D top view.

### Tooth marks

Primary evidence:

- repeated lateral contour concavities;
- left/right scores;
- number of concavity events;
- bilateral support;
- adequate lateral-edge visibility.

Secondary evidence:

- relative darker color at the lateral edge compared with adjacent inward tissue.

The darker-edge signal **cannot** produce a positive tooth-mark result without contour support.

Outputs:

- `present`;
- `suspected`;
- `absent` only when good QC and sufficient edge visibility permit a negative judgment;
- `unknown`.

## 4. Comparison mode

The current production-derived feature result and the independent reference model are compared without overwriting each other:

- `aligned`: same class;
- `partial`: neighboring/uncertain classes;
- `conflict`: meaningful disagreement;
- `insufficient`: one side cannot be safely classified.

The comparison is carried in structured LLM context so the LLM can explain disagreement while preserving Local Vision as the image-observation authority.

## 5. Engineering thresholds

Numeric gates in v1 are internal engineering gates on the current feature scale. They are **not published clinical cutoffs** and must not be described as such.

They are designed to fail closed when:

- QC is poor;
- tongue edges are incompletely visible;
- lips or framing can distort the contour;
- centerline/contour geometry is unstable;
- only a single geometric dimension supports a label.

## 6. Promotion gate

Before production authority is allowed, require:

1. CI/smoke tests pass;
2. shadow output on real images is reviewed;
3. expert-labeled cases are used to calculate feature-level agreement and error types;
4. false-positive tooth marks from lip/edge artifacts are specifically checked;
5. broad/narrow confusion caused by pose/perspective is checked;
6. no regression in existing color/coating/moisture/fissure behavior;
7. explicit human approval to merge/promote.

No accuracy percentage is claimed at this checkpoint because no independent expert-labeled holdout benchmark has yet been run against this new reference model.
