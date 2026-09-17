import assert from 'node:assert/strict';

const upstreamCalls=[];
globalThis.fetch=async input=>{
  const url=String(input);
  upstreamCalls.push(url);
  if(/gemini-3\.8-flash/.test(url)){
    return new Response(JSON.stringify({error:{code:429,status:'RESOURCE_EXHAUSTED',message:'high demand'}}),{status:429,headers:{'content-type':'application/json'}});
  }
  if(/gemini-3\.6-flash/.test(url)){
    return new Response(JSON.stringify({candidates:[{content:{role:'model',parts:[{text:'{"top":{"visualValidity":{"tongueVisible":true},"confidence":0.9},"combined":{"confidence":0.9,"summary":"ok"}}'}]},finishReason:'STOP'}]}),{status:200,headers:{'content-type':'application/json'}});
  }
  throw new Error(`unexpected model URL: ${url}`);
};

await import(`../vision-provider-failover.mjs?smoke=${Date.now()}`);
await import(`../runtime-guard.mjs?smoke=${Date.now()}`);

assert.equal(process.env.GEMINI_VISION_FALLBACK_MODEL,'gemini-3.6-flash');

const payload={
  contents:[{role:'user',parts:[
    {text:'Phân tích ảnh và trả JSON.'},
    {inline_data:{mime_type:'image/jpeg',data:'ZmFrZQ=='}}
  ]}],
  generationConfig:{responseMimeType:'application/json'}
};
const response=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test',{method:'POST',body:JSON.stringify(payload)});
assert.equal(response.status,200);
assert.equal(upstreamCalls.length,2,'one primary attempt plus one bounded multimodal fallback is expected');
assert.match(upstreamCalls[0],/gemini-3\.8-flash/);
assert.match(upstreamCalls[1],/gemini-3\.6-flash/);
assert.equal(response.headers.get('x-ai-vision-status'),null);
const data=await response.json();
assert.match(data.candidates[0].content.parts[0].text,/tongueVisible/);

console.log('VISION PROVIDER FAILOVER SMOKE PASS: production import order retries transient Gemini 3.8 vision failure once on Gemini 3.6, returns real multimodal output, and never fabricates a local visual result.');
