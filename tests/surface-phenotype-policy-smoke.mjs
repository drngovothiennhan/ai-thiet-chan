import assert from 'node:assert/strict';
import {interpretSurfacePhenotype,SURFACE_PHENOTYPE_POLICY_VERSION} from '../surface-phenotype-policy.mjs';

function features({toothmarks={},shape={},coatingTexture={}}={}){
  return {
    schemaVersion:'tongue-surface-phenotype-features-v1',
    toothmarks:{
      leftNotches:2,rightNotches:2,totalNotches:4,maxNotchDepthRatio:.05,
      bilateralSignal:true,edgeSampleRows:60,...toothmarks
    },
    shape:{
      boxAspect:1.20,midWidthToHeight:.90,boxFillRatio:.70,profileRows:60,...shape
    },
    coatingTexture:{
      sampledPixels:1000,coatingCandidateRatio:.25,meanMicrotexture:.03,
      highFrequencyRatio:.30,fineGranuleRatio:.30,coarseGranuleRatio:.10,
      patchiness:.95,centerMinusEdgeCoverage:.15,...coatingTexture
    }
  };
}

assert.equal(SURFACE_PHENOTYPE_POLICY_VERSION,'tongue-surface-phenotype-policy-v1');

const broad=interpretSurfacePhenotype(features(),{grade:'good'});
assert.equal(broad.active,true);
assert.equal(broad.productionEligible,false);
assert.equal(broad.calibrated,false);
assert.equal(broad.toothmarks.status,'possible');
assert.match(broad.toothmarks.label,/dấu răng/i);
assert.equal(broad.shape.status,'broad-full');
assert.match(broad.shape.label,/mập-bệu/i);
assert.equal(broad.coatingTexture.status,'patchy');
assert.match(broad.coatingTexture.label,/bong\/tróc/i);

const slender=interpretSurfacePhenotype(features({
  toothmarks:{leftNotches:0,rightNotches:0,totalNotches:0,maxNotchDepthRatio:.006,bilateralSignal:false},
  shape:{boxAspect:.72,midWidthToHeight:.48,boxFillRatio:.42},
  coatingTexture:{patchiness:.10,meanMicrotexture:.018,highFrequencyRatio:.08,fineGranuleRatio:.18,coarseGranuleRatio:.02}
}),{grade:'good'});
assert.equal(slender.toothmarks.status,'unknown');
assert.equal(slender.shape.status,'slender');
assert.match(slender.shape.label,/gầy/i);

const poor=interpretSurfacePhenotype(features(),{grade:'poor'});
assert.equal(poor.active,false);
assert.equal(poor.toothmarks.status,'unknown');
assert.equal(poor.shape.status,'unknown');
assert.equal(poor.coatingTexture.status,'unknown');

assert.match(broad.shape.rule,/không thể suy từ ảnh tĩnh/i);
assert.match(broad.coatingTexture.rule,/dính chặt|dễ cạo/i);
assert.match(broad.rule,/chưa phải clinical gold/i);

console.log('SURFACE PHENOTYPE POLICY PASS: toothmark edge concavities, relative 2D shape and segmented coating texture are QC-gated; softness, adhesion and syndrome inference remain forbidden.');
