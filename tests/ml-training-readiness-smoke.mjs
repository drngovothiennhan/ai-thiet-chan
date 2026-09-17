import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const interchangeSql=await readFile(new URL('../db/migrations/20260916_ai_thiet_chan_ml_interchange_v1.sql',import.meta.url),'utf8');
const sql=await readFile(new URL('../db/migrations/20260917_ai_thiet_chan_ml_training_readiness_v2.sql',import.meta.url),'utf8');

assert.match(interchangeSql,/split text not null check \(split in \('train','validation','test'\)\)/i);
const syncCase=interchangeSql.match(/create or replace function public\.ai_thiet_chan_sync_ml_case_v1\(p_case_id uuid\)([\s\S]*?)\n\$\$;/i)?.[1] ?? '';
assert.ok(syncCase,'ML case sync function must be present');
assert.match(syncCase,/substr\(c\.image_hash,1,2\)/i,'split must be derived from stable case/image content, not runtime randomness');
assert.match(syncCase,/hashtext\(coalesce\(c\.image_hash,c\.id::text\)\)/i,'split fallback must remain deterministic');
assert.match(syncCase,/v_split := case when v_bucket < 205 then 'train' when v_bucket < 230 then 'validation' else 'test' end/i);
assert.doesNotMatch(syncCase,/\brandom\s*\(/i,'dataset split must never be reassigned randomly during resync');
assert.match(syncCase,/v_label_status text := 'model_generated_unverified'/i);
assert.match(syncCase,/if v_human is not null then v_label_status := 'clinician_feedback_approved'/i);
assert.match(syncCase,/'training_policy','model_observation_is_not_ground_truth'/i);

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
assert.match(sql,/trainingReadyTrain/);
assert.match(sql,/trainingReadyValidation/);
assert.match(sql,/trainingReadyTest/);
assert.match(sql,/ai_thiet_chan_feedback_case_id_idx/);
assert.match(sql,/ai_thiet_chan_learned_knowledge_case_id_idx/);
assert.match(sql,/revoke all on public\.ai_thiet_chan_ml_training_ready_v2 from anon, authenticated/i);

const trainingReadyView=sql.match(/create or replace view public\.ai_thiet_chan_ml_training_ready_v2 as([\s\S]*?)revoke all on public\.ai_thiet_chan_ml_training_ready_v2/i)?.[1] ?? '';
assert.ok(trainingReadyView,'training-ready view definition must be present');
assert.match(trainingReadyView,/label_status='clinician_feedback_approved'/);
assert.match(trainingReadyView,/human_annotation is not null/);
assert.match(trainingReadyView,/jsonb_typeof\(m\.human_annotation\)='object'/);
assert.match(trainingReadyView,/human_annotation->>'clinical_note'/);
assert.match(trainingReadyView,/integrity_sha256/);
assert.doesNotMatch(trainingReadyView,/label_status='model_generated_unverified'/i,'unverified model observations must never enter the training-ready view');

assert.match(sql,/from public\.ai_thiet_chan_ml_training_ready_v2 m/i,'training export must read only the approved training-ready view');
assert.match(sql,/where p_split is null or m\.split=p_split/i,'training export must preserve the locked train\/validation\/test split');
assert.match(sql,/'human_annotation',m\.human_annotation/i,'approved human annotation must be the supervised label payload');
assert.match(sql,/'model_observation_reference',jsonb_build_object\('present',m\.model_observation is not null\)/i,'model output may be referenced only as provenance/presence metadata');
assert.doesNotMatch(sql,/'model_observation'\s*,\s*m\.model_observation/i,'raw model observations must not be exported as supervised labels');
assert.match(sql,/revoke all on function public\.ai_thiet_chan_admin_export_ml_training_jsonl_v2\(text,integer,text,boolean\) from public, anon, authenticated/i);

console.log('ML TRAINING READINESS PASS: deterministic train/validation/test splits are locked; only clinician-approved human annotations enter supervised training export; model observations remain non-ground-truth.');
