import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';

const baseUrl=String(process.env.BENCHMARK_BASE_URL||'').replace(/\/$/,'');
const manifestPath=process.env.BENCHMARK_MANIFEST||process.argv[2]||'';
const repeats=Math.max(1,Math.min(10,Number(process.env.BENCHMARK_REPEATS||1)));
const outputPath=String(process.env.BENCHMARK_OUTPUT||'').trim();
const studentToken=String(process.env.BENCHMARK_STUDENT_TOKEN||'').trim();
const adminToken=String(process.env.BENCHMARK_ADMIN_TOKEN||'').trim();

if(!baseUrl) throw new Error('BENCHMARK_BASE_URL is required. Use a QA/staging URL, not production.');
if(!manifestPath) throw new Error('BENCHMARK_MANIFEST or argv[2] is required.');
const parsedUrl=new URL(baseUrl);
const productionHosts=new Set(['ai-thiet-chan.vercel.app','ai-thiet-chan-hiu-yhct.vercel.app','ai-thiet-chan-git-main-hiu-yhct.vercel.app']);
if(productionHosts.has(parsedUrl.hostname)&&process.env.BENCHMARK_ALLOW_PRODUCTION!=='1'){
  throw new Error('Refusing to benchmark canonical production without BENCHMARK_ALLOW_PRODUCTION=1.');
}

const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const cases=Array.isArray(manifest)?manifest:Array.isArray(manifest.cases)?manifest.cases:[];
if(!cases.length) throw new Error('Benchmark manifest has no cases.');

const mimeFor=file=>{
  const ext=path.extname(file).toLowerCase();
  if(ext==='.png')return'image/png';
  if(ext==='.webp')return'image/webp';
  return'image/jpeg';
};
const dataUrl=async file=>`data:${mimeFor(file)};base64,${(await readFile(file)).toString('base64')}`;
const pct=(values,p)=>{
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  const i=Math.min(sorted.length-1,Math.max(0,Math.ceil((p/100)*sorted.length)-1));
  return Number(sorted[i].toFixed(1));
};
const mean=values=>values.length?Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(1)):null;

const headers={'content-type':'application/json'};
if(studentToken)headers.authorization=`Bearer ${studentToken}`;
if(adminToken)headers['x-aitc-admin-token']=adminToken;

const runs=[];
for(const testCase of cases){
  const id=String(testCase.id||path.basename(testCase.top||'case'));
  const mode=testCase.mode==='general'?'general':'normal';
  if(!testCase.top) throw new Error(`${id}: top image path is required`);
  if(mode==='general'&&!testCase.bottom) throw new Error(`${id}: bottom image path is required for general mode`);
  const topImage=await dataUrl(testCase.top);
  const bottomImage=mode==='general'?await dataUrl(testCase.bottom):null;
  const body={
    mode,
    topImage,topMimeType:mimeFor(testCase.top),topQc:testCase.topQc||{},
    bottomImage,bottomMimeType:mode==='general'?mimeFor(testCase.bottom):'image/jpeg',bottomQc:mode==='general'?(testCase.bottomQc||{}):null
  };
  for(let iteration=1;iteration<=repeats;iteration++){
    const started=performance.now();
    let response,data;
    try{
      response=await fetch(`${baseUrl}/api/analyze`,{method:'POST',headers,body:JSON.stringify(body)});
      data=await response.json().catch(()=>({}));
    }catch(error){
      runs.push({id,mode,iteration,ok:false,httpStatus:0,elapsedMs:Number((performance.now()-started).toFixed(1)),error:error?.message||String(error)});
      continue;
    }
    const elapsedMs=Number((performance.now()-started).toFixed(1));
    runs.push({
      id,mode,iteration,ok:Boolean(response.ok&&data?.ok),httpStatus:response.status,elapsedMs,
      model:data?.model||null,knowledgeVersion:data?.knowledgeVersion||null,
      visionStatus:data?.visionStatus||null,error:data?.message||data?.error||null,
      collectionOk:Boolean(data?.collection?.ok),duplicate:Boolean(data?.collection?.duplicate)
    });
  }
}

const successful=runs.filter(r=>r.ok);
const latencies=successful.map(r=>r.elapsedMs);
const statusCounts={};
for(const run of runs)statusCounts[String(run.httpStatus)]=(statusCounts[String(run.httpStatus)]||0)+1;
const summary={
  generatedAt:new Date().toISOString(),baseUrl,caseCount:cases.length,repeats,totalRuns:runs.length,
  successfulRuns:successful.length,successRate:Number((successful.length/Math.max(1,runs.length)).toFixed(4)),
  latencyMs:{mean:mean(latencies),p50:pct(latencies,50),p95:pct(latencies,95),max:latencies.length?Number(Math.max(...latencies).toFixed(1)):null},
  statusCounts,
  fallbackRate:null,
  fallbackRateNote:'Derive from server runtime event gemini_request_benchmark: modelIndex > 0 means fallback. Do not infer fallback from the API model field.',
  runs
};
const text=JSON.stringify(summary,null,2);
console.log(text);
if(outputPath)await writeFile(outputPath,text+'\n','utf8');
if(successful.length!==runs.length)process.exitCode=2;
