# Stage 2 checkpoint — gold → holdout → metric → device shadow → promotion

Branch: `restructure-local-vision-v1`  
Production main remains isolated: `07ec84ddaa677c6695a2f1112b44baf37bbf9668`

## Locked execution order

1. verified independent clinical gold;
2. independent adjudication;
3. immutable gold holdout;
4. real metrics on locked gold;
5. physical-device shadow evidence;
6. explicit manual promotion review.

## Gold source policy now in force

The accepted gold source is **clinical contribution submitted in the app by a self-confirmed Bác sĩ/Y sĩ and explicitly approved by Admin**.

Required contribution evidence:
- dedicated blind page: `/clinical-contribute-v1.html`;
- no model/Gemini/local-vision prediction is shown or invoked before the annotation is submitted;
- top image + optional bottom image;
- structured 160×160 tongue ROI/presence label and image quality;
- professional title `bac_si` or `y_si`;
- professional identifier is hashed in the browser; the raw identifier is not stored;
- professional attestation is mandatory;
- Admin must review and approve the contribution;
- the same contributor hash counts at most once for a case.

A case becomes adjudication-eligible only when it has **two distinct approved contributor hashes**. The adjudicator must be a third person whose identity is already represented by at least one Admin-approved verified clinical contribution and must differ from both source annotators.

Legacy arbitrary reviewer sessions were disabled. Policy v2 disables direct legacy gold-annotation sessions and restricts holdout-ready gold to source annotations linked to approved verified clinical contributions.

This is an **in-app professional attestation + Admin review** workflow. It does not claim that the app has independently queried or verified a government licensing registry.

## Silver textbook lane

`silver-textbook-teacher-v1` is live and contains the existing 479 teaching-material-derived samples.

Silver is allowed for bootstrap/pretraining, pre-annotation, regression, ablation, annotation-tool QA and candidate development.

Silver is forbidden from:
- becoming gold by renaming/relabeling;
- entering the clinical gold holdout;
- being used for clinical-accuracy claims;
- auto-promotion or production activation.

## Live gate state

- verified clinical contributions: **0**
- approved verified contributions: **0**
- verified gold annotations: **0**
- verified gold experts: **0**
- gold-ready adjudicated samples: **0**
- locked holdouts: **0**
- gold evaluations: **0**
- physical shadow evidence: **0**
- promotion reviews: **0**
- active legacy reviewer sessions: **0**
- supervised training-ready v3: **0**
- silver teaching-material samples: **479**

No values above are fabricated. Until real clinicians submit contributions, the gold gate remains blocked.

## Infrastructure already live

Supabase:
- verified clinical contribution table/submission RPC;
- Admin review → immutable gold annotation bridge;
- verified-clinical-only gold source view/policy;
- verified clinician adjudicator-session bridge;
- immutable holdout;
- gold metric storage/evaluator gate;
- physical-device evidence storage;
- manual promotion evidence gate;
- supervised training readiness v3;
- silver textbook teacher dataset registry.

Branch UI:
- `public/clinical-contribute-v1.html`;
- Admin Center contribution approval and gold-progress panel;
- Admin-generated 72h adjudication links for previously approved verified clinicians;
- `public/gold-review-v1.html` for adjudication;
- physical shadow harness remains separate and blocked until gold metrics.

## Resume rule

Always read `ml/checkpoints/stage2-gold-to-promotion-v1.json` first.

Continue from the first incomplete real-data gate. Do not recreate finished infrastructure. Do not substitute textbook/silver/model labels for verified clinical gold. Do not run holdout, claim gold metrics, record physical shadow PASS, or review promotion until the preceding gate has real evidence.
