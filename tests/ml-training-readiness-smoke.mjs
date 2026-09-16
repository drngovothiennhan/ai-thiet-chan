import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sql=await readFile(new URL('../db/migrations/20260917_ai_thiet_chan_ml_training_readiness_v2.sql',import.meta.url),'utf8');

assert.match(sql,/ai_thiet_chan_ml_training_ready_v2/);
assert.match(sql,/label_status='clinician_feedback_approved'/);
assert.match(sql,/human_annotation is not null/);
assert.match(sql,/clinical_note/);
assert.match(sql,/integrity_sha256/);
assert.match(sql,/ai_thiet_chan_admin_export_ml_training_jsonl_v2/);
assert.match(sql,/ai_thiet_chan_admin_ml_training_status_v2/);
assert.match(sql,/clinician_approved_only/);
assert.match(sql,/modelGeneratedUnverified/);
assert.match(sql,/trainingReady/);
assert.match(sql,/ai_thiet_chan_feedback_case_id_idx/);
assert.match(sql,/ai_thiet_chan_learned_knowledge_case_id_idx/);
assert.match(sql,/revoke all on public\.ai_thiet_chan_ml_training_ready_v2 from anon, authenticated/i);
assert.doesNotMatch(sql,/label_status='model_generated_unverified'[^;]*training_ready/i,'unverified model observations must never enter the training-ready view');

console.log('ML TRAINING READINESS PASS: supervised export is clinician-approved only; model observations remain separate and missing FK indexes are added.');
