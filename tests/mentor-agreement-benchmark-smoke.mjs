import assert from 'node:assert/strict';
import {evaluateVisualMentorAgreement,VISUAL_MENTOR_FIELDS} from '../ml/evaluation/evaluate_visual_mentor_agreement.mjs';
import {buildVisualMentorEvidence} from '../ml/evaluation/build_visual_mentor_evidence.mjs';

const hash=n=>String(n).padStart(64,'a').slice(-64);
const labels={
  bodyColor:'đỏ nhạt',
  coatingColor:'trắng',
  coatingThickness:'mỏng',
  coatingDistribution:'trung tâm–sau',
  medianSulcus:'visible-signal',
  fissure:'absent',
  moistureSurface:'balanced',
  moistureBody:'balanced',
  moistureCoating:'balanced',
  ventralBilateralStructure:true
};
const manifest={
  schemaVersion:'aitc-visual-mentor-holdout-v1',
  locked:true,labelBlind:true,candidateBlind:true,policyVersion:'aitc-visual-mentor-holdout-policy-v1',
  members:Array.from({length:50},(_,i)=>({
    sampleId:'pass-'+i,imageSha256:hash(i+1),groupHash:hash(i+101),
    role:i%5===0?'ventral':'dorsal',qcGrade:'good'
  }))
};
const mentor=manifest.members.map(m=>({
  schemaVersion:'aitc-visual-mentor-label-v1',sampleId:m.sampleId,imageSha256:m.imageSha256,
  blindToCandidate:true,modelOutputVisible:false,locked:true,labels:{...labels}
}));
const candidate=manifest.members.map(m=>({
  schemaVersion:'aitc-visual-candidate-observation-v1',sampleId:m.sampleId,imageSha256:m.imageSha256,
  candidateVersion:'moisture-vision-r1',labels:{...labels}
}));
const passRows=buildVisualMentorEvidence(manifest,mentor,candidate).rows;
const pass=evaluateVisualMentorAgreement(passRows);
assert.equal(pass.productionPromotionEligible,true);
assert.equal(pass.clinicalAccuracy,false);
assert.equal(pass.micro.agreement,1);
assert.equal(pass.macro.agreement,1);
assert.equal(pass.insufficientSupportFields.length,0);
assert.equal(Object.keys(pass.fields).length,VISUAL_MENTOR_FIELDS.length);
assert.match(pass.holdoutManifestSha256,/^[0-9a-f]{64}$/);
assert.equal(pass.candidateVersion,'moisture-vision-r1');

const mismatch=passRows.map((row,i)=>({...row,sampleId:'mismatch-'+i,candidate:{...row.candidate,moistureCoating:i<3?'dry':row.candidate.moistureCoating}}));
const failed=evaluateVisualMentorAgreement(mismatch);
assert.equal(failed.productionPromotionEligible,false);
assert.ok(failed.fields.moistureCoating.agreement<.95);

const leak=passRows.map((row,i)=>i===0?{...row,sampleId:'leak-0',qc:{grade:'poor'}}:{...row,sampleId:'leak-'+i});
const leakResult=evaluateVisualMentorAgreement(leak);
assert.equal(leakResult.productionPromotionEligible,false);
assert.ok(leakResult.safetyLeaks>0);

assert.throws(()=>evaluateVisualMentorAgreement(passRows.map((row,i)=>i===0?{...row,mentorBlindToCandidate:false}:row)),/MENTOR_BLIND_LOCK_REQUIRED/);
assert.throws(()=>evaluateVisualMentorAgreement(passRows.map((row,i)=>i===0?{...row,candidateVersion:'other'}:row)),/MIXED_CANDIDATE_VERSIONS/);

console.log('VISUAL MENTOR BENCHMARK SMOKE PASS: >=95% is enforced on one locked blind holdout/candidate version, with per-field gates, fail-closed safety and no clinical-accuracy claim.');
