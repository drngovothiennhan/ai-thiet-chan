import assert from 'node:assert/strict';

let callCount=0;
globalThis.fetch=async()=>{
  callCount++;
  return new Response(JSON.stringify({error:{code:429,status:'RESOURCE_EXHAUSTED',message:'high demand'}}),{status:429,headers:{'content-type':'application/json'}});
};
await import(`../runtime-guard.mjs?chat=${Date.now()}`);

const assessment={
  top:{
    quality:'good',tongueColor:'đỏ nhạt',shape:'hơi mập',coatingColor:'vàng nhạt',coatingThickness:'mỏng',coatingTexture:'hơi nhầy',moisture:'nhuận',fissures:'không rõ',toothmarks:'có nhẹ',
    theoryAssessment:{generalSignals:[{label:'Tín hiệu thấp',evidence:'rêu hơi nhầy'}],stomachPatternSignals:[],cannotConclude:[]},limitations:[]
  },
  bottom:null,
  combined:{confidence:.71,summary:'Chất lưỡi đỏ nhạt, hơi mập; rêu vàng nhạt, mỏng và hơi nhầy.',generalSignals:[{label:'Tín hiệu thấp',evidence:'rêu hơi nhầy'}],stomachPatternSignals:[],cannotConclude:['Chưa có dữ liệu mặt dưới lưỡi.']}
};
const knowledge=[
  '- [TC1, tr. 30] Chất lưỡi đỏ hoặc đỏ sẫm cần đối chiếu rêu và độ ẩm.',
  '- [TC1, tr. 52] Rêu vàng thường cần đối chiếu mức dày, khô/nhuận và chất lưỡi.',
  '- [MC1, tr. 18] Tĩnh mạch dưới lưỡi chỉ đánh giá khi mặt dưới được bộc lộ rõ.'
].join('\n');

async function ask(question){
  const prompt=`Bạn là chatbot A.I Thiệt Chẩn.\nHỆ TRI THỨC thiet-chan-kb-2026-09-15.5doc:\n${knowledge}\n\nBối cảnh phân tích: ${JSON.stringify(assessment)}\nCâu hỏi người dùng: ${question}\nTrả lời ngắn gọn.`;
  const payload={contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:.15}};
  const r=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=test',{method:'POST',body:JSON.stringify(payload)});
  assert.equal(r.status,200);
  assert.equal(r.headers.get('x-ai-fallback'),'local-knowledge');
  const data=await r.json();
  return data.candidates[0].content.parts[0].text;
}

const color=await ask('Màu chất lưỡi hiện tại là gì?');
const coating=await ask('Rêu lưỡi hiện tại như thế nào?');
const underside=await ask('Mạch dưới lưỡi có gì bất thường?');
const quality=await ask('Độ tin cậy của kết quả này thế nào?');

assert.notEqual(color,coating);
assert.notEqual(coating,underside);
assert.notEqual(underside,quality);
assert.match(color,/Màu chất lưỡi: đỏ nhạt/i);
assert.match(coating,/Màu rêu: vàng nhạt/i);
assert.match(coating,/Độ dày: mỏng/i);
assert.match(underside,/chưa có dữ liệu mặt dưới lưỡi/i);
assert.match(quality,/71%/);
assert.match(quality,/không phải độ chính xác chẩn đoán lâm sàng/i);
assert.equal(callCount,8,'four questions should each try Gemini 3.8 then 3.6 before local fallback');

console.log('CHAT QUESTION-AWARE FALLBACK SMOKE PASS: distinct questions produce distinct, evidence-bounded fallback answers during provider 429.');
