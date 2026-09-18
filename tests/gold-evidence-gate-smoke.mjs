import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateRows,decodeRle,diceIou} from '../ml/evaluation/evaluate_gold_holdout.mjs';

const goldSql=await readFile(new URL('../db/migrations/20260918_ai_thiet_chan_gold_annotation_holdout_v1.sql',import.meta.url),'utf8');
const gateSql=await readFile(new URL('../db/migrations/20260918_ai_thiet_chan_promotion_evidence_gate_v2.sql',import.meta.url),'utf8');
const policy=JSON.parse(await readFile(new URL('../ml/gold/gold-holdout-policy-v1.json',import.meta.url),'utf8'));
const guide=await readFile(new URL('../ml/gold/INDEPENDENT-GOLD-ANNOTATION-v1.md',import.meta.url),'utf8');
const harness=await readFile(new URL('../public/device-shadow-validation-v3.html',import.meta.url),'utf8');
const shadow=await readFile(new URL('../public/local-vision/shadow-pixel-mlp.js',import.meta.url),'utf8');

assert.match(goldSql,/ai_thiet_chan_gold_pool_v1/);
assert.match(goldSql,/group_hash text not null check \(group_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/i);
assert.match(goldSql,/ai_thiet_chan_gold_annotations_v1/);
assert.match(goldSql,/gold_evidence_is_immutable/);
assert.match(goldSql,/before update or delete\s+on public\.ai_thiet_chan_gold_annotations_v1/i);
assert.match(goldSql,/two_independent_annotators_required/);
assert.match(goldSql,/adjudicator_must_be_independent/);
assert.match(goldSql,/ai_thiet_chan_gold_ready_v1/);

const blindFn=goldSql.match(/create or replace function public\.ai_thiet_chan_admin_export_blind_gold_packet_v1[\s\S]*?\n\$function\$;/i)?.[0]||'';
assert.ok(blindFn,'blind annotation packet function missing');
assert.match(blindFn,/'model_output_included',false/i);
assert.match(blindFn,/'other_annotator_output_included',false/i);
assert.doesNotMatch(blindFn,/model_observation|analysis[^_a-z]/i,'blind packet must not expose model output or case analysis');

assert.match(goldSql,/selection_policy text not null default 'group_sha256_mod5_bucket0'/i);
assert.match(goldSql,/substr\(group_hash,1,8\).*% 5\)=0/is);
assert.match(goldSql,/gold_holdout_empty/);
assert.match(goldSql,/gold_holdout_versions_immutable_v1/);
assert.match(goldSql,/gold_holdout_members_immutable_v1/);
assert.equal(policy.lockedBeforeGoldLabels,true);
assert.equal(policy.selection.unit,'group_hash');
assert.equal(policy.selection.holdoutBucket,0);
assert.equal(policy.selection.approximateFraction,.2);
assert.match(guide,/two annotations from different annotators/i);
assert.match(guide,/must not see the candidate model output/i);
assert.match(guide,/separate adjudicator/i);

assert.match(gateSql,/ai_thiet_chan_gold_evaluations_v1/);
assert.match(gateSql,/ai_thiet_chan_device_shadow_evidence_v1/);
assert.match(gateSql,/ai_thiet_chan_promotion_reviews_v2/);
assert.match(gateSql,/locked_gold_holdout_required/);
assert.match(gateSql,/physical_device_confirmation_required/);
assert.match(gateSql,/five_physical_shadow_runs_required/);
assert.match(gateSql,/shadow_harness_must_not_self_approve_quality/);
assert.match(gateSql,/promotion_evidence_gate_not_approved/);
assert.match(gateSql,/gold-metrics \+ physical-shadow \+ explicit-manual-review/);
assert.match(gateSql,/'runtimeActivation','not-connected-to-production-inference'/);

assert.match(harness,/aitc-physical-shadow-evidence-v1/);
assert.match(harness,/physicalDeviceConfirmed/);
assert.match(harness,/Chạy shadow 5 vòng/);
assert.match(harness,/qualityPassNotAssessed:true/);
assert.match(harness,/noSyntheticData:true/);
assert.doesNotMatch(harness,/tierOverride|simulateTier|mockTier/i);
assert.doesNotMatch(harness,/supabase|benchmark_record|\/api\/analyze/i,'physical shadow harness must not upload images or silently run production analysis');

assert.match(shadow,/includeMaskRle===true/);
assert.match(shadow,/roiMaskRle=encodeRle/);

const a=decodeRle({size:[2,2],counts:[0,2,2]});
const b=decodeRle({size:[2,2],counts:[0,2,2]});
assert.deepEqual(diceIou(a,b),{dice:1,iou:1,goldPixels:2,predPixels:2,intersection:2});

const sha='a'.repeat(64);
const rows=[
  {schema_version:'aitc-gold-eval-row-v1',holdout_locked:true,holdout_version:'gold-holdout-fixture',sample_id:'s1',gold:{status:'adjudicated_gold',image_quality:'usable',tongue_present:true,roi_mask_rle:{size:[2,2],counts:[0,2,2]}},candidate:{model_sha256:sha,tongue_present:true,roi_mask_rle:{size:[2,2],counts:[0,2,2]}}},
  {schema_version:'aitc-gold-eval-row-v1',holdout_locked:true,holdout_version:'gold-holdout-fixture',sample_id:'s2',gold:{status:'adjudicated_gold',image_quality:'usable',tongue_present:false,roi_mask_rle:null},candidate:{model_sha256:sha,tongue_present:false,roi_mask_rle:null}}
];
const result=evaluateRows(rows);
assert.equal(result.schemaVersion,'aitc-gold-holdout-metrics-v1');
assert.equal(result.metricSemantics,'agreement with independent adjudicated gold for tongue presence/ROI; not clinical diagnostic accuracy');
assert.equal(result.presence.tp,1);
assert.equal(result.presence.tn,1);
assert.equal(result.presence.accuracy,1);
assert.equal(result.roi.meanDice,1);
assert.equal(result.roi.meanIoU,1);
assert.equal(result.promotionDecision,'none');
assert.equal(result.productionActivation,'none');

assert.throws(()=>evaluateRows([{...rows[0],holdout_locked:false}]),/HOLDOUT_MUST_BE_LOCKED/);
assert.throws(()=>evaluateRows([{...rows[0],gold:{...rows[0].gold,status:'weak_label'}}]),/ADJUDICATED_GOLD_REQUIRED/);

console.log('GOLD EVIDENCE GATE PASS: annotation is blind and independently adjudicated; holdout policy is predeclared and immutable; metrics require locked gold; physical shadow cannot self-approve; promotion is evidence-gated and manual.');
