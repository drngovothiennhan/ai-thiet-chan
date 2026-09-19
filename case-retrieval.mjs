import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const CASE_RETRIEVAL_CORPUS_ID = 'AITC-LLM-Case-Reasoning-v1';
export const CASE_RETRIEVAL_ENGINE = 'sqlite-fts5';
const DEFAULT_TOP_K = Math.min(5, Math.max(1, Number(process.env.AITC_CASE_RETRIEVAL_TOP_K || 4)));
const MAX_TOP_K = 5;
const MAX_QUERY_TERMS = 14;
const MAX_CASE_TEXT = 1200;
const MAX_TARGET_TEXT = 650;
const MAX_CONTEXT_CHARS = 7600;

let state = { initialized:false, configured:false, ready:false, db:null, statement:null, records:0, sourceCounts:{}, errorCode:null };
const VERIFIED_REMOTE_URL='https://aitc-case-retrieval-preview.onrender.com';
const DEFAULT_REMOTE_URL=['preview','production'].includes(String(process.env.VERCEL_ENV||''))?VERIFIED_REMOTE_URL:'';
const REMOTE_URL=String(process.env.AITC_CASE_RETRIEVAL_URL||DEFAULT_REMOTE_URL).trim().replace(/\/$/,'');
const REMOTE_TIMEOUT_MS=Math.max(1000,Math.min(20000,Number(process.env.AITC_CASE_RETRIEVAL_REMOTE_TIMEOUT_MS||15000)));
let remoteHealthCache={at:0,value:null};

