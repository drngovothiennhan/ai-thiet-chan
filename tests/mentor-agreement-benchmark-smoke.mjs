import assert from 'node:assert/strict';
import {evaluateVisualMentorAgreement,VISUAL_MENTOR_FIELDS} from '../ml/evaluation/evaluate_visual_mentor_agreement.mjs';

const labels={
  bodyColor:'đỏ nhạt',
  coatingColor:'trắng',
  coatingThickness:'mỏng',
  coatingDistribution:'trung tâm–sau',
  medianSulcus:'visible-signal',
  fissure:'unknown',
  moistureSurface:'balanced',
  moistureBody:'balanced',
  moistureCoating:'balanced',
  ventralBilateralStructure:true
};
const passRows=Array.from({length:50},(_,i)=>({
  schemaVersion:'aitc-visual-mentor-row-v1',
  sampleId:'pass-'+i,
  independentHoldout:true,
  qc:{grade:'good'},
  mentor:{...labels},
  candidate:{...labels}
}));
const pass=evaluateVisualMentorAgreement(passRows);
assert.equal(pass.productionPromotionEligible,true);
assert.equal(pass.clinicalAccuracy,false);
assert.equal(pass.micro.agreement,1);
assert.equal(pass.macro.agreement,1);
assert.equal(pass.insufficientSupportFields.length,0);
assert.equal(Object.keys(pass.fields).length,VISUAL_MENTOR_FIELDS.length);

const mismatch=passRows.map((row,i)=>({...row,sampleId:'mismatch-'+i,candidate:{...row.candidate,moistureCoating:i<3?'dry':row.candidate.moistureCoating}}));
const failed=evaluateVisualMentorAgreement(mismatch);
assert.equal(failed.productionPromotionEligible,false);
assert.ok(failed.fields.moistureCoating.agreement<.95);

const leak=passRows.map((row,i)=>i===0?{...row,sampleId:'leak-0',qc:{grade:'poor'}}:{...row,sampleId:'leak-'+i});
const leakResult=evaluateVisualMentorAgreement(leak);
assert.equal(leakResult.productionPromotionEligible,false);
assert.ok(leakResult.safetyLeaks>0);

console.log('VISUAL MENTOR BENCHMARK SMOKE PASS: 95% is enforced as independent structured-observation agreement, with fail-closed safety and no clinical-accuracy claim.');
