# AITC LLM case-reasoning corpus

`AITC-LLM-Case-Reasoning-v1` is a provenance-first text corpus for educational case analysis and consultation retrieval.

## Ingest
```bash
node scripts/case-reasoning-ingest.mjs \
  --source-id pmc-ccby-cc0-case-reports-v1 \
  --input llm/case-reasoning/seeds/pmc-ccby-initial.v1.json \
  --output llm/case-reasoning/generated/pmc-ccby-initial.v1.jsonl \
  --state llm/case-reasoning/generated/pmc-ccby-initial.state.json
```

For TCMChat, download the pinned upstream file outside the production runtime, then run the command recorded in `seeds/tcmchat-medical-case.remote.v1.json`. The importer rejects a file when its SHA-256 does not match the pinned upstream checksum.

Gold/verified-clinician labels are advisory for this LLM lane and do not gate ingestion, retrieval or educational operation.
