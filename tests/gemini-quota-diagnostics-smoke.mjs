import assert from 'node:assert/strict';

process.env.GEMINI_RETRY_BASE_MS='0';
process.env.AITC_TEST_DISABLE_CIRCUIT='1';
process.env.AI_GATEWAY_ENABLED='false';

const calls=[];
globalThis.fetch=async input=>{
  const url=String(input);calls.push(url);
  if(/gemini-3\.6-flash/.test(url)){
    return new Response(JSON.stringify({candidates:[{content:{role:'model',parts:[{text:'fallback ok'}]}}]}),{status:200,headers:{'content-type':'application/json'}});
  }
  return new Response(JSON.stringify({
    error:{
      code:429,
      status:'RESOURCE_EXHAUSTED',
      message:'Quota exceeded for project; key=should-not-leak',
      details:[
        {'@type':'type.googleapis.com/google.rpc.QuotaFailure',violations:[{
          subject:'projects/test',
          description:'Requests per minute exceeded',
          quotaMetric:'generativelanguage.googleapis.com/generate_content_free_tier_requests',
          quotaId:'GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
          quotaDimensions:{model:'gemini-3.8-flash',location:'global'}
        }]},
        {'@type':'type.googleapis.com/google.rpc.RetryInfo',retryDelay:'1.5s'}
      ]
    }
  }),{status:429,headers:{'content-type':'application/json','retry-after':'2'}});
};

const warns=[];
const originalWarn=console.warn;
console.warn=(...args)=>warns.push(args.map(String).join(' '));
try{
  await import('../runtime-guard.mjs?quota-smoke=1');
  const payload={contents:[{role:'user',parts:[{text:'Câu hỏi người dùng: kiểm tra quota'}]}],generationConfig:{temperature:0.1}};
  const response=await globalThis.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent?key=test-secret',{method:'POST',body:JSON.stringify(payload)});
  assert.equal(response.status,200);
}finally{
  console.warn=originalWarn;
}

assert.equal(calls.length,2,'429 should skip same-model retry and move to direct fallback model');
assert.match(calls[0],/gemini-3\.8-flash/);
assert.match(calls[1],/gemini-3\.6-flash/);
const joined=warns.join('\n');
assert.match(joined,/RESOURCE_EXHAUSTED/);
assert.match(joined,/generate_content_free_tier_requests/);
assert.match(joined,/GenerateRequestsPerMinutePerProjectPerModel-FreeTier/);
assert.match(joined,/"retryAfterMs":2000/);
assert.doesNotMatch(joined,/test-secret/);
assert.doesNotMatch(joined,/should-not-leak/,'raw upstream message must be sanitized before logging');

console.log('GEMINI QUOTA DIAGNOSTICS PASS: 429 quota metric/id/retry delay are logged without API keys or raw upstream message leakage.');
