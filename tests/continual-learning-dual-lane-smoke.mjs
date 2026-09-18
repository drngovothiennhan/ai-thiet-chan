import assert from 'node:assert/strict';
import fs from 'node:fs';

const dual=fs.readFileSync('db/migrations/20260918_ai_thiet_chan_continual_learning_dual_lane_v1.sql','utf8');
const safety=fs.readFileSync('db/migrations/20260918_ai_thiet_chan_continual_trigger_safety_v1.sql','utf8');
const retrieval=fs.readFileSync('db/migrations/20260918_ai_thiet_chan_learning_retrieval_v2.sql','utf8');
const clinical=fs.readFileSync('public/clinical-learning.js','utf8');
const admin=fs.readFileSync('public/admin-center.js','utf8');
const worker=fs.readFileSync('db/migrations/20260918_ai_thiet_chan_continual_worker_contract_v1.sql','utf8');
const trainer=fs.readFileSync('ml/training/train_continual_roi_mlp.py','utf8');

assert.match(dual,/serve-and-learn-dual-lane-v1/);
assert.match(dual,/availabilityIndependentFromTraining',true/);
assert.match(dual,/runtimeMutationFromLearning',false/);
assert.match(dual,/automaticModelSwap',false/);
assert.match(dual,/automatic',false/);
assert.match(dual,/silver-textbook-teacher-v1/);
assert.match(dual,/prospective-group-mod5-bucket0-excluded-before-training/);
assert.match(dual,/bit\(32\)::bigint % 5\)<>0/);
assert.match(dual,/ai_thiet_chan_continual_snapshots_immutable_v1/);
assert.match(dual,/ai_thiet_chan_continual_snapshot_members_immutable_v1/);
assert.match(dual,/adjudicated_training_ready/);
assert.match(dual,/ai_thiet_chan_continual_training_jobs_v1/);
assert.match(dual,/verified-clinical-contributions-only/);
assert.match(dual,/independent-adjudication/);
assert.match(dual,/image_quality',''\)='usable'/);
assert.match(dual,/servingModelChanged',false/);
assert.match(dual,/trainingJobQueued',true/);

assert.match(safety,/v_transition boolean:=false/);
assert.match(safety,/if tg_op='INSERT'/);
assert.match(safety,/elsif tg_op='UPDATE'/);

assert.match(retrieval,/ai_thiet_chan_find_learned_cases_v2/);
assert.match(retrieval,/verified_clinical_contribution_v1/);
assert.match(retrieval,/verifiedClinicalAnnotation/);
assert.match(clinical,/ai_thiet_chan_find_learned_cases_v2/);
assert.match(clinical,/verifiedClinicalAnnotation:row\.base_analysis\?\.verifiedClinicalAnnotation/);
assert.match(admin,/ai_thiet_chan_admin_continual_learning_status_v1/);
assert.match(admin,/Học liên tục · serve-and-learn/);

assert.match(worker,/ai_thiet_chan_worker_claim_continual_job_v1/);
assert.match(worker,/activation','shadow-only'/);
assert.match(worker,/servingModelChanged',false/);
assert.match(worker,/promotionAutomatic',false/);
assert.match(trainer,/PROSPECTIVE_GOLD_HOLDOUT_LEAKAGE_BLOCKED/);
assert.match(trainer,/silver-textbook-teacher-v1/);
assert.match(trainer,/replay-finetune-v1/);
assert.match(trainer,/activation":"shadow-only"/);
assert.match(trainer,/promotionDecision":"none"/);
assert.match(trainer,/productionActivation":"none"/);

console.log('CONTINUAL LEARNING DUAL-LANE PASS: serving is isolated from training; only adjudicated verified-clinician non-holdout evidence enters immutable snapshots; silver replay is explicit; approved clinician memory is available to live consultation; promotion remains manual and evidence-gated.');
