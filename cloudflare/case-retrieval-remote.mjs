export const CASE_RETRIEVAL_CORPUS_ID='AITC-LLM-Case-Reasoning-v1';
export const CASE_RETRIEVAL_ENGINE='sqlite-fts5';
const DEFAULT_TOP_K=Math.min(5,Math.max(1,Number(process.env.AITC_CASE_RETRIEVAL_TOP_K||4)));
const MAX_TOP_K=5,MAX_QUERY_TERMS=14,MAX_CASE_TEXT=1200,MAX_TARGET_TEXT=650,MAX_CONTEXT_CHARS=7600;
const REMOTE_URL=String(process.env.AITC_CASE_RETRIEVAL_URL||'').trim().replace(/\/$/,'');
const REMOTE_TIMEOUT_MS=Math.max(1000,Math.min(20000,Number(process.env.AITC_CASE_RETRIEVAL_REMOTE_TIMEOUT_MS||15000)));
let remoteHealthCache={at:0,value:null};
const BILINGUAL_HINTS=[
  [/lưỡi đỏ|đỏ nhạt|đỏ sẫm|red tongue/iu,['舌红','red tongue']],
  [/nhợt|pale/iu,['舌淡','pale tongue']],
  [/tím|purple|cyanotic/iu,['舌紫','purple tongue']],
  [/rêu vàng|vàng|yellow/iu,['苔黄','yellow coating']],
  [/rêu trắng|trắng|white/iu,['苔白','white coating']],
  [/rêu dày|dày|thick/iu,['苔厚','thick coating']],
  [/rêu mỏng|mỏng|thin/iu,['苔薄','thin coating']],
  [/khô|dry/iu,['舌干','dry']],
  [/nhuận|ẩm|moist/iu,['舌润','moist']],
  [/nứt|fissure|crack/iu,['裂纹','fissure']],
  [/hằn răng|dấu răng|tooth.?mark/iu,['齿痕','toothmark']],
  [/đau đầu|headache/iu,['头痛','headache']],
  [/chóng mặt|hoa mắt|dizziness/iu,['头晕','dizziness']],
  [/đau bụng|abdominal pain/iu,['腹痛','abdominal']],
  [/tiêu chảy|diarrh/iu,['腹泻','diarrhea']],
  [/mệt|mệt mỏi|fatigue/iu,['乏力','fatigue']],
  [/ăn kém|chán ăn|appetite/iu,['食欲不振','appetite']],
  [/buồn nôn|nausea/iu,['恶心','nausea']],
  [/nôn|vomit/iu,['呕吐','vomit']],
  [/ợ hơi|belch/iu,['嗳气','belching']],
  [/trào ngược|reflux/iu,['反酸','reflux']]
];
const SYMPTOM_QUESTION_CONCEPTS=Object.freeze([
  Object.freeze({id:'headache',patterns:[/头痛/u,/headache/i,/đau đầu/iu],question:'Bạn có đau đầu không? Nếu có, đau ở vị trí nào và cảm giác đau như thế nào?'}),
  Object.freeze({id:'dizziness',patterns:[/头晕/u,/dizziness/i,/chóng mặt|hoa mắt/iu],question:'Bạn có chóng mặt hoặc hoa mắt không?'}),
  Object.freeze({id:'nausea',patterns:[/恶心/u,/nausea/i,/buồn nôn/iu],question:'Bạn có buồn nôn hoặc cảm giác muốn nôn không?'}),
  Object.freeze({id:'vomiting',patterns:[/呕吐/u,/vomit/i,/\bnôn\b/iu],question:'Bạn có nôn không? Nếu có, triệu chứng xuất hiện khi nào?'}),
  Object.freeze({id:'poor-appetite',patterns:[/食欲不振/u,/poor appetite|appetite loss/i,/ăn kém|chán ăn/iu],question:'Gần đây bạn có ăn kém hoặc chán ăn không?'}),
  Object.freeze({id:'fatigue',patterns:[/乏力/u,/fatigue/i,/mệt|mệt mỏi/iu],question:'Bạn có cảm thấy mệt hoặc thiếu sức hơn bình thường không?'}),
  Object.freeze({id:'abdominal-pain',patterns:[/腹痛/u,/abdominal pain/i,/đau bụng/iu],question:'Bạn có đau hoặc khó chịu ở bụng không?'}),
  Object.freeze({id:'diarrhea',patterns:[/腹泻/u,/diarrh/i,/tiêu chảy|đi ngoài lỏng/iu],question:'Gần đây bạn có đi ngoài lỏng hoặc tiêu chảy không?'}),
  Object.freeze({id:'belching',patterns:[/嗳气/u,/belch/i,/ợ hơi/iu],question:'Bạn có ợ hơi nhiều hoặc cảm giác đầy tức sau ăn không?'}),
  Object.freeze({id:'reflux',patterns:[/反酸/u,/reflux|acid regurgitation/i,/trào ngược|ợ chua/iu],question:'Bạn có ợ chua hoặc cảm giác trào ngược lên họng không?'})
]);
function clampLimit(v){const n=Number(v);return Number.isFinite(n)?Math.max(1,Math.min(MAX_TOP_K,Math.trunc(n))):DEFAULT_TOP_K;}
function safeText(v,max){const t=String(v||'').replace(/\s+/g,' ').trim();return t.length>max?t.slice(0,max-1)+'…':t;}
function addTerm(out,seen,v){const term=String(v||'').trim().replace(/["'\x60*:^(){}\[\]]/g,'').replace(/\s+/g,' ');if(!term||term.length>48)return;const key=term.toLowerCase();if(seen.has(key))return;seen.add(key);out.push(term);}
export function buildRemoteCaseRetrievalTerms(input){
  const text=String(input||'').slice(0,5000),out=[],seen=new Set();
  for(const [pattern,hints] of BILINGUAL_HINTS){if(pattern.test(text))for(const hint of hints)addTerm(out,seen,hint);if(out.length>=MAX_QUERY_TERMS)break;}
  if(!out.some(t=>t.startsWith('舌')||/tongue/i.test(t))&&/lưỡi|tongue/iu.test(text)){addTerm(out,seen,'舌');addTerm(out,seen,'tongue');}
  if(!out.some(t=>t.startsWith('苔')||/coating/i.test(t))&&/rêu|coating/iu.test(text)){addTerm(out,seen,'苔');addTerm(out,seen,'coating');}
  return out.slice(0,MAX_QUERY_TERMS);
}
export const buildCaseRetrievalTerms=buildRemoteCaseRetrievalTerms;
function conceptPresent(c,t){return c.patterns.some(p=>p.test(String(t||'')));}
export function suggestNextSymptomQuestion(userText,retrievalResult){
  const current=String(userText||'').slice(0,5000),cases=Array.isArray(retrievalResult?.cases)?retrievalResult.cases:[];
  if(!cases.length)return{question:'Bạn còn triệu chứng hoặc khó chịu nào khác không?',conceptId:null,supportCases:0,consideredCases:0,evidenceBased:false,engine:'deterministic-case-rag-v1'};
  const counts=new Map();
  for(const item of cases){const text=String(item?.caseText||'');for(const concept of SYMPTOM_QUESTION_CONCEPTS){if(conceptPresent(concept,current))continue;if(conceptPresent(concept,text))counts.set(concept.id,(counts.get(concept.id)||0)+1);}}
  let selected=null,supportCases=0;for(const concept of SYMPTOM_QUESTION_CONCEPTS){const count=counts.get(concept.id)||0;if(count>supportCases){selected=concept;supportCases=count;}}
  if(!selected)return{question:'Bạn còn triệu chứng hoặc khó chịu nào khác không?',conceptId:null,supportCases:0,consideredCases:cases.length,evidenceBased:false,engine:'deterministic-case-rag-v1'};
  return{question:selected.question,conceptId:selected.id,supportCases,consideredCases:cases.length,evidenceBased:true,engine:'deterministic-case-rag-v1'};
}
export function caseRetrievalHealth(){return{corpusId:CASE_RETRIEVAL_CORPUS_ID,engine:CASE_RETRIEVAL_ENGINE,configured:Boolean(REMOTE_URL),ready:false,records:0,sourceCounts:{},defaultTopK:DEFAULT_TOP_K,maxTopK:MAX_TOP_K,errorCode:REMOTE_URL?'remote-only':'not-configured'};}
export function retrieveSimilarCasesByTerms(values,{limit=DEFAULT_TOP_K}={}){return{corpusId:CASE_RETRIEVAL_CORPUS_ID,engine:CASE_RETRIEVAL_ENGINE,active:false,terms:Array.isArray(values)?values.slice(0,MAX_QUERY_TERMS):[],limit:clampLimit(limit),returned:0,cases:[],errorCode:'remote-only'};}
export function retrieveSimilarCases(input,{limit=DEFAULT_TOP_K}={}){return retrieveSimilarCasesByTerms(buildRemoteCaseRetrievalTerms(input),{limit});}
function normalizeRemoteCases(payload,terms,limit){
  const boundedLimit=clampLimit(limit);
  const cases=Array.isArray(payload?.cases)?payload.cases.slice(0,boundedLimit).map(item=>({id:Number(item?.id||0),sourceId:String(item?.sourceId||'').slice(0,120),sourceRecordId:String(item?.sourceRecordId||'').slice(0,160),task:String(item?.task||'').slice(0,80),rank:Number(Number(item?.rank||0).toFixed(6)),caseText:safeText(item?.caseText,MAX_CASE_TEXT),target:safeText(item?.target,MAX_TARGET_TEXT),provenance:{license:String(item?.provenance?.license||'').slice(0,80),pmid:String(item?.provenance?.pmid||'').slice(0,80),pmcid:String(item?.provenance?.pmcid||'').slice(0,80),doi:String(item?.provenance?.doi||'').slice(0,160)}})):[];
  return{corpusId:CASE_RETRIEVAL_CORPUS_ID,engine:CASE_RETRIEVAL_ENGINE,active:true,terms,limit:boundedLimit,returned:cases.length,cases,errorCode:null,mode:'remote'};
}
async function remoteFetchJson(pathname,init={}){
  if(!REMOTE_URL)throw new Error('REMOTE_NOT_CONFIGURED');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),REMOTE_TIMEOUT_MS);
  try{const response=await fetch(REMOTE_URL+pathname,{...init,signal:controller.signal,headers:{'content-type':'application/json',...(init.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error('REMOTE_HTTP_'+response.status);return data;}finally{clearTimeout(timer);}
}
export async function caseRetrievalRuntimeHealth(){
  if(!REMOTE_URL)return{...caseRetrievalHealth(),mode:'disabled',remoteConfigured:false};
  const now=Date.now();if(remoteHealthCache.value){const ttl=remoteHealthCache.value.ready?30000:3000;if(now-remoteHealthCache.at<ttl)return remoteHealthCache.value;}
  try{const data=await remoteFetchJson('/health',{method:'GET',headers:{}});const value={corpusId:CASE_RETRIEVAL_CORPUS_ID,engine:CASE_RETRIEVAL_ENGINE,configured:true,ready:Boolean(data?.ready||data?.ok),records:Number(data?.records||0),sourceCounts:data?.sourceCounts&&typeof data.sourceCounts==='object'?data.sourceCounts:{},defaultTopK:DEFAULT_TOP_K,maxTopK:MAX_TOP_K,errorCode:(data?.ready||data?.ok)?null:String(data?.errorCode||'remote-not-ready'),mode:'remote',localConfigured:false,remoteConfigured:true};remoteHealthCache={at:now,value};return value;}
  catch{return{...caseRetrievalHealth(),configured:true,ready:false,errorCode:'remote-unavailable',mode:'remote',localConfigured:false,remoteConfigured:true};}
}
export async function retrieveSimilarCasesRuntime(input,{limit=DEFAULT_TOP_K}={}){
  const terms=buildRemoteCaseRetrievalTerms(input),boundedLimit=clampLimit(limit);
  if(!terms.length)return{corpusId:CASE_RETRIEVAL_CORPUS_ID,engine:CASE_RETRIEVAL_ENGINE,active:Boolean(REMOTE_URL),terms,limit:boundedLimit,returned:0,cases:[],errorCode:'no-query-terms',mode:REMOTE_URL?'remote':'disabled'};
  if(!REMOTE_URL)return{corpusId:CASE_RETRIEVAL_CORPUS_ID,engine:CASE_RETRIEVAL_ENGINE,active:false,terms,limit:boundedLimit,returned:0,cases:[],errorCode:'not-configured',mode:'disabled'};
  try{return normalizeRemoteCases(await remoteFetchJson('/search',{method:'POST',body:JSON.stringify({terms,limit:boundedLimit})}),terms,boundedLimit);}
  catch{return{corpusId:CASE_RETRIEVAL_CORPUS_ID,engine:CASE_RETRIEVAL_ENGINE,active:false,terms,limit:boundedLimit,returned:0,cases:[],errorCode:'remote-query-failed',mode:'remote'};}
}
export function formatCaseRetrievalContext(result){
  const cases=Array.isArray(result?.cases)?result.cases:[];if(!cases.length)return'';
  let text=cases.map((item,index)=>['CA '+(index+1)+' | source='+item.sourceId+' | task='+item.task+' | record='+(item.sourceRecordId||item.id)+' | bm25='+item.rank,'Dữ kiện ca: '+item.caseText,item.target?'Đáp án/diễn giải trong corpus (chỉ tham khảo, không phải gold): '+item.target:'','Provenance: '+JSON.stringify(item.provenance)].filter(Boolean).join('\n')).join('\n\n');
  if(text.length>MAX_CONTEXT_CHARS)text=text.slice(0,MAX_CONTEXT_CHARS-1)+'…';
  return text;
}
