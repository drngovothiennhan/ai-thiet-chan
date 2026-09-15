import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {boundedFetch} from '../bounded-fetch.mjs';
import {aiAdmission} from '../request-budget.mjs';
import {applyAcademicFusion,evidenceReadiness,validAcademicSignature} from '../academic-server.mjs';
import {directPatterns,fuse} from '../public/academic-fusion-core.js';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';

const learningSource=await readFile(new URL('../public/clinical-learning.js',import.meta.url),'utf8');
const hashHelpers=learningSource.slice(learningSource.indexOf('  async function sha256Text'),learningSource.indexOf('  async function boundedJson'));
const clientHash=Function('crypto',hashHelpers+';return hashDataUrl;')(webcrypto);
const serverHash=createHash('sha256').update('YWJj').digest('hex');
assert.equal(await clientHash('data:image/jpeg;base64,YWJj'),serverHash,'client and server must match the same image');
assert.equal(await clientHash('YWJj'),serverHash);

let cancelled=false;
const started=Date.now();
await assert.rejects(boundedFetch(async()=>new Response(new ReadableStream({
  start(c){c.enqueue(new TextEncoder().encode('{'));},cancel(){cancelled=true;}
})), 'https://example.invalid', {signal:new AbortController().signal},30),/UPSTREAM_TIMEOUT/);
assert.ok(Date.now()-started<1000,'body timeout must apply even with a caller signal');
assert.equal(cancelled,true);
await assert.rejects(boundedFetch(async()=>new Response('too long'),'https://example.invalid',{},100,2),/UPSTREAM_RESPONSE_TOO_LARGE/);
const stop=new AbortController();stop.abort();let called=false;
await assert.rejects(boundedFetch(async()=>{called=true;return new Response('x');},'https://example.invalid',{signal:stop.signal},100));
assert.equal(called,false);
assert.equal(await (await boundedFetch(async()=>new Response('ok'),'https://example.invalid',{},100)).text(),'ok');

const admission=aiAdmission(2);
const make=()=>{const req={method:'POST',path:'/api/analyze'};const res=new EventEmitter();res.setHeader=()=>{};res.status=code=>{res.code=code;return res;};res.json=data=>{res.data=data;return res;};return {req,res};};
let admitted=0;const first=make(),second=make(),third=make();
for(const x of [first,second,third])admission(x.req,x.res,()=>admitted++);
assert.equal(admitted,2);assert.equal(third.res.code,503);
first.res.emit('finish');first.res.emit('close');
assert.equal(first.req.aiSignal.aborted,true);
const fourth=make();admission(fourth.req,fourth.res,()=>admitted++);assert.equal(admitted,3);
const fifth=make();admission(fifth.req,fifth.res,()=>admitted++);assert.equal(fifth.res.code,503,'double close must not release another request');
second.res.emit('close');fourth.res.emit('close');

const sample=()=>({top:{quality:'good',confidence:.8,visualValidity:{tongueVisible:true},tongueColor:'đỏ',coatingColor:'vàng',theoryAssessment:{generalSignals:[]}},combined:{confidence:.8,summary:'observations',generalSignals:[],stomachPatternSignals:[]},ml:{featureVector:{}}});
const sig={r:.7,g:.45,b:.42,s:.35,v:.7,purple:.05,white:.15,yellow:.03,dark:.01,spot:.05,aspect:.8,coverage:.5};
assert.equal(validAcademicSignature({}),false);
assert.equal(validAcademicSignature({...sig,r:Infinity}),false);
assert.equal(validAcademicSignature(sig),true);
const weak=evidenceReadiness(sample(),{direct:[{score:0}],matches:[{similarity:.1}]});assert.equal(weak.minimumMet,false);
const out=applyAcademicFusion(sample(),{academicSignature:sig});
assert.equal(out.ml.evidence.layers.geminiAcademic,false,'derived fusion signals are not original Gemini evidence');
assert.deepEqual(out.ml.featureVector.combined.generalSignals,out.combined.generalSignals);
assert.equal(out.ml.featureVector.combined.confidence,out.combined.confidence);
const unsupported=sample();unsupported.top={quality:'good'};unsupported.combined.generalSignals=[{label:'test-unconfirmed',confidence:.8}];
const guarded=fuse(unsupported,sig,[],{patternCandidates:[{label:'test-unconfirmed',score:.8}]},[]);
assert.deepEqual(guarded.combined.generalSignals,[],'original model claims cannot bypass the two-layer gate');
assert.equal(guarded.combined.diagnosticStatus,'insufficient-evidence');
const directOnly=fuse(sample(),sig,[],{patternCandidates:[]},[]);
assert.equal(directOnly.combined.academicFusion.acceptedPatterns.length,0,'one direct signal must not count as two layers');
for(const mutate of [a=>a.top.visualValidity.tongueVisible=false,a=>a.top.quality='poor']){
  const a=sample();mutate(a);const invalid=applyAcademicFusion(a,{academicSignature:sig});
  assert.equal(invalid.ml.learning.learningCandidate,false);assert.deepEqual(invalid.combined.generalSignals,[]);assert.equal(invalid.combined.confidence,0);
}
const poorQc=applyAcademicFusion(sample(),{academicSignature:sig,topQc:{grade:'poor'}});assert.equal(poorQc.ml.learning.learningCandidate,false);
assert.deepEqual(directPatterns({top:{tongueColor:'không đỏ',coatingColor:'không vàng',fissures:'không nứt',moisture:'không khô'}}),[]);
console.log('AI UPGRADE BEHAVIOR PASS: stalled body, cancellation, size limit, concurrent overload/recovery, evidence provenance, QC exclusion, feature-vector consistency and negation.');
