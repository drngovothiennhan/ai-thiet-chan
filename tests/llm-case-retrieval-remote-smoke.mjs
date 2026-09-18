import assert from 'node:assert/strict';

process.env.VERCEL_ENV='preview';
delete process.env.AITC_CASE_RETRIEVAL_DB;

const calls=[];
globalThis.fetch=async (input,init={})=>{
  const url=String(input);
  calls.push({url,body:String(init.body||''),method:String(init.method||'GET')});
  if(url.endsWith('/health')){
    return new Response(JSON.stringify({
      ok:true,ready:true,records:44643,
      sourceCounts:{'tcmchat-medical-case-sft-v1':44623,'pmc-ccby-cc0-case-reports-v1':20}
    }),{status:200,headers:{'content-type':'application/json'}});
  }
  if(url.endsWith('/search')){
    const body=JSON.parse(String(init.body||'{}'));
    assert.ok(Array.isArray(body.terms));
    assert.ok(body.terms.includes('舌红'));
    assert.ok(body.terms.includes('苔黄'));
    assert.ok(body.terms.includes('头痛'));
    const serialized=JSON.stringify(body);
    assert.doesNotMatch(serialized,/Nguyen Van A|nguyen@example\.com|MSSV|patient name/i);
    return new Response(JSON.stringify({
      ok:true,active:true,returned:2,limit:body.limit,terms:body.terms,
      cases:[
        {id:11,sourceId:'tcmchat-medical-case-sft-v1',sourceRecordId:'tc-11',task:'sft',rank:-4.2,caseText:'患者头痛，舌红，苔黄。',target:'教育病例解释。',provenance:{license:'Apache-2.0'}},
        {id:12,sourceId:'pmc-ccby-cc0-case-reports-v1',sourceRecordId:'pmc-12',task:'case_reasoning',rank:-2.1,caseText:'Case report with tongue findings and headache.',target:'Educational reasoning.',provenance:{license:'CC-BY-4.0',pmcid:'PMC12'}}
      ]
    }),{status:200,headers:{'content-type':'application/json'}});
  }
  throw new Error('unexpected URL '+url);
};

const mod=await import('../case-retrieval.mjs?remote-smoke=1');

const health=await mod.caseRetrievalRuntimeHealth();
assert.equal(health.ready,true);
assert.equal(health.configured,true);
assert.equal(health.mode,'remote');
assert.equal(health.records,44643);
assert.equal(health.sourceCounts['tcmchat-medical-case-sft-v1'],44623);

const input='Nguyen Van A nguyen@example.com có lưỡi đỏ, rêu vàng và đau đầu. patient name MSSV 12345';
const terms=mod.buildRemoteCaseRetrievalTerms(input);
assert.ok(terms.includes('舌红'));
assert.ok(terms.includes('苔黄'));
assert.ok(terms.includes('头痛'));
assert.doesNotMatch(JSON.stringify(terms),/Nguyen|example|MSSV|12345/i);

const result=await mod.retrieveSimilarCasesRuntime(input,{limit:4});
assert.equal(result.mode,'remote');
assert.equal(result.returned,2);
assert.equal(result.cases.length,2);
assert.equal(result.cases[0].sourceId,'tcmchat-medical-case-sft-v1');

const searchCall=calls.find(x=>x.url.endsWith('/search'));
assert.ok(searchCall);
assert.equal(searchCall.method,'POST');
assert.doesNotMatch(searchCall.body,/Nguyen|example|MSSV|12345/i);

console.log('LLM CASE RETRIEVAL REMOTE SMOKE PASS: preview uses remote SQLite retrieval and transmits mapped medical terms only.');
