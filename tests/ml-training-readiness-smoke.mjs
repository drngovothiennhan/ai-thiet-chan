import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const interchangeSql=await readFile(new URL('../db/migrations/20260916_ai_thiet_chan_ml_interchange_v1.sql',import.meta.url),'utf8');
const sql=await readFile(new URL('../db/migrations/20260917_ai_thiet_chan_ml_training_readiness_v2.sql',import.meta.url),'utf8');
const governanceSql=await readFile(new URL('../db/migrations/20260917_ai_thiet_chan_ml_governance_v1.sql',import.meta.url),'utf8');

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

assert.match(governanceSql,/ai_thiet_chan_ml_dataset_versions/);
assert.match(governanceSql,/ai_thiet_chan_ml_model_registry/);
assert.match(governanceSql,/ai_thiet_chan_ml_model_events/);
assert.match(governanceSql,/locked boolean not null default true check \(locked = true\)/i);
assert.match(governanceSql,/ml_dataset_version_is_immutable/);
assert.match(governanceSql,/before update or delete on public\.ai_thiet_chan_ml_dataset_versions/i);
assert.match(governanceSql,/source_schema text not null default 'aitc-ml-jsonl-v2-training-ready'/i);
assert.match(governanceSql,/from public\.ai_thiet_chan_ml_training_ready_v2/i,'dataset versions must snapshot only the approved training-ready view');
assert.match(governanceSql,/string_agg\(sample_id::text \|\| ':' \|\| integrity_sha256 \|\| ':' \|\| split/i,'dataset manifest must bind sample identity, integrity and locked split');
assert.match(governanceSql,/v_manifest_sha := encode\(extensions\.digest/i);
assert.match(governanceSql,/v_version := 'dataset-' \|\| substr\(v_manifest_sha,1,16\)/i);
assert.match(governanceSql,/'split_policy','stable-content-hash'/i);
assert.match(governanceSql,/'label_policy','clinician_approved_only'/i);

assert.match(governanceSql,/status text not null default 'candidate' check \(status in \('candidate','champion','retired'\)\)/i);
assert.match(governanceSql,/ai_thiet_chan_ml_one_champion_per_family_v1/);
assert.match(governanceSql,/where status='champion'/i);
assert.match(governanceSql,/ai_thiet_chan_admin_register_ml_model_candidate_v1/);
assert.match(governanceSql,/ai_thiet_chan_admin_promote_ml_champion_v1/);
assert.match(governanceSql,/ai_thiet_chan_admin_rollback_ml_champion_v1/);
assert.match(governanceSql,/only_candidate_can_be_promoted/);
assert.match(governanceSql,/rollback_target_must_be_retired/);
assert.match(governanceSql,/rollback_target_was_never_champion/);
assert.match(governanceSql,/event_type in \('promote','rollback'\)/i);
assert.match(governanceSql,/'promotionPolicy','manual-admin-only'/i);
assert.match(governanceSql,/'runtimeActivation','not-connected-to-production-inference'/i);
assert.match(governanceSql,/revoke all on public\.ai_thiet_chan_ml_model_registry from anon, authenticated/i);
assert.match(governanceSql,/revoke all on public\.ai_thiet_chan_ml_model_events from anon, authenticated/i);
assert.match(governanceSql,/grant execute on function public\.ai_thiet_chan_admin_promote_ml_champion_v1\(text,text,text\) to service_role/i);
assert.match(governanceSql,/grant execute on function public\.ai_thiet_chan_admin_rollback_ml_champion_v1\(text,text,text\) to service_role/i);

console.log('ML TRAINING READINESS PASS: deterministic splits and clinician-approved labels are locked; immutable dataset versions, manual candidate/champion governance, and explicit rollback are versioned without connecting model promotion to production inference.');
