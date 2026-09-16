import { readFile, writeFile } from 'node:fs/promises';

const files={
  server:new URL('../server.mjs',import.meta.url),
  hotfix:new URL('../public/analysis-hotfix.js',import.meta.url),
  test:new URL('../tests/analysis-hotfix-smoke.mjs',import.meta.url)
};

function replaceOnce(text,needle,replacement,label){
  if(text.includes(replacement)) return text;
  const at=text.indexOf(needle);
  if(at<0) throw new Error(`PATCH_ANCHOR_NOT_FOUND:${label}`);
  if(text.indexOf(needle,at+needle.length)>=0) throw new Error(`PATCH_ANCHOR_NOT_UNIQUE:${label}`);
  return text.slice(0,at)+replacement+text.slice(at+needle.length);
}

let server=await readFile(files.server,'utf8');
server=replaceOnce(
  server,
  "async function storeTrainingCase({mode,topImage,topMimeType,topQc,bottomImage,bottomMimeType,bottomQc,assessment}){",
  "async function storeTrainingCase({mode,topImage,topMimeType,topQc,bottomImage,bottomMimeType,bottomQc,assessment,model=MODEL,knowledgeVersion=KNOWLEDGE_VERSION}){",
  'storeTrainingCase-signature'
);
server=replaceOnce(
  server,
  "    p_qc:{top:topQc||{},bottom:bottomQc||null},p_analysis:assessment||{},p_feature_vector:assessment?.ml?.featureVector||{},p_model:MODEL,p_knowledge_version:KNOWLEDGE_VERSION\n",
  "    p_qc:{top:topQc||{},bottom:bottomQc||null},p_analysis:assessment||{},p_feature_vector:assessment?.ml?.featureVector||{},p_model:model,p_knowledge_version:knowledgeVersion\n",
  'storeTrainingCase-provenance'
);

const routeAnchor="app.post('/api/analyze',aiRateLimit,async(req,res)=>{";
const routePatch=`app.post('/api/local-fusion',(req,res)=>{\n  try{\n    const assessment=req.body?.assessment;\n    if(!assessment||typeof assessment!=='object') return res.status(400).json({error:'ASSESSMENT_REQUIRED'});\n    const body=req.body?.body&&typeof req.body.body==='object'?req.body.body:{};\n    const fused=applyAcademicFusion(assessment,body);\n    return res.json({ok:true,assessment:fused,academicFusion:Boolean(fused?.combined?.academicFusion)});\n  }catch(err){\n    console.error('local_fusion_error',err?.message||err);\n    return res.status(422).json({error:'LOCAL_FUSION_FAILED',message:err?.message||'Unknown error'});\n  }\n});\n\napp.post('/api/cases/collect-local',aiRateLimit,async(req,res)=>{\n  try{\n    if(!apiKey()) return res.status(428).json({error:'AI_PROVIDER_NOT_CONFIGURED'});\n    const body=req.body||{};\n    const mode=body.mode==='general'?'general':'normal';\n    const topImage=body.topImage||body.image;\n    const topMimeType=body.topMimeType||body.mimeType||'image/jpeg';\n    const topQc=body.topQc||body.qc||{};\n    const bottomImage=mode==='general'?body.bottomImage:null;\n    const bottomMimeType=body.bottomMimeType||'image/jpeg';\n    const bottomQc=mode==='general'?(body.bottomQc||{}):null;\n    validateImage(topImage,'TOP_IMAGE');\n    if(mode==='general') validateImage(bottomImage,'BOTTOM_IMAGE');\n    const assessment=body.assessment||body.analysis;\n    if(!assessment||typeof assessment!=='object') return res.status(400).json({error:'ASSESSMENT_REQUIRED'});\n    const model=String(body.model||'local-open-source-vision-v1').slice(0,120);\n    const knowledgeVersion=String(body.knowledgeVersion||assessment?.knowledgeVersion||KNOWLEDGE_VERSION).slice(0,160);\n    const saved=await storeTrainingCase({mode,topImage,topMimeType,topQc,bottomImage,bottomMimeType,bottomQc,assessment,model,knowledgeVersion});\n    return res.json({ok:true,collection:{ok:true,stored:Boolean(saved?.stored),duplicate:Boolean(saved?.duplicate),caseId:saved?.id||null,source:'local-fallback'}});\n  }catch(err){\n    console.error('local_case_store_error',err?.message||err);\n    const status=err?.status===400||err?.status===413?err.status:err?.status===429?429:503;\n    return res.status(status).json({error:'LOCAL_CASE_STORE_FAILED',message:err?.message||'Unknown error'});\n  }\n});\n\n${routeAnchor}`;
if(!server.includes("app.post('/api/cases/collect-local'")){
  server=replaceOnce(server,routeAnchor,routePatch,'local-persistence-routes');
}
await writeFile(files.server,server);

