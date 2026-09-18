import http from 'node:http';
import { caseRetrievalHealth, retrieveSimilarCasesByTerms } from './case-retrieval.mjs';

const PORT=Math.max(1,Number(process.env.PORT||3000));
const buckets=new Map();
const WINDOW_MS=60_000;
const MAX_REQ=120;

function ipOf(req){return String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim().slice(0,96);}
function consume(req){
  const now=Date.now(),key=ipOf(req);
  let bucket=buckets.get(key);
  if(!bucket||now-bucket.startedAt>=WINDOW_MS){bucket={startedAt:now,count:0};buckets.set(key,bucket);}
  bucket.count++;
  return bucket.count<=MAX_REQ;
}
function json(res,status,payload){
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
  res.end(JSON.stringify(payload));
}
async function bodyJson(req){
  let total=0;const chunks=[];
  for await (const chunk of req){
    total+=chunk.length;
    if(total>16_384) throw Object.assign(new Error('BODY_TOO_LARGE'),{status:413});
    chunks.push(chunk);
  }
  if(!chunks.length) return {};
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('INVALID_JSON'),{status:400});}
}

const initial=caseRetrievalHealth();
if(!initial.ready){
  console.error('case_retrieval_service_start_failed',JSON.stringify(initial));
  process.exit(1);
}

const server=http.createServer(async(req,res)=>{
  try{
    if(req.method==='GET'&&req.url==='/health'){
      const health=caseRetrievalHealth();
      return json(res,health.ready?200:503,{ok:health.ready,service:'aitc-case-retrieval-v1',...health});
    }
    if(req.method==='POST'&&req.url==='/search'){
      if(!consume(req)) return json(res,429,{ok:false,error:'RATE_LIMITED'});
      const body=await bodyJson(req);
      const terms=Array.isArray(body.terms)?body.terms:[];
      const limit=body.limit;
      const result=retrieveSimilarCasesByTerms(terms,{limit});
      return json(res,200,{ok:true,...result});
    }
    return json(res,404,{ok:false,error:'NOT_FOUND'});
  }catch(err){
    console.error('case_retrieval_service_error',String(err?.message||err).slice(0,180));
    return json(res,Number(err?.status)||500,{ok:false,error:String(err?.message||'INTERNAL_ERROR').slice(0,80)});
  }
});

server.listen(PORT,'0.0.0.0',()=>console.log(`AITC case retrieval service listening on ${PORT} records=${initial.records}`));
