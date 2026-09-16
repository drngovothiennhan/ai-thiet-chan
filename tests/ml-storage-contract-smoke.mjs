import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sql=await readFile(new URL('../db/migrations/20260916_ai_thiet_chan_ml_interchange_v1.sql',import.meta.url),'utf8');

assert.match(sql,/ai_thiet_chan_ml_samples/);
assert.match(sql,/aitc-ml-jsonl-v1/);
assert.match(sql,/on delete cascade/i);
assert.match(sql,/enable row level security/i);
assert.match(sql,/revoke all on public\.ai_thiet_chan_ml_samples from anon, authenticated/i);
assert.match(sql,/model_observation_is_not_ground_truth/);
assert.match(sql,/clinician_feedback_approved/);
assert.match(sql,/human_annotation/);
assert.match(sql,/integrity_sha256/);
assert.match(sql,/extensions\.digest/);
assert.match(sql,/ai_thiet_chan_cases_ml_sync_v1/);
assert.match(sql,/ai_thiet_chan_learned_ml_sync_v1/);
assert.match(sql,/ai_thiet_chan_admin_ml_dataset_status_v1/);
assert.match(sql,/ai_thiet_chan_admin_export_ml_jsonl_v1/);
assert.match(sql,/p_include_images boolean default false/);
assert.match(sql,/train','validation','test/);
assert.match(sql,/content-addressed references/);

console.log('ML STORAGE CONTRACT PASS: portable JSONL schema, content-addressed inputs, provenance, human/model label separation, SHA-256 integrity and automatic resync are versioned.');
