import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const hardwareSource=await readFile(new URL('../public/hardware-profile.js',import.meta.url),'utf8');
const requestClientSource=await readFile(new URL('../public/request-client.js',import.meta.url),'utf8');
const enhancerSource=await readFile(new URL('../public/image-enhancement.js',import.meta.url),'utf8');

function runtime({cores=null,memory=null,effectiveType='4g',saveData=false,withHardware=true}={}){
  const window={fetch:async()=>({ok:true,json:async()=>({})})};
  const navigator={hardwareConcurrency:cores,deviceMemory:memory,connection:{effectiveType,saveData}};
  const context={window,navigator,performance:{now:()=>0},location:{href:'https://example.test/'},OffscreenCanvas:function(){},createImageBitmap:async()=>{},Worker:function(){},requestIdleCallback:()=>{}};
  vm.runInNewContext(requestClientSource,context,{filename:'request-client.js'});
  if(withHardware)vm.runInNewContext(hardwareSource,context,{filename:'hardware-profile.js'});
  vm.runInNewContext(enhancerSource,context,{filename:'image-enhancement.js'});
  return window.AITCImageEnhancement;
}

const legacy=runtime({withHardware:false});
const constrained=runtime({cores:4,memory:4,effectiveType:'3g'});
const balanced=runtime({cores:6,memory:6,effectiveType:'4g'});
const high=runtime({cores:8,memory:8,effectiveType:'4g'});

// Historical production dimensions on 2026-09-16 are predominantly 960x1280,
// with one 1080x1440 pair. These assertions compare policy outputs only; they
// are not claims about clinical accuracy or measured wall-clock speed.
const legacy960=legacy.outputSize(960,1280,false);
const constrained960=constrained.outputSize(960,1280,false);
const balanced960=balanced.outputSize(960,1280,false);
const high960=high.outputSize(960,1280,false);
assert.deepEqual([legacy960.width,legacy960.height],[1200,1600]);
assert.deepEqual([balanced960.width,balanced960.height],[1200,1600]);
assert.deepEqual([high960.width,high960.height],[1200,1600]);
assert.deepEqual([constrained960.width,constrained960.height],[1080,1440]);
assert.equal(legacy960.width*legacy960.height,1_920_000);
assert.equal(constrained960.width*constrained960.height,1_555_200);
assert.ok(constrained960.width*constrained960.height<legacy960.width*legacy960.height);

const legacy1080=legacy.outputSize(1080,1440,false);
const constrained1080=constrained.outputSize(1080,1440,false);
assert.deepEqual([legacy1080.width,legacy1080.height],[1200,1600]);
assert.deepEqual([constrained1080.width,constrained1080.height],[1080,1440]);

// The historical set contains one front-camera case; adaptive policy lowers
// the generated working/output pixel count on balanced/constrained hardware.
const legacyFront=legacy.outputSize(960,1280,true);
const balancedFront=balanced.outputSize(960,1280,true);
const constrainedFront=constrained.outputSize(960,1280,true);
assert.deepEqual([legacyFront.width,legacyFront.height],[1350,1800]);
assert.deepEqual([balancedFront.width,balancedFront.height],[1260,1680]);
assert.deepEqual([constrainedFront.width,constrainedFront.height],[1125,1500]);
assert.ok(constrainedFront.width*constrainedFront.height<balancedFront.width*balancedFront.height);
assert.ok(balancedFront.width*balancedFront.height<legacyFront.width*legacyFront.height);

console.log('ADAPTIVE IMAGE POLICY SMOKE PASS: real historical image dimensions preserve legacy output on high hardware and reduce generated pixel load on constrained devices.');
