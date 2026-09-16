import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/hardware-profile.js',import.meta.url),'utf8');

function runProfile({cores,memory,effectiveType='4g',saveData=false}={}){
  const window={};
  const navigator={
    hardwareConcurrency:cores,
    deviceMemory:memory,
    connection:{effectiveType,saveData}
  };
  const context={window,navigator,OffscreenCanvas:function(){},createImageBitmap:async()=>{},Worker:function(){},requestIdleCallback:()=>{}};
  vm.runInNewContext(source,context,{filename:'hardware-profile.js'});
  return window.AITCHardwareProfile;
}

const constrained=runProfile({cores:4,memory:4,effectiveType:'3g'});
assert.equal(constrained.profile.tier,'constrained');
assert.equal(constrained.imagePolicy(constrained.profile,{frontCamera:false}).maxOutputPixels,2_000_000);
assert.equal(constrained.imagePolicy(constrained.profile,{frontCamera:true}).maxUpscale,1.75);

const balanced=runProfile({cores:6,memory:6,effectiveType:'4g'});
assert.equal(balanced.profile.tier,'balanced');
assert.equal(balanced.imagePolicy(balanced.profile,{frontCamera:false}).maxOutputPixels,2_600_000);

const high=runProfile({cores:8,memory:8,effectiveType:'4g'});
assert.equal(high.profile.tier,'high');
assert.equal(high.imagePolicy(high.profile,{frontCamera:false}).maxOutputPixels,3_200_000);
assert.equal(high.imagePolicy(high.profile,{frontCamera:true}).maxOutputSide,1800);

const saveData=runProfile({cores:8,memory:8,effectiveType:'4g',saveData:true});
assert.equal(saveData.profile.tier,'balanced','save-data must reduce one tier even on strong hardware');

assert.ok(!source.includes('userAgent'),'hardware profile must not inspect raw user-agent');
assert.ok(!source.includes('serial'),'hardware profile must not use device serial identifiers');
assert.match(source,/hardwareConcurrency/);
assert.match(source,/deviceMemory/);
assert.match(source,/effectiveType/);
assert.match(source,/imagePolicy/);

console.log('HARDWARE PROFILE SMOKE PASS: coarse non-identifying capability detection and deterministic image policy matrix are valid.');