const BILINGUAL_HINTS = [
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


const SYMPTOM_QUESTION_CONCEPTS = Object.freeze([
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
function conceptPresent(concept,text){return concept.patterns.some(pattern=>pattern.test(String(text||'')));}
export function suggestNextSymptomQuestion(userText,retrievalResult){
  const current=String(userText||'').slice(0,5000);
  const cases=Array.isArray(retrievalResult?.cases)?retrievalResult.cases:[];
  if(!cases.length)return {question:'Bạn còn triệu chứng hoặc khó chịu nào khác không?',conceptId:null,supportCases:0,consideredCases:0,evidenceBased:false,engine:'deterministic-case-rag-v1'};
  const counts=new Map();
  for(const item of cases){
    const text=String(item?.caseText||'');
    for(const concept of SYMPTOM_QUESTION_CONCEPTS){
      if(conceptPresent(concept,current))continue;
      if(conceptPresent(concept,text))counts.set(concept.id,(counts.get(concept.id)||0)+1);
    }
  }
  let selected=null,supportCases=0;
  for(const concept of SYMPTOM_QUESTION_CONCEPTS){
    const count=counts.get(concept.id)||0;
    if(count>supportCases){selected=concept;supportCases=count;}
  }
  if(!selected)return {question:'Bạn còn triệu chứng hoặc khó chịu nào khác không?',conceptId:null,supportCases:0,consideredCases:cases.length,evidenceBased:false,engine:'deterministic-case-rag-v1'};
  return {question:selected.question,conceptId:selected.id,supportCases,consideredCases:cases.length,evidenceBased:true,engine:'deterministic-case-rag-v1'};
}

function clampLimit(value){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(1,Math.min(MAX_TOP_K,Math.trunc(n))):DEFAULT_TOP_K;
}
function safeText(value,max){
  const text=String(value||'').replace(/\s+/g,' ').trim();
  return text.length>max?`${text.slice(0,max-1)}…`:text;
}
function addTerm(out,seen,value){
  const term=String(value||'').trim().replace(/["'`*:^(){}\[\]]/g,'').replace(/\s+/g,' ');
  if(!term||term.length>48) return;
  const key=term.toLocaleLowerCase('en-US');
  if(seen.has(key)) return;
  seen.add(key);out.push(term);
}
export function buildRemoteCaseRetrievalTerms(input){
  const text=String(input||'').slice(0,5000);
  const out=[],seen=new Set();
  for(const [pattern,hints] of BILINGUAL_HINTS){
    if(pattern.test(text)) for(const hint of hints) addTerm(out,seen,hint);
    if(out.length>=MAX_QUERY_TERMS) break;
  }
  const hasTongueFeature=out.some(term=>term.startsWith('舌')||/tongue/i.test(term));
  if(!hasTongueFeature&&/lưỡi|tongue/iu.test(text)){addTerm(out,seen,'舌');addTerm(out,seen,'tongue');}
  const hasCoatingFeature=out.some(term=>term.startsWith('苔')||/coating/i.test(term));
  if(!hasCoatingFeature&&/rêu|coating/iu.test(text)){addTerm(out,seen,'苔');addTerm(out,seen,'coating');}
  return out.slice(0,MAX_QUERY_TERMS);
}
export function buildCaseRetrievalTerms(input){
  const text=String(input||'').slice(0,5000);
  const out=[],seen=new Set();
  for(const [pattern,hints] of BILINGUAL_HINTS){
    if(pattern.test(text)) for(const hint of hints) addTerm(out,seen,hint);
    if(out.length>=MAX_QUERY_TERMS) break;
  }
  const hasTongueFeature=out.some(term=>term.startsWith('舌')||/tongue/i.test(term));
  if(!hasTongueFeature&&/lưỡi|tongue/iu.test(text)){addTerm(out,seen,'舌');addTerm(out,seen,'tongue');}
  const hasCoatingFeature=out.some(term=>term.startsWith('苔')||/coating/i.test(term));
  if(!hasCoatingFeature&&/rêu|coating/iu.test(text)){addTerm(out,seen,'苔');addTerm(out,seen,'coating');}
  const cjk=text.match(/[\p{Script=Han}]{2,12}/gu)||[];
  for(const token of cjk){addTerm(out,seen,token);if(out.length>=MAX_QUERY_TERMS)break;}
  const latin=text.normalize('NFKC').match(/[\p{L}\p{N}][\p{L}\p{N}-]{3,}/gu)||[];
  const stop=new Set(['không','trong','người','dùng','phân','tích','kết','quả','structured','analysis','with','from','that','this','the','and','của','cho','với','được']);
  for(const token of latin){
    if(stop.has(token.toLocaleLowerCase('vi'))) continue;
    addTerm(out,seen,token);
    if(out.length>=MAX_QUERY_TERMS) break;
  }
  return out.slice(0,MAX_QUERY_TERMS);
}
function toFtsQuery(terms){return terms.map(term=>`"${term.replace(/"/g,'')}"`).join(' OR ');}
function initialize(){
  if(state.initialized) return state;
  state.initialized=true;
  const configuredPath=String(process.env.AITC_CASE_RETRIEVAL_DB||'').trim();
  state.configured=Boolean(configuredPath);
  if(!configuredPath){state.errorCode='not-configured';return state;}
  const dbPath=path.resolve(configuredPath);
  if(!fs.existsSync(dbPath)){state.errorCode='snapshot-not-found';return state;}
  try{
    const db=new DatabaseSync(dbPath,{readOnly:true});
    db.exec('PRAGMA query_only=ON');
    const records=Number(db.prepare('SELECT count(*) AS n FROM cases').get()?.n||0);
    db.prepare('SELECT rowid FROM cases_fts LIMIT 1').get();
    const sourceRows=db.prepare('SELECT source_id,count(*) AS n FROM cases GROUP BY source_id').all();
    const statement=db.prepare(`SELECT c.id,c.source_id,c.source_record_id,c.task,c.case_text,c.target,c.provenance_json,c.pmid,c.pmcid,c.doi,c.license,bm25(cases_fts) AS rank FROM cases_fts JOIN cases c ON c.id=cases_fts.rowid WHERE cases_fts MATCH ? ORDER BY rank ASC,c.id ASC LIMIT ?`);
    state={...state,ready:true,db,statement,records,sourceCounts:Object.fromEntries(sourceRows.map(r=>[String(r.source_id||''),Number(r.n||0)])),errorCode:null};
  }catch(err){
    state={...state,ready:false,errorCode:'snapshot-open-failed'};
    console.warn('case_retrieval_init_failed',String(err?.message||err).slice(0,180));
  }
  return state;
}
export function caseRetrievalHealth(){
  const s=initialize();
  return {corpusId:CASE_RETRIEVAL_CORPUS_ID,engine:CASE_RETRIEVAL_ENGINE,configured:s.configured,ready:s.ready,records:s.ready?s.records:0,sourceCounts:s.ready?s.sourceCounts:{},defaultTopK:DEFAULT_TOP_K,maxTopK:MAX_TOP_K,errorCode:s.errorCode};
}
function normalizeCaseRetrievalTerms(values){
  const out=[],seen=new Set();
  for(const value of Array.isArray(values)?values:[]){
    addTerm(out,seen,value);
    if(out.length>=MAX_QUERY_TERMS) break;
  }
  return out;
}
export function retrieveSimilarCasesByTerms(values,{limit=DEFAULT_TOP_K}={}){
  const s=initialize();
  const boundedLimit=clampLimit(limit);
  const terms=normalizeCaseRetrievalTerms(values);
  if(!s.ready||!terms.length) return {corpusId:CASE_RETRIEVAL_CORPUS_ID,engine:CASE_RETRIEVAL_ENGINE,active:s.ready,terms,limit:boundedLimit,returned:0,cases:[],errorCode:s.ready?'no-query-terms':s.errorCode};
  try{
    const rows=s.statement.all(toFtsQuery(terms),boundedLimit);
    const cases=rows.map(row=>{
      let provenance={};
      try{provenance=JSON.parse(String(row.provenance_json||'{}'));}catch{}
      return {
        id:Number(row.id),sourceId:String(row.source_id||''),sourceRecordId:String(row.source_record_id||''),task:String(row.task||''),
        rank:Number(Number(row.rank||0).toFixed(6)),caseText:safeText(row.case_text,MAX_CASE_TEXT),target:safeText(row.target,MAX_TARGET_TEXT),
        provenance:{license:String(row.license||provenance.license||''),pmid:String(row.pmid||provenance.pmid||''),pmcid:String(row.pmcid||provenance.pmcid||''),doi:String(row.doi||provenance.doi||'')}
      };
    });
    return {corpusId:CASE_RETRIEVAL_CORPUS_ID,engine:CASE_RETRIEVAL_ENGINE,active:true,terms,limit:boundedLimit,returned:cases.length,cases,errorCode:null};
  }catch(err){
    console.warn('case_retrieval_query_failed',String(err?.message||err).slice(0,180));
    return {corpusId:CASE_RETRIEVAL_CORPUS_ID,engine:CASE_RETRIEVAL_ENGINE,active:true,terms,limit:boundedLimit,returned:0,cases:[],errorCode:'query-failed'};
  }
}
export function retrieveSimilarCases(input,{limit=DEFAULT_TOP_K}={}){
  return retrieveSimilarCasesByTerms(buildCaseRetrievalTerms(input),{limit});
}
function normalizeRemoteCases(payload,terms,limit){
  const boundedLimit=clampLimit(limit);
  const cases=Array.isArray(payload?.cases)?payload.cases.slice(0,boundedLimit).map(item=>({
    id:Number(item?.id||0),
    sourceId:String(item?.sourceId||'').slice(0,120),
    sourceRecordId:String(item?.sourceRecordId||'').slice(0,160),
    task:String(item?.task||'').slice(0,80),
    rank:Number(Number(item?.rank||0).toFixed(6)),
    caseText:safeText(item?.caseText,MAX_CASE_TEXT),
    target:safeText(item?.target,MAX_TARGET_TEXT),
    provenance:{
      license:String(item?.provenance?.license||'').slice(0,80),
      pmid:String(item?.provenance?.pmid||'').slice(0,80),
      pmcid:String(item?.provenance?.pmcid||'').slice(0,80),
      doi:String(item?.provenance?.doi||'').slice(0,160)
    }
  })):[]; 
  return {corpusId:CASE_RETRIEVAL_CORPUS_ID,engine:CASE_RETRIEVAL_ENGINE,active:true,terms,limit:boundedLimit,returned:cases.length,cases,errorCode:null,mode:'remote'};
}
async function remoteFetchJson(pathname,init={}){
  if(!REMOTE_URL) throw new Error('REMOTE_NOT_CONFIGURED');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),REMOTE_TIMEOUT_MS);
  try{
    const response=await fetch(`${REMOTE_URL}${pathname}`,{...init,signal:controller.signal,headers:{'content-type':'application/json',...(init.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(`REMOTE_HTTP_${response.status}`);
    return data;
  }finally{clearTimeout(timer);}
}
export async function caseRetrievalRuntimeHealth(){
  const local=caseRetrievalHealth();
  if(local.ready) return {...local,mode:'local',remoteConfigured:Boolean(REMOTE_URL)};
  if(!REMOTE_URL) return {...local,mode:'disabled',remoteConfigured:false};
  const now=Date.now();
  if(remoteHealthCache.value){
    const ttl=remoteHealthCache.value.ready?30_000:3_000;
    if(now-remoteHealthCache.at<ttl) return remoteHealthCache.value;
  }
  try{
    const data=await remoteFetchJson('/health',{method:'GET',headers:{}});
    const value={
      corpusId:CASE_RETRIEVAL_CORPUS_ID,
      engine:CASE_RETRIEVAL_ENGINE,
      configured:true,
      ready:Boolean(data?.ready||data?.ok),
      records:Number(data?.records||0),
      sourceCounts:data?.sourceCounts&&typeof data.sourceCounts==='object'?data.sourceCounts:{},
      defaultTopK:DEFAULT_TOP_K,
      maxTopK:MAX_TOP_K,
      errorCode:(data?.ready||data?.ok)?null:String(data?.errorCode||'remote-not-ready'),
      mode:'remote',
      localConfigured:local.configured,
      remoteConfigured:true
    };
    remoteHealthCache={at:now,value};
    return value;
  }catch(err){
    const value={...local,configured:true,ready:false,errorCode:'remote-unavailable',mode:'remote',localConfigured:local.configured,remoteConfigured:true};
    remoteHealthCache={at:now,value};
    console.warn('case_retrieval_remote_health_failed',String(err?.message||err).slice(0,160));
    return value;
  }
}
export async function retrieveSimilarCasesRuntime(input,{limit=DEFAULT_TOP_K}={}){
  const local=caseRetrievalHealth();
  if(local.ready) return {...retrieveSimilarCases(input,{limit}),mode:'local'};
  const terms=buildRemoteCaseRetrievalTerms(input);
  const boundedLimit=clampLimit(limit);
  if(!terms.length) return {corpusId:CASE_RETRIEVAL_CORPUS_ID,engine:CASE_RETRIEVAL_ENGINE,active:Boolean(REMOTE_URL),terms,limit:boundedLimit,returned:0,cases:[],errorCode:'no-query-terms',mode:REMOTE_URL?'remote':'disabled'};
  if(!REMOTE_URL) return {corpusId:CASE_RETRIEVAL_CORPUS_ID,engine:CASE_RETRIEVAL_ENGINE,active:false,terms,limit:boundedLimit,returned:0,cases:[],errorCode:local.errorCode,mode:'disabled'};
  try{
    const payload=await remoteFetchJson('/search',{method:'POST',body:JSON.stringify({terms,limit:boundedLimit})});
    return normalizeRemoteCases(payload,terms,boundedLimit);
  }catch(err){
    console.warn('case_retrieval_remote_query_failed',String(err?.message||err).slice(0,160));
    return {corpusId:CASE_RETRIEVAL_CORPUS_ID,engine:CASE_RETRIEVAL_ENGINE,active:false,terms,limit:boundedLimit,returned:0,cases:[],errorCode:'remote-query-failed',mode:'remote'};
  }
}
export function formatCaseRetrievalContext(result){
  const cases=Array.isArray(result?.cases)?result.cases:[];
  if(!cases.length) return '';
  let text=cases.map((item,index)=>[
    `CA ${index+1} | source=${item.sourceId} | task=${item.task} | record=${item.sourceRecordId||item.id} | bm25=${item.rank}`,
    `Dữ kiện ca: ${item.caseText}`,
    item.target?`Đáp án/diễn giải trong corpus (chỉ tham khảo, không phải gold): ${item.target}`:'',
    `Provenance: ${JSON.stringify(item.provenance)}`
  ].filter(Boolean).join('\n')).join('\n\n');
  if(text.length>MAX_CONTEXT_CHARS) text=`${text.slice(0,MAX_CONTEXT_CHARS-1)}…`;
  return text;
}
