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
