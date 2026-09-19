import assert from 'node:assert/strict';
import {interpretSpatialObservation,SPATIAL_OBSERVATION_POLICY_VERSION} from '../spatial-observation-policy.mjs';

const mentorFixture={
  schemaVersion:'tongue-spatial-observation-v1',
  roiCoverage:.24,
  bodyLuma:.444,
  bodySaturation:.3765,
  bodyColorCandidate:'đỏ nhạt',
  coatingCandidateRatio:.2714,
  coatingThicknessCandidate:'mỏng',
  coatingDistributionCandidate:'trung tâm–sau',
  coatingZones:{central:.6996,middle:.4648,posterior:.2696,anterior:.1266},
  medianSulcus:{
    visibleSignal:true,
    score:1,
    continuity:.5536,
    centrality:.7556,
    meanDarkContrast:.03,
    source:'deterministic-symmetry-relative-dark-line-v1'
  },
  fissurePolicy:'median-sulcus-is-not-pathological-fissure',
  authority:'direct-image-observation-only'
};

const fair=interpretSpatialObservation(mentorFixture,{grade:'fair'});
assert.equal(fair.active,true);
assert.equal(fair.coatingDistribution,'trung tâm–sau');
assert.equal(fair.medianSulcus.status,'visible-signal');
assert.equal(fair.fissure.status,'unknown');
assert.match(fair.fissure.rule,/không được tự chuyển thành nứt lưỡi bệnh lý/i);

const below=structuredClone(mentorFixture);
below.medianSulcus={...below.medianSulcus,visibleSignal:false,score:.45,continuity:.12};
const gated=interpretSpatialObservation(below,{grade:'fair'});
assert.equal(gated.medianSulcus.status,'unknown');
assert.equal(gated.fissure.status,'unknown');

const poor=interpretSpatialObservation(mentorFixture,{grade:'poor'});
assert.equal(poor.active,false);
assert.equal(poor.coatingDistribution,'Không xác định');
assert.equal(poor.medianSulcus.status,'unknown');

const noCoat=structuredClone(mentorFixture);
noCoat.coatingCandidateRatio=.06;
const coatGate=interpretSpatialObservation(noCoat,{grade:'good'});
assert.equal(coatGate.coatingDistribution,'Không xác định');

assert.equal(SPATIAL_OBSERVATION_POLICY_VERSION,'tongue-spatial-policy-v1');
console.log('SPATIAL OBSERVATION POLICY PASS: strong symmetry-relative median sulcus and coating distribution can be surfaced as direct observations, while fissure remains unknown and poor-QC input fails closed.');
