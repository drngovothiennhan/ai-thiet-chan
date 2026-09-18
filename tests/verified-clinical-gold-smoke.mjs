import assert from 'node:assert/strict';
import fs from 'node:fs';

const contributionSql=fs.readFileSync('db/migrations/20260918_ai_thiet_chan_verified_clinical_contribution_gold_v1.sql','utf8');
const adjudicatorSql=fs.readFileSync('db/migrations/20260918_ai_thiet_chan_verified_adjudicator_bridge_v1.sql','utf8');
const trainingV3=fs.readFileSync('db/migrations/20260918_ai_thiet_chan_ml_training_readiness_v3.sql','utf8');
const contributionPage=fs.readFileSync('public/clinical-contribute-v1.html','utf8');
const goldReviewPage=fs.readFileSync('public/gold-review-v1.html','utf8');
const admin=fs.readFileSync('public/admin-center.js','utf8');
const releaseUi=fs.readFileSync('public/release-ui.js','utf8');
const silver=JSON.parse(fs.readFileSync('ml/silver/silver-textbook-teacher-v1.json','utf8'));

assert.match(contributionSql,/ai_thiet_chan_verified_clinical_contributions_v1/);
assert.match(contributionSql,/professional_title in \('bac_si','y_si'\)/);
assert.match(contributionSql,/professional_attested boolean not null check \(professional_attested=true\)/);
assert.match(contributionSql,/app_professional_attestation_admin_approved/);
assert.match(contributionSql,/ai_thiet_chan_gold_validate_roi_v1\(p_annotation\)/);
assert.match(contributionSql,/verified-clinician-v1\|/);
assert.match(contributionSql,/count\(distinct annotator_hash\)>=2/);
assert.match(contributionSql,/model_output_used_for_annotation',false/);
assert.match(contributionSql,/grant execute on function public\.ai_thiet_chan_submit_verified_clinical_contribution_v1[\s\S]*to anon, authenticated/i);
assert.match(contributionSql,/grant execute on function public\.ai_thiet_chan_admin_review_verified_clinical_contribution_v1[\s\S]*to service_role/i);

assert.match(adjudicatorSql,/ai_thiet_chan_verified_gold_experts_v1/);
assert.match(adjudicatorSql,/approved_verified_expert_required/);
assert.match(adjudicatorSql,/reviewer_hash,role,token_hash/);
assert.match(adjudicatorSql,/e\.contributor_hash,'adjudication',v_token_hash/);
assert.match(adjudicatorSql,/policy','adjudicator must be an Admin-approved verified clinical contributor and distinct from both source annotators'/);
assert.match(trainingV3,/ai_thiet_chan_ml_training_ready_v3/);
assert.match(trainingV3,/verified_clinical_contribution_v1/);
assert.match(trainingV3,/app_professional_attestation_admin_approved/);

assert.match(contributionPage,/Mã hành nghề \/ mã xác nhận chuyên môn/);
assert.match(contributionPage,/professional_id_hash/);
assert.match(contributionPage,/professional_attested:true/);
assert.match(contributionPage,/roi_mask_rle/);
assert.match(contributionPage,/160×160/);
assert.match(contributionPage,/không chạy A\.I trước khi bạn gán nhãn/i);
assert.doesNotMatch(contributionPage,/\/api\/analyze|generativelanguage|gemini/i,'gold-eligible contribution page must not invoke model analysis');

assert.match(goldReviewPage,/model_output_included/);
assert.match(admin,/ai_thiet_chan_admin_review_verified_clinical_contribution_v1/);
assert.match(admin,/ai_thiet_chan_admin_create_verified_adjudicator_session_v1/);
assert.match(releaseUi,/clinical-contribute-v1\.html/);

assert.equal(silver.goldEligible,false);
assert.equal(silver.holdoutEligible,false);
assert.equal(silver.promotionEligible,false);
assert.equal(silver.clinicalAccuracyEligible,false);
assert.equal(silver.labelPolicy.conversionToGold,'forbidden');
assert.ok(silver.allowedUses.includes('bootstrap-training'));
assert.ok(silver.forbiddenUses.includes('gold-ground-truth'));

console.log('VERIFIED CLINICAL GOLD BRIDGE PASS: app-confirmed clinician contributions stay model-blind, require admin approval, preserve distinct-expert counting, use verified-clinician-only adjudication, and keep textbook silver evidence separate from gold.');
