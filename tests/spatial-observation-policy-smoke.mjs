import assert from 'node:assert/strict';
import {interpretSpatialObservation,SPATIAL_OBSERVATION_POLICY_VERSION} from '../spatial-observation-policy.mjs';

const mentorFixture={
  schemaVersion:'tongue-spatial-observation-v4',
  roiCoverage:.24,
  bodyLuma:.444,
  bodySaturation:.3765,
  bodyColorCandidate:'đỏ nhạt',
  coatingCandidateRatio:.3097,
  strictCoatingCandidateRatio:.2685,
  coatingColorCandidate:'trắng',
  coatingWhiteLikeRatio:.6941,
  coatingYellowLikeRatio:.0005,
  coatingThicknessCandidate:'mỏng',
  coatingDistributionCandidate:'trung tâm–sau',
  coatingZones:{central:.7324,middle:.5049,posterior:.2902,anterior:.1862},
  colorNormalization:{applied:true,neutralPixels:9891,gainR:.9973,gainG:.9982,gainB:1.0045,bounded:true},
  medianSulcus:{
    visibleSignal:true,
    score:1,
    continuity:.5862,
    centrality:.7312,
    meanDarkContrast:.0298,
    source:'deterministic-symmetry-relative-dark-line-v2'
  },
  fissurePolicy:'median-sulcus-is-not-pathological-fissure',
  authority:'direct-image-observation-only'
};

const fair=interpretSpatialObservation(mentorFixture,{grade:'fair'});
assert.equal(fair.active,true);
assert.equal(fair.bodyColorCandidate,'đỏ nhạt');
assert.equal(fair.coatingColorCandidate,'trắng');
assert.equal(fair.coatingThicknessCandidate,'mỏng');
assert.equal(fair.coatingDistribution,'trung tâm–sau');
assert.equal(fair.medianSulcus.status,'visible-signal');
assert.equal(fair.fissure.status,'unknown');
assert.match(fair.fissure.rule,/không được tự chuyển thành nứt lưỡi bệnh lý/i);

const warmLightingFixture={
  ...mentorFixture,
  coatingCandidateRatio:.103,
  strictCoatingCandidateRatio:.053,
  coatingColorCandidate:'trắng',
  coatingWhiteLikeRatio:1,
  coatingYellowLikeRatio:0,
  coatingThicknessCandidate:'mỏng',
  coatingDistributionCandidate:'không rõ',
  medianSulcus:{...mentorFixture.medianSulcus,visibleSignal:false,score:.61,continuity:.28}
};
const warm=interpretSpatialObservation(warmLightingFixture,{grade:'fair'});
assert.equal(warm.bodyColorCandidate,'đỏ nhạt');
assert.equal(warm.coatingColorCandidate,'trắng');
assert.equal(warm.coatingThicknessCandidate,'mỏng');
assert.equal(warm.coatingDistribution,'Không xác định');
assert.equal(warm.medianSulcus.status,'unknown');

const below=structuredClone(mentorFixture);
below.medianSulcus={...below.medianSulcus,visibleSignal:false,score:.45,continuity:.12};
const gated=interpretSpatialObservation(below,{grade:'fair'});
assert.equal(gated.medianSulcus.status,'unknown');
assert.equal(gated.fissure.status,'unknown');

const poor=interpretSpatialObservation(mentorFixture,{grade:'poor'});
assert.equal(poor.active,false);
assert.equal(poor.bodyColorCandidate,'');
assert.equal(poor.coatingColorCandidate,'');
assert.equal(poor.coatingDistribution,'Không xác định');
assert.equal(poor.medianSulcus.status,'unknown');

const noCoat=structuredClone(mentorFixture);
noCoat.coatingCandidateRatio=.06;
noCoat.coatingThicknessCandidate='rất mỏng';
noCoat.coatingDistributionCandidate='không rõ';
const coatGate=interpretSpatialObservation(noCoat,{grade:'good'});
assert.equal(coatGate.coatingThicknessCandidate,'');
assert.equal(coatGate.coatingDistribution,'Không xác định');

assert.equal(SPATIAL_OBSERVATION_POLICY_VERSION,'tongue-spatial-policy-v2');
console.log('SPATIAL OBSERVATION POLICY PASS: v4 spatial payload remains QC-gated for color/coating and keeps median sulcus separate from fissure; poor-QC input fails closed.');
