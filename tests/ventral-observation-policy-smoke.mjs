import assert from 'node:assert/strict';
import {interpretVentralObservation,VENTRAL_OBSERVATION_POLICY_VERSION} from '../ventral-observation-policy.mjs';

const realImageFixtures=[
  {schemaVersion:'bottom-device-feature-v2',leftDarkLineRatio:.1597,rightDarkLineRatio:.0536,bilateralBalance:.3357,leftRowContinuity:.803,rightRowContinuity:.7424,bilateralSignal:true},
  {schemaVersion:'bottom-device-feature-v2',leftDarkLineRatio:.0742,rightDarkLineRatio:.0842,bilateralBalance:.8815,leftRowContinuity:.7273,rightRowContinuity:.803,bilateralSignal:true},
  {schemaVersion:'bottom-device-feature-v2',leftDarkLineRatio:.0926,rightDarkLineRatio:.0799,bilateralBalance:.8631,leftRowContinuity:.7727,rightRowContinuity:.7727,bilateralSignal:true}
];
for(const fixture of realImageFixtures){
  const out=interpretVentralObservation(fixture,{grade:'fair'});
  assert.equal(out.active,true);
  assert.equal(out.bilateralStructureVisible,true);
  assert.ok(out.forbiddenInferences.includes('stasis'));
}
const weak={...realImageFixtures[0],rightDarkLineRatio:.03,bilateralSignal:true};
assert.equal(interpretVentralObservation(weak,{grade:'good'}).bilateralStructureVisible,false);
assert.equal(interpretVentralObservation(realImageFixtures[0],{grade:'poor'}).bilateralStructureVisible,false);
assert.equal(VENTRAL_OBSERVATION_POLICY_VERSION,'ventral-structure-policy-v1');

console.log('VENTRAL OBSERVATION POLICY PASS: three owner-supplied underside-image feature fixtures pass the bilateral visible-structure gate; disease-level venous inferences remain forbidden.');
