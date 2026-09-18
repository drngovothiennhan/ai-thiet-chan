# LLM analysis priorities v1

## Locked principle
The LLM is a **post-analysis reasoning layer**. It never receives raw image data and never creates visual observations. Local vision owns image observation; the LLM only interprets structured fields, approved clinical memory, supplied knowledge and optional Thập vấn context.

## Priority order

### P0 — Structured visual observation contract — IMPLEMENTED
Highest priority because bad/ambiguous input produces bad LLM reasoning even when the language model itself is strong.

Implemented:
- `aitc-llm-observation-context-v2`;
- `tongue-dual-view-feature-vector-v2`;
- explicit `morphology.medianSulcus` separate from `morphology.fissure`;
- `legacyDarkLineSignal` cannot be called a fissure;
- fissure depth cannot be inferred from a 2D image;
- `unknown` must remain unknown;
- chat/report prompts receive sanitized structured context rather than arbitrary ML internals.

### P1 — Dedicated local morphology models — NEXT MODEL PRIORITY
Train/validate dedicated local classifiers or segmentation-derived measurements for:
1. median sulcus prominence/orientation;
2. fissure presence;
3. fissure branching/pattern/location;
4. toothmarks;
5. tongue swelling/thinness.

Until a task has a validated model or verified clinician label, its structured status remains `unknown`.

### P2 — Coating and surface morphology
Improve separate structured fields for:
- coating color;
- coating thickness;
- coating distribution;
- coating texture;
- moisture/dryness.

Do not collapse these into one free-text field. The LLM should reason from explicit fields with confidence/limitations.

### P3 — Approved clinical memory
Already wired through `ai_thiet_chan_find_learned_cases_v2`.

Priority improvements:
- match on verified structured morphology, not only coarse global features;
- expose source type and agreement/disagreement;
- preserve conflicts instead of silently choosing one clinician contribution.

### P4 — Thập vấn fusion
The LLM should combine:
- structured local-vision observations;
- approved clinical memory;
- the 10-group Thập vấn answers;
- supplied YHCT knowledge.

Every conclusion must identify whether it comes from image observation, questioning, approved clinical memory or supplied knowledge.

### P5 — Reliability and failover
Keep text-only LLM failover independent of image analysis. If the LLM is unavailable, the local structured result must remain usable. No provider failure may cause fabricated visual findings.

## Promotion rule
None of the priorities above allow automatic production promotion. New visual models remain shadow-only until locked-gold metrics + physical-device shadow evidence + explicit manual review pass.
