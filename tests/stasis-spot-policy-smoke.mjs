import assert from 'node:assert/strict';
import {interpretStasisSpotObservation,STASIS_SPOT_POLICY_VERSION,TONGUE_TOPOGRAPHY_POLICY_VERSION} from '../stasis-spot-policy.mjs';

const fixture={
  schemaVersion:'tongue-stasis-spot-features-v1',
  candidatePixelRatio:.012,
  acceptedAreaRatio:.009,
  componentCount:3,
  smallSpotCount:2,
  patchCount:1,
  regionCounts:{tip:1,margin:1,center:1,root:0},
  smallSpotRegionCounts:{tip:1,margin:1,center:0,root:0},
  patchRegionCounts:{tip:0,margin:0,center:1,root:0},
  meanPurpleDelta:.045,
  meanDarkContrast:.061,
  redSpotExcludedRatio:.004,
  componentSummaries:[
    {kind:'small-spot',region:'tip',areaRatio:.001,aspect:1.1,nx:.5,ny:.8},
    {kind:'small-spot',region:'margin',areaRatio:.0015,aspect:.9,nx:.15,ny:.5},
    {kind:'patch',region:'center',areaRatio:.0065,aspect:1.4,nx:.5,ny:.5}
  ]
};

const out=interpretStasisSpotObservation(fixture,{grade:'good'});
assert.equal(STASIS_SPOT_POLICY_VERSION,'tongue-stasis-spot-policy-v1');
assert.equal(TONGUE_TOPOGRAPHY_POLICY_VERSION,'tcm-tongue-topography-v1');
assert.equal(out.active,true);
assert.equal(out.productionEligible,false);
assert.equal(out.calibrated,false);
assert.equal(out.smallSpots.status,'possible');
assert.equal(out.patches.status,'possible');
assert.match(out.smallSpots.label,/điểm ứ/i);
assert.match(out.patches.label,/ban ứ/i);
assert.equal(out.regions.length,3);
assert.deepEqual(out.regions.find(x=>x.region==='tip').zangFu,['Tâm','Phế']);
assert.deepEqual(out.regions.find(x=>x.region==='margin').zangFu,['Can','Đởm']);
assert.deepEqual(out.regions.find(x=>x.region==='center').zangFu,['Tỳ','Vị']);
assert.match(out.regions[0].interpretation,/không phải ranh giới giải phẫu/i);
assert.match(out.rule,/engineering candidate/i);
assert.match(out.smallSpots.rule,/không.*huyết ứ/i);

const poor=interpretStasisSpotObservation(fixture,{grade:'poor'});
assert.equal(poor.active,false);
assert.equal(poor.smallSpots.status,'unknown');
assert.equal(poor.patches.status,'unknown');

const empty=interpretStasisSpotObservation({...fixture,componentCount:0,smallSpotCount:0,patchCount:0,acceptedAreaRatio:0,regionCounts:{tip:0,margin:0,center:0,root:0}},{grade:'good'});
assert.equal(empty.smallSpots.status,'unknown');
assert.equal(empty.patches.status,'unknown');

console.log('STASIS SPOT POLICY PASS: dark-purple localized candidates remain observation-only, red/prickle semantics stay separate, and TCM regional mapping is explicitly theoretical.');
