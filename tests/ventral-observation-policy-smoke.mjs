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
  assert.equal(out.vesselColor.status,'unknown','legacy v2 fixtures must not fabricate vessel color');
}
const weak={...realImageFixtures[0],rightDarkLineRatio:.03,bilateralSignal:true};
assert.equal(interpretVentralObservation(weak,{grade:'good'}).bilateralStructureVisible,false);
assert.equal(interpretVentralObservation(realImageFixtures[0],{grade:'poor'}).bilateralStructureVisible,false);
const unitColorFixture={
  schemaVersion:'bottom-device-feature-v3',
  leftDarkLineRatio:.09,rightDarkLineRatio:.08,bilateralBalance:.88,leftRowContinuity:.78,rightRowContinuity:.79,bilateralSignal:true,
  vesselColorSamplePixels:48,vesselMeanR:.34,vesselMeanG:.21,vesselMeanB:.42,vesselMeanSaturation:.46,vesselMeanValue:.42,
  vesselBluePurpleRatio:.66,vesselRedPurpleRatio:.12,vesselDarkPurpleRatio:.35,vesselVsMucosaChromaDelta:.032
};
const color=interpretVentralObservation(unitColorFixture,{grade:'good'});
assert.equal(color.bilateralStructureVisible,true);
assert.equal(color.vesselColor.status,'blue-purple');
assert.equal(color.vesselColor.label,'xanh-tím');
assert.equal(color.productionEligible,false);
assert.match(color.vesselColor.rule,/không.*huyết ứ|không.*stasis/i);
const lowColor=interpretVentralObservation({...unitColorFixture,vesselColorSamplePixels:4},{grade:'good'});
assert.equal(lowColor.vesselColor.status,'unknown');
assert.equal(VENTRAL_OBSERVATION_POLICY_VERSION,'ventral-structure-color-policy-v2');

console.log('VENTRAL OBSERVATION POLICY PASS: legacy owner fixtures preserve bilateral structure detection without fabricated color; v3 color is QC/sample-gated and venous disease/stasis inferences remain forbidden.');
