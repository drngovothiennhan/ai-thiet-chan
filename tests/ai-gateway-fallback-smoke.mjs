import assert from 'node:assert/strict';

process.env.GEMINI_RETRY_BASE_MS='0';
process.env.AITC_TEST_DISABLE_CIRCUIT='1';
process.env.AI_GATEWAY_ENABLED='auto';
process.env.VERCEL_OIDC_TOKEN='test-oidc-token';
process.env.AI_GATEWAY_PRIMARY_MODEL='openai/gpt-5.6-sol';

const calls=[];
globalThis.fetch=async (input,init={})=>{
  const url=String(input);calls.push({url,body:String(init?.body||'')});
  if(url.includes('ai-gateway.vercel.sh')){
    return new Response(JSON.stringify({
      id:'chatcmpl-test',
      model:'openai/gpt-5.6-sol',
      choices:[{message:{role:'assistant',content:'gateway independent provider response'}}]
    }),{status:200,headers:{'content-type':'application/json'}});
  }
  return new Response(JSON.stringify({error:{code:503,status:'UNAVAILABLE',message:'backend overloaded'}}),{status:503,headers:{'content-type':'application/json'}});
};

await import('../runtime-guard.mjs?gateway-smoke=1');

const payload={
  contents:[{role:'user',parts:[{text:'[CHAT_GROUNDING_PROTOCOL]\nCâu hỏi người dùng: Giải thích kết quả từ dữ liệu cấu trúc.\nTrả lời bằng tiếng Việt.'}]}],
  generationConfig:{temperature:0.1}
};
const response=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test',{method:'POST',body:JSON.stringify(payload)});
assert.equal(response.status,200);
assert.equal(response.headers.get('x-ai-fallback'),'vercel-ai-gateway');
assert.equal(response.headers.get('x-ai-gateway-model'),'openai/gpt-5.6-sol');
assert.equal(calls.filter(x=>x.url.includes('generativelanguage.googleapis.com')).length,3);
assert.equal(calls.filter(x=>x.url.includes('ai-gateway.vercel.sh')).length,1);
const gatewayCall=calls.find(x=>x.url.includes('ai-gateway.vercel.sh'));
assert.doesNotMatch(gatewayCall.body,/inline_data|inlineData/,'AI Gateway fallback must remain text-only');
const data=await response.json();
assert.equal(data.candidates[0].content.parts[0].text,'gateway independent provider response');

console.log('AI GATEWAY FALLBACK SMOKE PASS: after bounded Gemini failures, a text-only independent-provider gateway fallback is used before local fallback.');
