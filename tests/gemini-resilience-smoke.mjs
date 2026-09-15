import assert from 'node:assert/strict';

const calls=[];
globalThis.fetch=async input=>{
  const url=String(input);
  calls.push(url);
  if(calls.length<3){
    return new Response(JSON.stringify({error:{code:503,status:'UNAVAILABLE',message:'This model is currently experiencing high demand. Please try again later.'}}),{status:503,headers:{'content-type':'application/json'}});
  }
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'ok'}]}}]}),{status:200,headers:{'content-type':'application/json'}});
};

await import(`../runtime-guard.mjs?smoke=${Date.now()}`);
const response=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=test',{method:'POST',body:'{}'});
assert.equal(response.status,200);
assert.equal(calls.length,3);
assert.match(calls[0],/gemini-3\.6-flash/);
assert.match(calls[1],/gemini-3\.6-flash/);
assert.match(calls[2],/gemini-2\.5-flash/);
console.log('GEMINI RESILIENCE SMOKE PASS: retries primary model then falls back to stable Flash model');
