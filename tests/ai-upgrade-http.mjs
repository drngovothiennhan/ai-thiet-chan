import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {once} from 'node:events';
const child=fork(new URL('../server.mjs',import.meta.url),[],{
  execArgv:['--import',new URL('./fixtures/ai-upgrade-provider.mjs',import.meta.url).href,'--import',new URL('../runtime-guard.mjs',import.meta.url).href],
  env:{...process.env,PORT:'0',GEMINI_API_KEY:'test-only-no-network'},silent:true
});
let logs='';child.stderr.on('data',d=>{logs=(logs+d).slice(-5000);});child.stdout.resume();
const deadline=setTimeout(()=>child.kill(),20000);
try{
  const [{port}]=await once(child,'message');
  const call=async scenario=>{
    const response=await fetch(`http://127.0.0.1:${port}/api/analyze`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({topImage:'data:image/jpeg;base64,'+'a'.repeat(200),topQc:{grade:'good',scenario},academicSignature:{r:.7,g:.45,b:.42,s:.35,v:.7,purple:.05,white:.15,yellow:.03,dark:.01,spot:.05,aspect:.8,coverage:.5}}),signal:AbortSignal.timeout(12000)});
    return {status:response.status,data:await response.json()};
  };
  const good=await call('normal');assert.equal(good.status,200);assert.equal(good.data.collection.ok,true);
  assert.equal(good.data.provider.model,'gemini-3.6-flash');assert.equal(good.data.provider.fallback,'provider');
  assert.equal(good.data.assessment.ml.evidence.layers.geminiAcademic,false);
  const start=Date.now(),store=await call('stall-store');
  assert.equal(store.status,200);assert.equal(store.data.collection.ok,false);assert.equal(store.data.collection.error,'CASE_STORE_FAILED');
  assert.ok(Date.now()-start<9000,'stalled storage must return analysis within the six-second storage budget');
  assert.ok(store.data.assessment.combined.summary.includes('stall-store'));
  const malformed=await call('test-malformed');assert.equal(malformed.status,502);assert.equal(malformed.data.message,'VISION_RESPONSE_INCOMPLETE');
  console.log('AI UPGRADE HTTP PASS: real Express pipeline, provider failover trace, fused storage, stalled-store result preservation, malformed vision rejection. External services mocked; no clinical benchmark.');
}catch(error){console.error(logs);throw error;}
finally{clearTimeout(deadline);child.kill();await once(child,'exit');}
