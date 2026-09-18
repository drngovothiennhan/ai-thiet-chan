import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sql=await readFile(new URL('../db/migrations/20260917_ai_thiet_chan_ml_evaluation_v1.sql',import.meta.url),'utf8');

assert.match(sql,/ai_thiet_chan_ml_dataset_members_v1/);
assert.match(sql,/split text not null check \(split in \('train','validation','test'\)\)/i);
assert.match(sql,/integrity_sha256 text not null check \(integrity_sha256 ~ '\^\[0-9a-f\]\{64\}\$'\)/i);
assert.match(sql,/ml_dataset_member_is_immutable/);
assert.match(sql,/before update or delete on public\.ai_thiet_chan_ml_dataset_members_v1/i);
assert.match(sql,/insert into public\.ai_thiet_chan_ml_dataset_members_v1\(dataset_version,sample_id,split,integrity_sha256\)/i);
assert.match(sql,/from public\.ai_thiet_chan_ml_training_ready_v2/i,'dataset membership must materialize only clinician-approved training-ready samples');
assert.match(sql,/dataset_snapshot_membership_mismatch/);
assert.match(sql,/dataset_version_hash_collision/);

assert.match(sql,/ai_thiet_chan_ml_evaluations_v1/);
assert.match(sql,/protocol_version text not null default 'aitc-ml-evaluation-v1'/i);
assert.match(sql,/test_manifest_sha256 text not null/i);
assert.match(sql,/test_count integer not null check \(test_count > 0\)/i);
assert.match(sql,/baseline_ref text not null/i);
assert.match(sql,/metric_results jsonb not null/i);
assert.match(sql,/calibration_results jsonb not null/i);
assert.match(sql,/baseline_metrics jsonb not null/i);
assert.match(sql,/regression_results jsonb not null/i);
assert.match(sql,/ml_evaluation_is_immutable/);
assert.match(sql,/before update or delete on public\.ai_thiet_chan_ml_evaluations_v1/i);

const exportFn=sql.match(/create or replace function public\.ai_thiet_chan_admin_export_ml_evaluation_test_v1[\s\S]*?\n\$function\$;/i)?.[0] ?? '';
assert.ok(exportFn,'locked-test export function must be present');
assert.match(exportFn,/where dataset_version=p_dataset_version and split='test'/i);
assert.match(exportFn,/dataset_test_membership_not_materialized/);
assert.match(exportFn,/dataset_snapshot_drift_detected/);
assert.match(exportFn,/m\.split <> 'test'/i);
assert.match(exportFn,/m\.integrity_sha256 <> d\.integrity_sha256/i);
assert.match(exportFn,/where d\.dataset_version=p_dataset_version and d\.split='test'/i);
assert.match(exportFn,/'human_annotation',m\.human_annotation/i);
assert.doesNotMatch(exportFn,/split='train'/i,'evaluation export must never read the train split');
assert.doesNotMatch(exportFn,/split='validation'/i,'evaluation export must never read the validation split');

const recordFn=sql.match(/create or replace function public\.ai_thiet_chan_admin_record_ml_evaluation_v1[\s\S]*?\n\$function\$;/i)?.[0] ?? '';
assert.ok(recordFn,'evaluation record function must be present');
assert.match(recordFn,/if v_model\.status <> 'candidate' then raise exception 'only_candidate_can_be_evaluated'/i);
assert.match(recordFn,/where dataset_version=v_dataset\.dataset_version and split='test'/i);
assert.match(recordFn,/dataset_snapshot_membership_not_materialized/);
assert.match(recordFn,/dataset_test_membership_not_materialized/);
assert.match(recordFn,/dataset_snapshot_drift_detected/);
assert.match(recordFn,/baseline_ref_required/);
assert.match(recordFn,/error_metrics_required/);
assert.match(recordFn,/task_metrics_required/);
assert.match(recordFn,/calibration_contract_invalid/);
assert.match(recordFn,/regression_comparison_required/);
assert.match(recordFn,/'comparison_scope','candidate-and-baseline-on-same-locked-test-snapshot'/i);
assert.match(recordFn,/'promotion_policy','evidence-only-manual-review-required'/i);
assert.match(recordFn,/'runtime_activation','none'/i);
assert.match(recordFn,/'promotionDecision','none'/i);
assert.match(recordFn,/'manualReviewRequired',true/i);
assert.doesNotMatch(recordFn,/status\s*=\s*'champion'/i,'evaluation evidence must never promote a model');
assert.doesNotMatch(recordFn,/ai_thiet_chan_admin_promote_ml_champion_v1/i,'evaluation must not invoke promotion');
assert.doesNotMatch(recordFn,/ai_thiet_chan_admin_rollback_ml_champion_v1/i,'evaluation must not invoke rollback');

assert.match(sql,/revoke all on public\.ai_thiet_chan_ml_dataset_members_v1 from anon, authenticated/i);
assert.match(sql,/revoke all on public\.ai_thiet_chan_ml_evaluations_v1 from anon, authenticated/i);
assert.match(sql,/grant execute on function public\.ai_thiet_chan_admin_export_ml_evaluation_test_v1\(text,text,boolean\) to service_role/i);
assert.match(sql,/grant execute on function public\.ai_thiet_chan_admin_record_ml_evaluation_v1\(text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb\) to service_role/i);
assert.match(sql,/'autoPromotion',false/i);

console.log('ML EVALUATION CONTRACT PASS: exact immutable dataset membership is materialized; candidate evaluation uses only the locked test split, records real error/calibration/baseline regression evidence, rejects drift, and cannot auto-promote or activate production inference.');
