# AITC-LLM-Case-Reasoning-v1 — execution checkpoint

Branch: `restructure-local-vision-v1`

## Locked scope
Build a provenance-first text corpus for educational case reasoning and consultation support without interrupting the running app.

This lane is independent from the Local Vision image authority. Raw images / inline media remain forbidden from cloud LLM calls.

## Gold / verified-clinician policy change
For the **LLM case-reasoning lane**, verified clinician gold is now an **optional advisory quality boost**, not an operational gate.

Therefore it does **not** block:
- app availability;
- source ingestion;
- deduplication;
- RAG/retrieval;
- educational SFT candidate generation;
- ordinary text consultation fallback.

Verified doctor/physician evidence can later receive a higher provenance/trust rank during consultation. It remains useful for evaluation and expert refinement, but absence of such labels must not stop this learning-oriented application.

This scope change does not automatically promote a vision model or claim clinical accuracy.

## Stage 1 — source registry
Created:
- `llm/case-reasoning/source-registry.v1.json`

Initial sources:
1. `tcmchat-medical-case-sft-v1`
   - ZJUFanLab/TCMChat-dataset-600k
   - `sft/train/medical_case.json`
   - Apache-2.0
   - upstream SHA-256 pinned.
2. `pmc-ccby-cc0-case-reports-v1`
   - PubMed Central rights-verified case reports
   - license allowlist restricted to CC0 / CC BY / CC BY-SA.
3. `aitc-verified-clinician-advisory-v1`
   - optional expert advisory evidence;
   - not an operational prerequisite.

## Stage 2 — ingest + deduplicate
Created:
- `scripts/case-reasoning-ingest.mjs`

Controls:
- source must exist in registry;
- optional upstream SHA-256 verification;
- common SFT / QA / conversation schemas normalized;
- exact dedup by SHA-256;
- near dedup by 64-bit SimHash with 4x16-bit candidate buckets and Hamming distance <= 3;
- conservative email redaction;
- provenance and license retained per record;
- no dependency on production runtime or Supabase.

## Stage 3 — initial sources
Created:
- `llm/case-reasoning/seeds/tcmchat-medical-case.remote.v1.json`
- `llm/case-reasoning/seeds/pmc-ccby-initial.v1.json`
- `llm/case-reasoning/generated/pmc-ccby-initial.v1.jsonl`

TCMChat is pinned as a remote 84.6 MB source and is intentionally not vendored into Git. The importer verifies its published SHA-256 before normalization.

The first PMC seed contains six CC BY 4.0 case reports selected for TCM/integrated-medicine case reasoning, including one high-priority tongue case. Each record keeps PMID/PMCID/DOI/license/source URL and a paraphrased case structure.

## Resume order
1. Run CI smoke test.
2. When a network-capable offline data job is available, download the pinned TCMChat medical-case file.
3. Verify SHA-256, normalize and deduplicate through `case-reasoning-ingest.mjs`.
4. Expand PMC acquisition only through per-article rights verification.
5. Build retrieval/index snapshots from normalized records.
6. Do not block ordinary application operation on expert-gold availability.
7. Do not merge/promote production solely because corpus preparation passes.

No fabricated clinical counts, no fabricated accuracy, and no synthetic gold.
