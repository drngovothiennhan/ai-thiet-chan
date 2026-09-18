# Stage 2 — open-source/reference patterns reviewed

This file records the external patterns consulted for the gold-label/evaluation redesign. It is a design trace, not a claim that any external code was copied into A.I Thiệt Chẩn.

## CVAT
Reference: https://docs.cvat.ai/docs/qa-analytics/consensus/ and https://docs.cvat.ai/docs/qa-analytics/quality-control/

Adopted pattern:
- duplicate/independent annotations before consensus;
- preserve per-annotator evidence rather than overwriting it;
- separate ground-truth quality control from ordinary annotation;
- use spatial overlap metrics such as IoU/Dice for segmentation QA.

A.I Thiệt Chẩn difference:
- gold requires an independent adjudicator rather than automatic consensus merge;
- gold records are immutable;
- model output is excluded from blind annotation packets.

## Label Studio
Reference: https://labelstud.io/tutorials/how_to_measure_inter_annotator_agreement_and_build_human_consensus

Adopted pattern:
- measure annotator agreement separately from model agreement;
- preserve disagreement as QA evidence;
- evaluate a model against human consensus/adjudication rather than against a single annotator.

A.I Thiệt Chẩn difference:
- no majority vote is allowed to create clinical gold automatically;
- two independent annotations plus a third-party adjudication are required by the database contract.

## MONAI Label
Reference: https://docs.monai.io/projects/label/en/latest/index.html

Adopted pattern:
- keep labeling/learning workflow modular;
- separate interactive/annotation workflow from inference;
- treat active-learning/model assistance as optional tooling rather than ground truth.

A.I Thiệt Chẩn difference:
- Stage 2 gold annotation is fully model-blind; model assistance is intentionally disabled for the gold set.

## Tongue-specific open-source projects reviewed
- https://github.com/cshan-github/TongueSAM — MIT licensed tongue segmentation reference.
- https://github.com/zin-Fu/Tongue-Segmentation-and-classification — MIT licensed tongue segmentation/classification reference.
- https://github.com/jw-chae/memory-sam — public segmentation research reference with dataset/export utilities.

Only architectural ideas were considered. No third-party model weights or dataset labels were imported into the gold set, and no external artifact is treated as clinical ground truth.
