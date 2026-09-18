process.env.GEMINI_RETRY_BASE_MS='0';
process.env.AI_GATEWAY_ENABLED='false';
process.env.AITC_TEST_DISABLE_CIRCUIT='1';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const calls=[];
let mode='all-fail';
let transientProfile='default';
globalThis.fetch=async input=>{
  const url=String(input);
  calls.push(url);
  if(mode==='fallback-success'&&/gemini-3\.6-flash/.test(url)){
    return new Response(JSON.stringify({candidates:[{content:{role:'model',parts:[{text:'fallback model response'}]},finishReason:'STOP'}]}),{status:200,headers:{'content-type':'application/json'}});
  }
  const status=/gemini-3\.8-flash/.test(url)?503:429;
  return new Response(JSON.stringify({error:{code:status,status:status===429?'RESOURCE_EXHAUSTED':'UNAVAILABLE',message:'high demand'}}),{status,headers:{'content-type':'application/json'}});
};

await import(`../runtime-guard.mjs?smoke=${Date.now()}`);
assert.equal(process.env.GEMINI_MODEL,'gemini-3.8-flash');
assert.equal(process.env.GEMINI_TEXT_FALLBACK_MODEL,'gemini-3.6-flash');
const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(pkg.scripts.start,'node --import ./runtime-guard.mjs server.mjs');
assert.doesNotMatch(pkg.scripts.start,/vision-provider-failover/,'runtime-guard must be the only Gemini failover wrapper loaded at startup');

const payload={
  contents:[{role:'user',parts:[{text:'HỆ TRI THỨC TRUY XUẤT:\n- [TC1, tr. 12] Chất lưỡi và rêu lưỡi cần được tổng hợp.\nCâu hỏi người dùng: Giải thích kết quả này\nTrả lời ngắn gọn.'}]}],
  generationConfig:{temperature:0.15}
};
const response=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test',{method:'POST',body:JSON.stringify(payload)});
assert.equal(response.status,200);
assert.equal(calls.length,3);
assert.match(calls[0],/gemini-3\.8-flash/);
assert.match(calls[1],/gemini-3\.8-flash/);
assert.match(calls[2],/gemini-3\.6-flash/);
assert.doesNotMatch(calls.join('\n'),/gemini-2\.5/);
assert.equal(response.headers.get('x-ai-fallback'),'local-knowledge');
const data=await response.json();
assert.match(data.candidates[0].content.parts[0].text,/Tham Vấn từ kho tri thức/i);
assert.match(data.candidates[0].content.parts[0].text,/TC1/);

for(const profile of ['timeout','rate-limit']){
  calls.length=0;
  mode='all-fail';
  transientProfile=profile;
  const resilienceResponse=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test',{method:'POST',body:JSON.stringify(payload)});
  assert.equal(resilienceResponse.status,200,profile+' must resolve at application boundary');
  assert.notEqual(resilienceResponse.status,429);
  assert.notEqual(resilienceResponse.status,504);
  assert.equal(resilienceResponse.headers.get('x-ai-fallback'),'local-knowledge');
  const resilienceData=await resilienceResponse.json();
  assert.match(resilienceData.candidates[0].content.parts[0].text,/Tham Vấn từ kho tri thức/i);
}
transientProfile='default';

calls.length=0;
mode='fallback-success';
const consultationPayload={
  contents:[{role:'user',parts:[{text:'[CHAT_GROUNDING_PROTOCOL]\nCâu hỏi người dùng: [TRO_LY_THAM_VAN_EXTERNAL] Hãy giải thích thêm bằng năng lực suy luận của Gemini.\nTrả lời bằng tiếng Việt.'}]}],
  generationConfig:{temperature:0.15}
};
const consultationFallbackResponse=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test',{method:'POST',body:JSON.stringify(consultationPayload)});
assert.equal(consultationFallbackResponse.status,200);
assert.equal(calls.length,3);
assert.match(calls[0],/gemini-3\.8-flash/);
assert.match(calls[1],/gemini-3\.8-flash/);
assert.match(calls[2],/gemini-3\.6-flash/);
assert.equal(consultationFallbackResponse.headers.get('x-ai-consultation-status'),null);
assert.equal(consultationFallbackResponse.headers.get('x-ai-fallback'),null);
const fallbackData=await consultationFallbackResponse.json();
assert.equal(fallbackData.candidates[0].content.parts[0].text,'fallback model response');

calls.length=0;
mode='all-fail';
const consultationResponse=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test',{method:'POST',body:JSON.stringify(consultationPayload)});
assert.equal(consultationResponse.status,503);
assert.equal(calls.length,3);
assert.match(calls[0],/gemini-3\.8-flash/);
assert.match(calls[1],/gemini-3\.8-flash/);
assert.match(calls[2],/gemini-3\.6-flash/);
assert.equal(consultationResponse.headers.get('x-ai-consultation-status'),'unavailable');
assert.equal(consultationResponse.headers.get('x-ai-fallback'),null,'Gemini-required consultation must never masquerade as local fallback');
const consultationData=await consultationResponse.json();
assert.equal(consultationData.consultationStatus,'unavailable');
assert.equal(consultationData.error.message,'CONSULTATION_GEMINI_TEMPORARILY_UNAVAILABLE');

calls.length=0;
const visionPayload={
  contents:[{role:'user',parts:[
    {text:'Phân tích ảnh và trả JSON.'},
    {inline_data:{mime_type:'image/jpeg',data:'ZmFrZQ=='}}
  ]}],
  generationConfig:{responseMimeType:'application/json'}
};
const visionResponse=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test',{method:'POST',body:JSON.stringify(visionPayload)});
assert.equal(visionResponse.status,422);
assert.equal(calls.length,0,'Gemini Vision must be blocked before any network call');
assert.equal(visionResponse.headers.get('x-ai-vision-status'),'blocked');
assert.equal(visionResponse.headers.get('x-ai-fallback'),null);
const visionData=await visionResponse.json();
assert.equal(visionData.visionStatus,'blocked');
assert.equal(visionData.error.message,'GEMINI_VISION_DISABLED');

console.log('GEMINI RESILIENCE SMOKE PASS: Gemini is text-only with bounded 3.8 retry -> 3.6 failover; every inline-media request is blocked locally before network access.');
