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


## Stage 4 — PMC rights expansion + portable retrieval snapshot
- Added `llm/case-reasoning/seeds/pmc-ccby-expanded.v1.json` with 14 additional rights-verified CC BY 4.0 TCM/integrated-medicine cases.
- Explicitly excluded CC BY-NC, CC BY-NC-ND and non-CC special-permission records from this training seed.
- Total curated PMC seed after initial + expansion: 20 case reports.
- Added `scripts/case-reasoning-build-sqlite.py` to build a portable SQLite FTS5 retrieval snapshot from normalized JSONL sources.
- Snapshot builder deduplicates again across sources using content SHA-256 and emits a manifest with source counts, input hashes and database SHA-256.
- The snapshot is an offline/RAG artifact; it is not bundled into production and does not gate app availability.

## Next locked step
Run the isolated network data job on a dedicated non-production branch: download/checksum TCMChat -> normalize/deduplicate -> normalize the two PMC seeds -> build SQLite FTS5 snapshot -> compress artifacts -> copy the artifact bundle to Google Drive cold storage. Production remains untouched.


## Stage 5 — network ingest + Drive cold storage COMPLETE
- Isolated data branch: `data-job/aitc-llm-case-reasoning-v1`
- Data-job commit: `407d4104297c11b56b09d050478d77f9510b3d54`
- GitHub Actions run: `35322356256` — **SUCCESS**
- TCMChat source SHA-256 verified against pinned upstream hash before ingest.
- TCMChat normalized accepted: **44,623**.
- TCMChat rejected as exact duplicates: **1,491**.
- TCMChat rejected as near duplicates: **1,926**.
- PMC curated CC-compatible records: **20**.
- SQLite FTS5 snapshot records: **44,643**.
- Cross-source duplicates skipped at snapshot build: **0**.
- Snapshot SHA-256: `68aa881b8e0c31935b8040095d2277d2940a55874209b7458d1433eb6b01781e`.
- One-day GitHub handoff artifact: ID `10537966683`, size **48,867,888 bytes**, digest `sha256:caf750c635e7a94851f13e8fc69147eaecaabe47a04f9a32b8ae10acfb382c61`.
- Persistent cold-storage bundle copied to Google Drive file ID `1aC64OiQNxel9ZoMlA7NacBKvPiBHiRBV`, size **48,867,888 bytes**.
- Drive path: `A.I thiệt chẩn/03_Dataset_QC_Validated/AITC-LLM-Case-Reasoning-v1/AITC-LLM-Case-Reasoning-v1-20260918.zip`.
- Only **one physical Drive copy** is retained to avoid wasting storage; the bundle contains compressed raw source, normalized data, manifests/checksums and the retrieval snapshot.
- Production was not merged or promoted and the 84.6 MB raw dataset is not bundled into Vercel.

## Resume from here
1. Read `llm/case-reasoning/storage-manifest.v1.json` and this checkpoint first.
2. Do **not** redownload/reprocess TCMChat unless the pinned source version/checksum changes.
3. Do **not** copy the 48.9 MB bundle into Vercel runtime.
4. When connecting retrieval to the app, expose only lightweight query results / selected case chunks; keep Drive as cold storage.
5. Preserve `goldBlocksLlmOperation=false`; verified clinician evidence remains an optional advisory boost for this LLM lane.
6. Keep Local Vision as sole image-observation authority.
