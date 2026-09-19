import assert from 'node:assert/strict';
import {measureMedianGroove} from '../public/local-vision/shadow-groove.js';
const w=100,h=100,box={minX:10,minY:10,maxX:89,maxY:89};
function fixture(){
  const gray=new Float32Array(w*h).fill(180),mask=new Uint8Array(w*h);
  for(let y=10;y<=89;y++)for(let x=10;x<=89;x++)mask[y*w+x]=1;
  return {gray,mask};
}
const measure=f=>measureMedianGroove(f.gray,f.mask,w,h,box);
assert.equal(measure(fixture()).score,0,'flat surface has no groove');
const thin=fixture(),wide=fixture(),step=fixture(),off=fixture(),broken=fixture();
for(let y=11;y<89;y++){
  thin.gray[y*w+50]=100;
  for(let x=49;x<=51;x++)wide.gray[y*w+x]=100;
  for(let x=10;x<=50;x++)step.gray[y*w+x]=100;
  off.gray[y*w+25]=100;
  broken.gray[y*w+(y%2?44:55)]=100;
}
assert.ok(measure(thin).score>.9);
assert.ok(measure(wide).score>.9,'three-pixel groove must have bilateral support');
assert.equal(measure(step).score,0,'one-sided shadow edge is not a groove');
assert.equal(measure(off).score,0,'off-center line is not a median groove');
assert.ok(measure(broken).score<.02,'disconnected dark pixels cannot extend continuity');
const hole=fixture();
for(let y=11;y<89;y++){
  hole.gray[y*w+50]=100;
  hole.mask[y*w+49]=0;hole.mask[y*w+51]=0;
}
assert.equal(measure(hole).score,0,'outside-ROI shoulders cannot support a groove');
const before=wide.gray.slice(),maskBefore=wide.mask.slice(),result=measure(wide);
assert.deepEqual(wide.gray,before);assert.deepEqual(wide.mask,maskBefore);
assert.equal(result.authority,false);assert.equal(result.productionEligible,false);assert.equal(result.calibrated,false);
assert.throws(()=>measureMedianGroove([],[],w,h,box),/INVALID_GRID/);
assert.throws(()=>measureMedianGroove(wide.gray,wide.mask,w,h,{...box,maxX:100}),/INVALID_BOX/);
console.log('PASS: synthetic pixel geometry regression only; no real-image or clinical accuracy measured.');
