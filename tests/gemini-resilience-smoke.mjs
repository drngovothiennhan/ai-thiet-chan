import assert from 'node:assert/strict';

const calls=[];
globalThis.fetch=async input=>{
  const url=String(input);
  calls.push(url);
  return new Response(JSON.stringify({error:{code:429,status:'RESOURCE_EXHAUSTED',message:'high demand'}}),{status:429,headers:{'content-type':'application/json'}});
};

await import(`../runtime-guard.mjs?smoke=${Date.now()}`);
assert.equal(process.env.GEMINI_MODEL,'gemini-3.8-flash');

const payload={
  contents:[{role:'user',parts:[{text:'HỆ TRI THỨC TRUY XUẤT:\n- [TC1, tr. 12] Chất lưỡi và rêu lưỡi cần được tổng hợp.\nCâu hỏi người dùng: Giải thích kết quả này\nTrả lời ngắn gọn.'}]}],
  generationConfig:{temperature:0.15}
};
const response=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test',{method:'POST',body:JSON.stringify(payload)});
assert.equal(response.status,200);
assert.equal(calls.length,1);
assert.match(calls[0],/gemini-3\.8-flash/);
assert.doesNotMatch(calls[0],/gemini-2\.5/);
assert.equal(response.headers.get('x-ai-fallback'),'local-knowledge');
const data=await response.json();
assert.match(data.candidates[0].content.parts[0].text,/suy luận nội bộ/i);
assert.match(data.candidates[0].content.parts[0].text,/TC1/);

const jsonPayload={contents:[{role:'user',parts:[{text:'HỆ TRI THỨC TRUY XUẤT:\n- [TC1, tr. 12] Đối chiếu thiệt tượng theo dữ liệu nội bộ.'}]}],generationConfig:{responseMimeType:'application/json'}};
const jsonResponse=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=test',{method:'POST',body:JSON.stringify(jsonPayload)});
assert.equal(jsonResponse.status,200);
const jsonData=await jsonResponse.json();
const localAssessment=JSON.parse(jsonData.candidates[0].content.parts[0].text);
assert.equal(localAssessment.top.confidence,0.2);
assert.match(localAssessment.combined.summary,/dữ liệu nội bộ/i);

console.log('GEMINI RESILIENCE SMOKE PASS: Gemini 3.8 Flash is enforced and transient failures switch immediately to grounded local knowledge.');
