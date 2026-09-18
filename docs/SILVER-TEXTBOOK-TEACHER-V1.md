# Silver textbook teacher lane v1

The user-approved teaching-material lane is intentionally separate from clinical gold.

- **Silver source:** owner-provided teaching textbooks and their extracted images.
- **Allowed:** bootstrap/pretraining, segmentation pre-annotation, regression, ablation and annotation-tool QA.
- **Forbidden:** conversion into gold by relabeling, clinical accuracy claims, locked gold holdout, automatic promotion or production activation.
- **Gold source:** verified clinical contributions from Bác sĩ/Y sĩ submitted through the app, each with structured ROI/presence label, professional attestation and Admin approval. Two distinct contributor hashes are still required before adjudication.
- **Adjudication:** remains an independent third review. Silver/model output must not be exposed to the gold annotator before their label is submitted.

This separation follows the same general quality pattern used by CVAT/Label Studio/MONAI-style workflows: model assistance or pre-annotation can accelerate labeling, while ground-truth/review evidence stays separately auditable.

Resume rule: read `ml/checkpoints/stage2-gold-to-promotion-v1.json` first. Silver work may continue without blocking production, but it must never change the order `independent gold -> adjudication -> locked holdout -> gold metrics -> physical shadow -> manual promotion review`.
