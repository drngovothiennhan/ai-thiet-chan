# Stage 2 checkpoint — gold → holdout → metric → device shadow → promotion

Branch: `restructure-local-vision-v1`  
Start head: `26ed3f45fb26a8f8dfc9b4920c7b13021da5ce80`  
Production main observed unchanged: `07ec84ddaa677c6695a2f1112b44baf37bbf9668`

Locked execution order:
1. independent gold annotation;
2. immutable gold holdout;
3. real metrics against that holdout;
4. physical-device shadow evidence;
5. manual promotion review only.

Observed live state at checkpoint:
- 22 cases / 22 top images / 14 bottom images;
- 22 ML samples, all `model_generated_unverified`;
- 0 training-ready gold samples;
- 0 approved feedback records.

Hard rules:
- no synthetic/fabricated gold labels;
- annotators must not see model output or each other's annotation before submission;
- no gold holdout creation until independent gold exists;
- no "accuracy" claim before locked gold-holdout metrics exist;
- no physical-device PASS without a real physical run;
- no auto-promotion and no production inference activation from this branch;
- Gemini/provider vision remains forbidden.

Resume rule: read `ml/checkpoints/stage2-gold-to-promotion-v1.json`, then continue from the first gate that is not COMPLETE. Do not repeat earlier completed gates.