let hotfix=await readFile(files.hotfix,'utf8');
hotfix=replaceOnce(
  hotfix,
  "const FALLBACK_DEADLINE_MS=8_500;\nconst FALLBACK_CONFIDENCE_CAP=.62;",
  "const FALLBACK_DEADLINE_MS=8_500;\nconst LOCAL_PERSIST_DEADLINE_MS=3_500;\nconst FALLBACK_CONFIDENCE_CAP=.62;",
  'persist-deadline'
);
const oldLocalResponse=`function localResponse(body,prepared,reason,requestStarted){\n  const requestToResultMs=Math.round(now()-requestStarted);\n  const payload={ok:true,assessment:prepared.assessment,analysis:prepared.assessment,model:null,knowledgeVersion:'thiet-chan-kb-2026-09-15.5doc',collection:{ok:false,stored:false,backgroundSync:true,localVision:true},localVision:true,visionStatus:'local-image-analysis',fallback:true,inferenceSource:'local-open-source-vision-v1',fallbackReason:reason,academicFusion:Boolean(prepared.academicFusion),timing:{requestToResultMs,localVisionMs:prepared.localVisionMs,fusionMs:prepared.fusionMs,fallbackDeadlineMs:FALLBACK_DEADLINE_MS}};\n  lastMetrics={requestToResultMs,localVisionMs:prepared.localVisionMs,fusionMs:prepared.fusionMs,fallback:true,fallbackReason:reason,inferenceSource:'local-open-source-vision-v1',mode:body.mode==='general'?'general':'normal',success:true};\n  return new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json','cache-control':'no-store','x-aitc-vision':'local-parallel-fallback','x-aitc-fallback-reason':reason}});\n}`;
const newLocalResponse=`async function persistLocalFallback(body,assessment){\n  const mode=body.mode==='general'?'general':'normal';\n  const controller=new AbortController();\n  const timer=setTimeout(()=>controller.abort(),LOCAL_PERSIST_DEADLINE_MS);\n  try{\n    const payload={\n      mode,topImage:body.topImage||body.image,topMimeType:body.topMimeType||body.mimeType||'image/jpeg',topQc:body.topQc||body.qc||{},\n      bottomImage:mode==='general'?body.bottomImage:null,bottomMimeType:body.bottomMimeType||'image/jpeg',bottomQc:mode==='general'?(body.bottomQc||{}):null,\n      assessment,model:'local-open-source-vision-v1',knowledgeVersion:'thiet-chan-kb-2026-09-15.5doc'\n    };\n    const response=await priorFetch('/api/cases/collect-local',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});\n    const data=await response.json().catch(()=>null);\n    if(response.ok&&data?.collection?.ok) return data.collection;\n    return{ok:false,stored:false,duplicate:false,error:data?.error||'LOCAL_CASE_STORE_FAILED'};\n  }catch(err){\n    return{ok:false,stored:false,duplicate:false,error:err?.name==='AbortError'?'LOCAL_CASE_STORE_TIMEOUT':'LOCAL_CASE_STORE_FAILED'};\n  }finally{clearTimeout(timer);}\n}\nasync function localResponse(body,prepared,reason,requestStarted){\n  const collection=await persistLocalFallback(body,prepared.assessment);\n  const requestToResultMs=Math.round(now()-requestStarted);\n  const payload={ok:true,assessment:prepared.assessment,analysis:prepared.assessment,model:null,knowledgeVersion:'thiet-chan-kb-2026-09-15.5doc',collection:{...collection,backgroundSync:false,localVision:true},localVision:true,visionStatus:'local-image-analysis',fallback:true,inferenceSource:'local-open-source-vision-v1',fallbackReason:reason,academicFusion:Boolean(prepared.academicFusion),timing:{requestToResultMs,localVisionMs:prepared.localVisionMs,fusionMs:prepared.fusionMs,fallbackDeadlineMs:FALLBACK_DEADLINE_MS,persistDeadlineMs:LOCAL_PERSIST_DEADLINE_MS}};\n  lastMetrics={requestToResultMs,localVisionMs:prepared.localVisionMs,fusionMs:prepared.fusionMs,fallback:true,fallbackReason:reason,inferenceSource:'local-open-source-vision-v1',mode:body.mode==='general'?'general':'normal',collectionOk:Boolean(collection.ok),success:true};\n  return new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json','cache-control':'no-store','x-aitc-vision':'local-parallel-fallback','x-aitc-fallback-reason':reason,'x-aitc-collection':collection.ok?'saved':'failed'}});\n}`;
hotfix=replaceOnce(hotfix,oldLocalResponse,newLocalResponse,'localResponse-persistence');
await writeFile(files.hotfix,hotfix);

let test=await readFile(files.test,'utf8');
test=replaceOnce(
  test,
  "const sw=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');\n",
  "const sw=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');\nconst server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');\n",
  'test-server-read'
);
test=replaceOnce(
  test,
  "assert.match(hotfix,/FALLBACK_DEADLINE_MS=8_500/);\n",
  "assert.match(hotfix,/FALLBACK_DEADLINE_MS=8_500/);\nassert.match(hotfix,/LOCAL_PERSIST_DEADLINE_MS=3_500/);\nassert.match(hotfix,/\\/api\\/cases\\/collect-local/);\nassert.match(hotfix,/x-aitc-collection/);\nassert.match(server,/app\\.post\\('\u002Fapi\u002Flocal-fusion'/);\nassert.match(server,/app\\.post\\('\u002Fapi\u002Fcases\u002Fcollect-local',aiRateLimit/);\nassert.match(server,/source:'local-fallback'/);\n",
  'test-persistence-assertions'
);
test=test.replace(
  "console.log('ANALYSIS HOTFIX SMOKE PASS: vision uses one bounded fast transient retry, hard timeout stays single-pass, local CV runs in parallel, fallback is provenance-tagged/capped, and exact client benchmark telemetry is persisted.');",
  "console.log('ANALYSIS HOTFIX SMOKE PASS: local CV fallback is bounded, academically fused, provenance-tagged/capped, and durably persisted before the UI reports data collection success.');"
);
await writeFile(files.test,test);

console.log('FALLBACK PERSISTENCE HOTFIX APPLIED');
