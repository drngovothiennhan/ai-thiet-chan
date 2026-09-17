import assert from 'node:assert/strict';

const calls=[];
globalThis.fetch=async input=>{
  const url=String(input);
  calls.push(url);
  return new Response(JSON.stringify({error:{code:429,status:'RESOURCE_EXHAUSTED',message:'high demand'}}),{status:429,headers:{'content-type':'application/json'}});
};

await import(`../runtime-guard.mjs?smoke=${Date.now()}`);
assert.equal(process.env.GEMINI_MODEL,'gemini-3.8-flash');
assert.equal(process.env.GEMINI_TEXT_FALLBACK_MODEL,'gemini-3.6-flash');

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
const data=await response.json();
assert.match(data.candidates[0].content.parts[0].text,/Tham Vấn từ kho tri thức/i);
assert.match(data.candidates[0].content.parts[0].text,/TC1/);

calls.length=0;
const consultationPayload={
  contents:[{role:'user',parts:[{text:'[CHAT_GROUNDING_PROTOCOL]\nCâu hỏi người dùng: [TRO_LY_THAM_VAN_EXTERNAL] Hãy giải thích thêm bằng năng lực suy luận của Gemini.\nTrả lời bằng tiếng Việt.'}]}],
  generationConfig:{temperature:0.15}
};
const consultationResponse=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=test',{method:'POST',body:JSON.stringify(consultationPayload)});
assert.equal(consultationResponse.status,503);
assert.equal(calls.length,2);
assert.match(calls[0],/gemini-3\.8-flash/);
assert.match(calls[1],/gemini-3\.6-flash/);
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
const visionResponse=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=test',{method:'POST',body:JSON.stringify(visionPayload)});
assert.equal(visionResponse.status,503);
assert.equal(calls.length,2);
assert.match(calls[0],/gemini-3\.8-flash/);
assert.match(calls[1],/gemini-3\.8-flash/);
assert.equal(visionResponse.headers.get('x-ai-vision-status'),'unavailable');
const visionData=await visionResponse.json();
assert.equal(visionData.visionStatus,'unavailable');
assert.equal(visionData.error.message,'VISION_ANALYSIS_TEMPORARILY_UNAVAILABLE');

console.log('GEMINI RESILIENCE SMOKE PASS: text work uses bounded 3.8 -> 3.6 failover, grounded non-vision work may then use an explicit local fallback, Gemini-required consultation fails visibly if both models fail, and vision remains 3.8-only without fabricated findings.');
