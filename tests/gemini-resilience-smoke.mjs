import assert from 'node:assert/strict';

const calls=[];
let mode='fail-all';
globalThis.fetch=async input=>{
  const url=String(input);
  calls.push(url);
  if(mode==='fallback-success'&&url.includes('gemini-3.6-flash')){
    return new Response(JSON.stringify({candidates:[{content:{role:'model',parts:[{text:'{"ok":true}'}]},finishReason:'STOP'}]}),{status:200,headers:{'content-type':'application/json'}});
  }
  return new Response(JSON.stringify({error:{code:429,status:'RESOURCE_EXHAUSTED',message:'high demand'}}),{status:429,headers:{'content-type':'application/json'}});
};

await import(`../runtime-guard.mjs?smoke=${Date.now()}`);
assert.equal(process.env.GEMINI_MODEL,'gemini-3.8-flash');
assert.equal(process.env.GEMINI_FALLBACK_MODEL,'gemini-3.6-flash');

const payload={
  contents:[{role:'user',parts:[{text:'HỆ TRI THỨC TRUY XUẤT:\n- [TC1, tr. 12] Chất lưỡi và rêu lưỡi cần được tổng hợp.\nCâu hỏi người dùng: Giải thích kết quả này\nTrả lời ngắn gọn.'}]}],
  generationConfig:{temperature:0.15}
};
const response=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test',{method:'POST',body:JSON.stringify(payload)});
assert.equal(response.status,200);
assert.equal(calls.length,2);
assert.match(calls[0],/gemini-3\.8-flash/);
assert.match(calls[1],/gemini-3\.6-flash/);
assert.doesNotMatch(calls.join('\n'),/gemini-2\.5/);
assert.equal(response.headers.get('x-ai-fallback'),'local-knowledge');
assert.equal(response.headers.get('x-ai-agent-version'),'aitc-provider-agent-v1');
assert.ok(Number(response.headers.get('x-ai-elapsed-ms'))>=0);
const data=await response.json();
assert.match(data.candidates[0].content.parts[0].text,/suy luận nội bộ/i);
assert.match(data.candidates[0].content.parts[0].text,/TC1/);
assert.equal(data.localFallback.agent.version,'aitc-provider-agent-v1');
assert.equal(data.localFallback.agent.attempts.length,2);

calls.length=0;
mode='fallback-success';
const visionPayload={
  contents:[{role:'user',parts:[
    {text:'Phân tích ảnh và trả JSON.'},
    {inline_data:{mime_type:'image/jpeg',data:'ZmFrZQ=='}}
  ]}],
  generationConfig:{responseMimeType:'application/json'}
};
const visionFallback=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=test',{method:'POST',body:JSON.stringify(visionPayload)});
assert.equal(visionFallback.status,200);
assert.equal(calls.length,2);
assert.match(calls[0],/gemini-3\.8-flash/);
assert.match(calls[1],/gemini-3\.6-flash/);
const fallbackData=await visionFallback.json();
assert.equal(fallbackData.candidates[0].content.parts[0].text,'{"ok":true}');

calls.length=0;
mode='fail-all';
const visionResponse=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=test',{method:'POST',body:JSON.stringify(visionPayload)});
assert.equal(visionResponse.status,503);
assert.equal(calls.length,2);
assert.equal(visionResponse.headers.get('x-ai-vision-status'),'unavailable');
assert.equal(visionResponse.headers.get('x-ai-agent-version'),'aitc-provider-agent-v1');
const visionData=await visionResponse.json();
assert.equal(visionData.visionStatus,'unavailable');
assert.equal(visionData.error.message,'VISION_ANALYSIS_TEMPORARILY_UNAVAILABLE');
assert.deepEqual(visionData.modelsTried,['gemini-3.8-flash','gemini-3.6-flash']);
assert.equal(visionData.agent.version,'aitc-provider-agent-v1');
assert.ok(visionData.agent.circuits.some(x=>x.model==='gemini-3.8-flash'&&x.open===true));

calls.length=0;
const circuitResponse=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=test',{method:'POST',body:JSON.stringify(visionPayload)});
assert.equal(circuitResponse.status,503);
assert.equal(calls.length,1,'open primary circuit must be skipped while fallback remains eligible');
assert.match(calls[0],/gemini-3\.6-flash/);
const circuitData=await circuitResponse.json();
assert.deepEqual(circuitData.modelsTried,['gemini-3.6-flash']);

console.log('GEMINI RESILIENCE SMOKE PASS: deterministic provider agent uses 3.8 primary, 3.6 failover, opens a circuit after repeated failures, preserves grounded text fallback, and never fabricates vision findings.');
