import assert from 'node:assert/strict';
import {boundedChannelGains,normalizeRgb,mapNormalizedGeometry,SHADOW_PREPROCESS_VERSION} from '../public/local-vision/shadow-preprocess-v3.js';

assert.equal(SHADOW_PREPROCESS_VERSION,'shadow-preprocess-v3');

const insufficient=boundedChannelGains({r:120,g:118,b:121,sampleCount:8});
assert.equal(insufficient.applied,false);
assert.equal(insufficient.reason,'insufficient-neutral-reference');
assert.deepEqual(insufficient.gains,{r:1,g:1,b:1});

const biased=boundedChannelGains({r:180,g:145,b:125,sampleCount:500},{minSamples:64,limit:.20});
assert.equal(biased.applied,true);
for(const gain of [biased.gains.r,biased.gains.g,biased.gains.b]){
  assert.ok(gain>=.8&&gain<=1.2,'normalization gain must stay within the bounded safety range');
}
assert.equal(biased.authority,false);
assert.equal(biased.inputMutation,false);

const normalized=normalizeRgb(200,120,90,biased.gains);
for(const channel of [normalized.r,normalized.g,normalized.b]){
  assert.ok(Number.isInteger(channel)&&channel>=0&&channel<=255,'normalized RGB must remain valid');
}

const window=mapNormalizedGeometry({x0:.2,y0:.1,x1:.8,y1:.9},192,144,.05);
assert.ok(window);
assert.ok(window.minX>=0&&window.minY>=0&&window.maxX<192&&window.maxY<144);
assert.ok(window.width>0&&window.height>0);

assert.equal(mapNormalizedGeometry(null,192,144),null);
assert.equal(mapNormalizedGeometry({x0:.8,y0:.2,x1:.2,y1:.7},192,144),null);

console.log('VISION SHADOW V3 PREPROCESS PASS: model-guided ROI mapping and bounded neutral-reference gains are deterministic shadow-only preprocessing contracts; no clinical metric is asserted.');
