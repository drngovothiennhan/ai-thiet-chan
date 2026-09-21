export const OFFLINE_QUEUE_VERSION='aitc-offline-queue-v1';

function clone(value){return JSON.parse(JSON.stringify(value));}
function validId(value){return /^[A-Za-z0-9._:-]{8,160}$/.test(String(value||''));}
function normalizeJob(raw={}){
  if(!validId(raw.idempotencyKey))throw new Error('QUEUE_IDEMPOTENCY_KEY_INVALID');
  return {
    idempotencyKey:String(raw.idempotencyKey),
    caseId:String(raw.caseId||'').slice(0,160),
    createdAt:String(raw.createdAt||new Date().toISOString()),
    nextAttemptAt:String(raw.nextAttemptAt||raw.createdAt||new Date().toISOString()),
    attempts:Math.max(0,Math.trunc(Number(raw.attempts)||0)),
    state:['pending','sending','sent','dead-letter'].includes(raw.state)?raw.state:'pending',
    envelope:clone(raw.envelope||{}),
    lastError:raw.lastError?String(raw.lastError).slice(0,240):null
  };
}
export function emptyQueue(){return {schemaVersion:OFFLINE_QUEUE_VERSION,jobs:[]};}
export function enqueue(queue=emptyQueue(),job={}){
  const out=clone(queue);if(out.schemaVersion!==OFFLINE_QUEUE_VERSION)throw new Error('QUEUE_SCHEMA_INVALID');
  const normalized=normalizeJob(job);
  const existing=out.jobs.find(x=>x.idempotencyKey===normalized.idempotencyKey);
  if(existing)return out;
  out.jobs.push(normalized);return out;
}
export function dueJobs(queue=emptyQueue(),now=new Date()){
  const t=now instanceof Date?now.getTime():new Date(now).getTime();
  return clone(queue.jobs.filter(x=>x.state==='pending'&&new Date(x.nextAttemptAt).getTime()<=t));
}
export function markSending(queue,key){return transition(queue,key,job=>({...job,state:'sending',attempts:job.attempts+1}));}
export function markSent(queue,key){return transition(queue,key,job=>({...job,state:'sent',lastError:null}));}
export function markRetry(queue,key,{now=new Date(),errorCode='send-failed',maxAttempts=6}={}){
  return transition(queue,key,job=>{
    const attempts=Math.max(1,job.attempts);
    if(attempts>=maxAttempts)return {...job,state:'dead-letter',lastError:String(errorCode).slice(0,240)};
    const delayMs=Math.min(60*60*1000,Math.max(5000,5000*(2**Math.min(7,attempts-1))));
    return {...job,state:'pending',nextAttemptAt:new Date(new Date(now).getTime()+delayMs).toISOString(),lastError:String(errorCode).slice(0,240)};
  });
}
function transition(queue,key,fn){
  const out=clone(queue);const i=out.jobs.findIndex(x=>x.idempotencyKey===key);if(i<0)return out;
  out.jobs[i]=fn(out.jobs[i]);return out;
}
export function compactQueue(queue=emptyQueue(),{keepSent=20}={}){
  const out=clone(queue);const sent=out.jobs.filter(x=>x.state==='sent');
  const keep=new Set(sent.slice(-Math.max(0,keepSent)).map(x=>x.idempotencyKey));
  out.jobs=out.jobs.filter(x=>x.state!=='sent'||keep.has(x.idempotencyKey));return out;
}
