import assert from 'node:assert/strict';

const calls=[];
let mode='text-fallback-success';
globalThis.fetch=async input=>{
  const url=String(input);
  calls.push(url);
  if(mode==='text-fallback-success'&&url.includes('gemini-3.6-flash')){
    return new Response(JSON.stringify({candidates:[{content:{role:'model',parts:[{text:'Phản hồi từ model dự phòng'}]},finishReason:'STOP'}]}),{status:200,headers:{'content-type':'application/json'}});
  }
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
const data=await response.json();
assert.equal(data.candidates[0].content.parts[0].text,'Phản hồi từ model dự phòng');

calls.length=0;
mode='fail-all';
const localResponse=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=test',{method:'POST',body:JSON.stringify(payload)});
assert.equal(localResponse.status,200);
assert.equal(calls.length,2);
assert.match(calls[0],/gemini-3\.8-flash/);
assert.match(calls[1],/gemini-3\.6-flash/);
assert.equal(localResponse.headers.get('x-ai-fallback'),'local-knowledge');
const localData=await localResponse.json();
assert.match(localData.candidates[0].content.parts[0].text,/câu hỏi hiện tại/i);
assert.deepEqual(localData.localFallback.modelsTried,['gemini-3.8-flash','gemini-3.6-flash']);

calls.length=0;
const visionPayload={
  contents:[{role:'user',parts:[
    {text:'Phân tích ảnh và trả JSON.'},
    {inline_data:{mime_type:'image/jpeg',data:'ZmFrZQ=='}}
  ]}],
  generationConfig:{responseMimeType:'application/json'}
};
const visionResponse=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=test',{method:'POST',body:JSON.stringify(visionPayload)});
assert.equal(visionResponse.status,503);
assert.equal(calls.length,2);
assert.match(calls[0],/gemini-3\.8-flash/);
assert.match(calls[1],/gemini-3\.8-flash/);
assert.equal(visionResponse.headers.get('x-ai-vision-status'),'unavailable');
const visionData=await visionResponse.json();
assert.equal(visionData.visionStatus,'unavailable');
assert.equal(visionData.error.message,'VISION_ANALYSIS_TEMPORARILY_UNAVAILABLE');

console.log('GEMINI RESILIENCE SMOKE PASS: text requests use 3.8 then 3.6 before grounded local fallback; vision behavior is unchanged and never fabricates findings.');
