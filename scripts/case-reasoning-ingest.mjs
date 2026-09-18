#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function arg(name, fallback=''){
  const i=process.argv.indexOf(name);
  return i>=0 && process.argv[i+1] ? process.argv[i+1] : fallback;
}
const registryPath=arg('--registry','llm/case-reasoning/source-registry.v1.json');
const sourceId=arg('--source-id');
const inputPath=arg('--input');
const outputPath=arg('--output');
const statePath=arg('--state', outputPath ? `${outputPath}.state.json` : '');
const expectedSha=arg('--expected-sha256','');
const maxRecords=Number(arg('--max-records','0'))||0;
if(!sourceId||!inputPath||!outputPath){
  console.error('usage: node scripts/case-reasoning-ingest.mjs --source-id <id> --input <json|jsonl> --output <jsonl> [--state <json>] [--expected-sha256 <sha>] [--max-records N]');
  process.exit(2);
}
const registry=JSON.parse(fs.readFileSync(registryPath,'utf8'));
const source=(registry.sources||[]).find(s=>s.sourceId===sourceId);
if(!source) throw new Error(`unknown source-id: ${sourceId}`);

function sha256(buf){return crypto.createHash('sha256').update(buf).digest('hex');}
const inputBytes=fs.readFileSync(inputPath);
const actualInputSha=sha256(inputBytes);
const pinnedExpected=(expectedSha||source.sha256||'').toLowerCase();
if(pinnedExpected && actualInputSha!==pinnedExpected){
  throw new Error(`input sha256 mismatch: expected ${pinnedExpected}, got ${actualInputSha}`);
}
function cleanText(v){
  return String(v??'')
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,' ')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[redacted-email]')
    .replace(/\s+/g,' ')
    .trim();
}
function roleOf(x){return String(x?.role??x?.from??x?.speaker??'').toLowerCase();}
function contentOf(x){return cleanText(x?.content??x?.value??x?.text??x?.message??'');}
function normalizeRecord(record,index){
  if(record?.schemaVersion==='aitc-case-record-v1') return record;
  const id=cleanText(record?.source_record_id??record?.id??record?.pmcid??record?.pmid??record?.uuid??String(index));
  let caseText='', target='', task='';
  if(record?.case_context || record?.intervention || record?.outcome){
    caseText=[record.case_context, record.intervention && `Intervention: ${record.intervention}`, record.outcome && `Outcome: ${record.outcome}`].filter(Boolean).join('\n');
    target=cleanText(record.reasoning_use||'');
    task='case_reasoning';
  } else if(record?.instruction!=null || record?.input!=null || record?.output!=null){
    caseText=[cleanText(record.instruction),cleanText(record.input)].filter(Boolean).join('\n');
    target=cleanText(record.output);
    task='sft';
  } else if(record?.question!=null || record?.answer!=null){
    caseText=cleanText(record.question);
    target=cleanText(record.answer);
    task='qa';
  } else {
    const turns=Array.isArray(record?.messages)?record.messages:Array.isArray(record?.conversations)?record.conversations:[];
    if(turns.length){
      const users=[], assistants=[];
      for(const t of turns){
        const r=roleOf(t), c=contentOf(t); if(!c) continue;
        if(['user','human','patient','prompt'].includes(r)) users.push(c);
        else if(['assistant','gpt','doctor','response'].includes(r)) assistants.push(c);
      }
      caseText=users.join('\n');
      target=assistants.join('\n');
      task='conversation';
    } else {
      caseText=cleanText(record?.text??record?.case??record?.prompt??'');
      target=cleanText(record?.response??record?.completion??'');
      task='text';
    }
  }
  caseText=cleanText(caseText); target=cleanText(target);
  if(!caseText && !target) return null;
  const canonical=cleanText(`${task}\n${caseText}\n${target}`).toLowerCase();
  if(canonical.length<40) return null;
  return {
    schemaVersion:'aitc-case-record-v1',
    corpusId:registry.corpusId,
    sourceId,
    sourceRecordId:id||String(index),
    task,
    caseText,
    target,
    provenance:{
      provider:source.provider||'',
      dataset:source.dataset||'',
      license:record?.license||source.license||'',
      pmid:record?.pmid||null,
      pmcid:record?.pmcid||null,
      doi:record?.doi||null,
      sourceUrl:record?.source_url||record?.sourceUrl||source.datasetCard||null,
      trustTier:source.trustTier||null,
      clinicalGold:Boolean(source.clinicalGold),
      rightsVerified:Boolean(record?.license||source.license)
    },
    hashes:{contentSha256:sha256(Buffer.from(canonical,'utf8'))}
  };
}
function tokens(text){
  const t=cleanText(text).toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];
  if(t.length<3) return t;
  const out=[]; for(let i=0;i<t.length-2;i++) out.push(`${t[i]} ${t[i+1]} ${t[i+2]}`); return out;
}
function simhash64(text){
  const vec=new Array(64).fill(0);
  for(const tok of tokens(text)){
    const h=crypto.createHash('sha256').update(tok).digest();
    let n=0n; for(let i=0;i<8;i++) n=(n<<8n)|BigInt(h[i]);
    for(let b=0;b<64;b++) vec[b]+=((n>>BigInt(b))&1n)?1:-1;
  }
  let out=0n; for(let b=0;b<64;b++) if(vec[b]>=0) out|=(1n<<BigInt(b));
  return out;
}
function hamming(a,b){let x=a^b,n=0;while(x){n+=Number(x&1n);x>>=1n;}return n;}
function blocks(h){return [0,16,32,48].map(s=>Number((h>>BigInt(s))&0xffffn));}
function parseInput(){
  const text=inputBytes.toString('utf8').trim();
  if(!text) return [];
  if(text[0]==='[' || text[0]==='{'){
    const v=JSON.parse(text);
    if(Array.isArray(v)) return v;
    if(Array.isArray(v.records)) return v.records;
    if(Array.isArray(v.data)) return v.data;
    return [v];
  }
  return text.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
}
const raw=parseInput();
const exact=new Map(), buckets=[new Map(),new Map(),new Map(),new Map()];
const accepted=[], rejected={empty:0,exactDuplicate:0,nearDuplicate:0};
function addBucket(i,key,idx){const arr=buckets[i].get(key)||[];arr.push(idx);buckets[i].set(key,arr);}
for(let i=0;i<raw.length;i++){
  if(maxRecords && accepted.length>=maxRecords) break;
  const rec=normalizeRecord(raw[i],i);
  if(!rec){rejected.empty++;continue;}
  const key=rec.hashes.contentSha256;
  if(exact.has(key)){rejected.exactDuplicate++;continue;}
  const canon=cleanText(`${rec.task}\n${rec.caseText}\n${rec.target}`).toLowerCase();
  const sh=simhash64(canon), bs=blocks(sh);
  let near=false, candidates=new Set();
  for(let k=0;k<4;k++) for(const idx of (buckets[k].get(bs[k])||[])) candidates.add(idx);
  for(const idx of candidates){
    const other=accepted[idx], lenRatio=Math.min(canon.length,other._canonLen)/Math.max(canon.length,other._canonLen);
    if(lenRatio>=0.90 && hamming(sh,other._simhash)<=3){near=true;break;}
  }
  if(near){rejected.nearDuplicate++;continue;}
  rec.hashes.simhash64=sh.toString(16).padStart(16,'0');
  rec._simhash=sh; rec._canonLen=canon.length;
  const idx=accepted.length; accepted.push(rec); exact.set(key,idx);
  for(let k=0;k<4;k++) addBucket(k,bs[k],idx);
}
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
const lines=accepted.map(r=>{
  const c={...r}; delete c._simhash; delete c._canonLen; return JSON.stringify(c);
});
fs.writeFileSync(outputPath, lines.join('\n')+(lines.length?'\n':''));
const state={
  schemaVersion:'aitc-case-ingest-state-v1',
  corpusId:registry.corpusId,
  sourceId,
  inputPath,
  inputSha256:actualInputSha,
  accepted:accepted.length,
  rejected,
  outputPath,
  outputSha256:sha256(fs.readFileSync(outputPath)),
  clinicalGoldOperationalRequirement:false,
  completedAt:new Date().toISOString()
};
if(statePath){fs.mkdirSync(path.dirname(statePath),{recursive:true});fs.writeFileSync(statePath,JSON.stringify(state,null,2)+'\n');}
console.log(JSON.stringify(state,null,2));
