# Serve-and-learn dual lane v1

## Goal
Keep A.I Thiệt Chẩn available for normal analysis while approved learning evidence accumulates and produces new **shadow-only** model candidates in parallel.

The serving model is never mutated in-place by new data.

## Open-source/reference patterns reviewed

### River
Reference: https://github.com/online-ml/river

Pattern adopted:
- event-based learning flow;
- incremental/stream-oriented data handling;
- progressive learning state rather than stopping serving to rebuild the whole application.

Difference in A.I Thiệt Chẩn:
- model weights are **not** updated one sample at a time in production;
- events produce immutable supervised snapshots first because medical-image evaluation must preserve a locked holdout.

### Avalanche
Reference: https://github.com/ContinualAI/avalanche

Pattern adopted:
- continual-learning train/evaluation separation;
- replay/rehearsal to reduce forgetting;
- candidate evaluation remains separate from the current serving model.

Difference in A.I Thiệt Chẩn:
- replay source is the explicitly non-gold `silver-textbook-teacher-v1` dataset;
- verified clinical labels enter training only after independent adjudication;
- no continual-learning candidate can auto-promote.

### MONAI Label
Reference: https://github.com/Project-MONAI/MONAILabel

Pattern adopted:
- annotation and learning are connected, but human annotation evidence remains auditable;
- new labels can feed future model learning without blocking the active application.

Difference in A.I Thiệt Chẩn:
- accepted clinical gold source is restricted to the verified contribution workflow already defined for this project;
- prospective holdout groups are excluded before any continual-training snapshot is built.

## Runtime/data flow

```
SERVING LANE
capture -> local vision -> server verification/fusion -> consultation -> response
                           |
                           +-- serving remains available even if learning is idle/fails

LEARNING LANE
verified Bác sĩ/Y sĩ contribution
 -> Admin approval
 -> second independent contributor
 -> independent adjudication
 -> prospective holdout firewall
 -> immutable continual snapshot
 -> silver replay + supervised non-holdout labels
 -> shadow candidate training job
 -> internal validation
 -> locked gold metrics
 -> physical-device shadow
 -> manual promotion review only
```

## Holdout firewall
The gold selection rule is predeclared as `group_sha256_mod5_bucket0`.

Therefore every continual snapshot excludes any group satisfying that rule **before training**, not merely after a holdout version is created. This prevents a future gold-holdout group from first leaking into candidate training.

## Live-memory path
Admin-approved verified clinician contributions are also exposed through `ai_thiet_chan_find_learned_cases_v2`. This allows the consultation layer to retrieve approved clinician evidence while the visual model remains unchanged.

This memory path is separate from model-weight training and does not turn a single clinician contribution into gold.

## Model-learning path
Only **adjudicated, usable, verified-clinician evidence outside the prospective holdout** enters continual snapshots.

Each snapshot:
- is immutable;
- records member hashes and annotation hashes;
- queues a training job;
- references `silver-textbook-teacher-v1` for replay;
- creates only a candidate/shadow model artifact;
- cannot mutate the serving runtime;
- cannot promote automatically.

Trainer:
`ml/training/train_continual_roi_mlp.py`

Worker contract:
`db/migrations/20260918_ai_thiet_chan_continual_worker_contract_v1.sql`

## Resume rule
Read `ml/checkpoints/stage2-gold-to-promotion-v1.json` first.

Do not bypass:
verified independent clinical labels -> adjudication -> holdout -> real metric -> physical shadow -> manual promotion.
