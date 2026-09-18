(()=>{
  'use strict';
  if(window.AITCDeviceRuntime)return;

  const VERSION='device-runtime-v2';
  const SCHEMA='device-analysis-payload-v2';
  const WORKER_URL='/device-analysis-worker.js';
  const DEVICE_COMPUTE_PRIORITY=90;
  const GROUND_TRUTH=Object.freeze({
    source:'KNOWLEDGE-5DOC',
    designation:'owner-designated-ground-truth-v1',
    profileVersion:'owner-ground-truth-profile-v1',
    indexedImageOccurrences:1027,
    ownerDesignatedTrainingSamples:1027,
    globalVisualVectors:1027,
    diagnosticTongueSignatures:298,
    contextOrNegativeSamples:729,
    trainingVectorCoverage:1,
    diagnosticSignatureCoverage:Number((298/1027).toFixed(6))
  });
  let seq=0;
  let registered=false;
  let registrationAttempts=0;
  let idleTimer=null;
  let lastRun=null;
  let shadowWorker=null;
  let shadowBusy=false;
  let shadowSeq=0;
  let shadowTimer=null;
  let shadowContext=null;
  let lastShadow=null;

  function n(value){const x=Number(value);return Number.isFinite(x)&&x>0?x:null;}
  function connectionClass(){
    const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    if(!c)return 'unknown';
    if(c.saveData)return 'save-data';
    const t=String(c.effectiveType||'').toLowerCase();
    if(t==='slow-2g'||t==='2g')return 'slow';
    if(t==='3g')return 'moderate';
    if(t==='4g')return 'fast';
    return 'unknown';
  }
  function detect(){
    const cores=n(navigator.hardwareConcurrency);
    const memory=n(navigator.deviceMemory);
    const network=connectionClass();
    const webWorker=typeof Worker!=='undefined';
    const offscreenCanvas=typeof OffscreenCanvas!=='undefined';
    const createImageBitmap=typeof window.createImageBitmap==='function';
    const wasm=typeof WebAssembly!=='undefined';
    const webgpu=Boolean(navigator.gpu);
    const localVisionReady=webWorker&&offscreenCanvas&&createImageBitmap;
    let score=1;
    const reasons=[];
    if(cores!==null){if(cores<=4){score-=1;reasons.push('cores<=4');}else if(cores>=8){score+=1;reasons.push('cores>=8');}}
    if(memory!==null){if(memory<=4){score-=1;reasons.push('memory<=4gb');}else if(memory>=8){score+=1;reasons.push('memory>=8gb');}}
    if(network==='slow'||network==='save-data'){score-=1;reasons.push(network);}
    if(!localVisionReady){score-=3;reasons.push('local-worker-vision-unavailable');}
    const tier=score<=0?'constrained':score>=3?'high':'balanced';
    const workerCount=!localVisionReady?0:tier==='high'?Math.min(3,Math.max(1,cores||2)):tier==='balanced'?Math.min(2,Math.max(1,cores||2)):1;
    return Object.freeze({
      version:VERSION,tier,reasons:Object.freeze(reasons),logicalCores:cores,deviceMemoryGb:memory,network,
      capabilities:Object.freeze({webWorker,offscreenCanvas,createImageBitmap,wasm,webgpu,localVisionReady}),
      plan:Object.freeze({
        workerCount,parallelViews:workerCount>=2,
        activeBackend:localVisionReady?'worker-canvas-cpu':'server-fallback',
        availableAccelerator:webgpu?'webgpu':wasm?'wasm':'cpu',
        acceleratorUsed:false,
        fallback:'existing-server-pipeline'
      })
    });
  }

  const profile=detect();
  const workers=[];
  const pending=new Map();
  let cursor=0;

  function ensureHardwareProfile(){
    if(window.AITCHardwareProfile||document.querySelector('script[data-aitc-hardware-profile]'))return;
    const script=document.createElement('script');
    script.src='/hardware-profile.js';
    script.async=true;
    script.dataset.aitcHardwareProfile='1';
    document.head.appendChild(script);
  }
  function publishLastRun(run){
    lastRun=Object.freeze({...run,version:VERSION,schemaVersion:SCHEMA,recordedAt:Date.now()});
    window.__aitcLastDeviceCompute=lastRun;
    window.dispatchEvent(new CustomEvent('aitc:device-analysis',{detail:lastRun}));
    return lastRun;
  }
  function clearIdleTimer(){if(idleTimer){clearTimeout(idleTimer);idleTimer=null;}}
  function terminateWorkers(){
    clearIdleTimer();
    while(workers.length){try{workers.pop()?.terminate?.();}catch{}}
    if(shadowTimer){clearTimeout(shadowTimer);shadowTimer=null;}
    if(shadowWorker){try{shadowWorker.terminate();}catch{}shadowWorker=null;}
    shadowBusy=false;shadowContext=null;
    cursor=0;
  }
  function armIdleCleanup(){
    clearIdleTimer();
    if(pending.size||!workers.length)return;
    const idleMs=profile.tier==='constrained'?30_000:profile.tier==='balanced'?45_000:60_000;
    idleTimer=setTimeout(()=>{if(!pending.size)terminateWorkers();},idleMs);
  }
  function makeWorker(index){
    try{
      const worker=new Worker(WORKER_URL,{type:'module',name:`aitc-device-${index+1}`});
      worker.onmessage=event=>{
        const {id,ok,result,error}=event.data||{};
        const task=pending.get(id);if(!task)return;
        pending.delete(id);clearTimeout(task.timer);
        ok?task.resolve(result):task.reject(new Error(error||'DEVICE_WORKER_FAILED'));
        armIdleCleanup();
      };
      worker.onerror=()=>{};
      return worker;
    }catch{return null;}
  }
  function ensureWorkers(){
    clearIdleTimer();
    if(workers.length||profile.plan.workerCount<1)return workers;
    for(let i=0;i<profile.plan.workerCount;i++){const w=makeWorker(i);if(w)workers.push(w);}
    return workers;
  }
  function publishShadow(detail){
    lastShadow=Object.freeze({...detail,recordedAt:Date.now()});
    window.__aitcLastVisionShadow=lastShadow;
    window.dispatchEvent(new CustomEvent('aitc:vision-shadow',{detail:lastShadow}));
    return lastShadow;
  }
  function ensureShadowWorker(){
    if(shadowWorker||!profile.capabilities.webWorker)return shadowWorker;
    try{
      shadowWorker=new Worker('/local-vision/shadow-worker.js',{type:'module',name:'aitc-shadow-vision'});
      shadowWorker.onmessage=event=>{
        const data=event.data||{};
        if(!shadowContext||data.id!==shadowContext.id)return;
        if(shadowTimer){clearTimeout(shadowTimer);shadowTimer=null;}
        const context=shadowContext;shadowContext=null;shadowBusy=false;
        if(data.ok&&data.result){
          const coverage=Number(data.result.coverage),baseline=Number(context.baselineCoverage);
          const topCandidate=String(data.result?.topFeatures?.topCandidates?.color?.labelCandidate||'');
          const baselineColor=String(context.baselineTop?.tongue||'');
          publishShadow({
            ...data.result,
            workerVersion:String(data.workerVersion||''),
            mode:context.mode,
            tier:profile.tier,
            baselineCoverage:Number.isFinite(baseline)?baseline:null,
            coverageDelta:Number.isFinite(coverage)&&Number.isFinite(baseline)?Number((coverage-baseline).toFixed(6)):null,
            baselineTopColor:baselineColor||null,
            topColorAgreement:baselineColor&&topCandidate?baselineColor===topCandidate:null,
            baselineBottomFeatures:Boolean(context.baselineBottom),
            pipelineImpact:'none-fire-and-forget-after-response',
            authority:false
          });
        }else{
          publishShadow({status:'error',error:String(data.error||'SHADOW_MODEL_FAILED'),mode:context.mode,tier:profile.tier,pipelineImpact:'none-fire-and-forget-after-response'});
        }
      };
      shadowWorker.onerror=()=>{};
      return shadowWorker;
    }catch{return null;}
  }
  function queueShadowViews(topDataUrl,bottomDataUrl,{mode='normal',baselineCoverage=null,baselineTop=null,baselineBottom=null}={}){
    if(typeof topDataUrl!=='string'||topDataUrl.length<100)return false;
    if(shadowBusy){
      publishShadow({status:'skipped-busy',mode,tier:profile.tier,pipelineImpact:'none-fire-and-forget-after-response'});
      return false;
    }
    const worker=ensureShadowWorker();
    if(!worker)return false;
    const id=`s${Date.now().toString(36)}-${++shadowSeq}`;
    shadowBusy=true;shadowContext={id,mode,baselineCoverage,baselineTop,baselineBottom};
    shadowTimer=setTimeout(()=>{
      if(!shadowContext||shadowContext.id!==id)return;
      try{shadowWorker?.terminate?.();}catch{}
      shadowWorker=null;shadowBusy=false;shadowContext=null;shadowTimer=null;
      publishShadow({status:'timeout',mode,tier:profile.tier,pipelineImpact:'none-fire-and-forget-after-response'});
    },5000);
    worker.postMessage({id,topDataUrl,bottomDataUrl:typeof bottomDataUrl==='string'?bottomDataUrl:'',role:'dual'});
    return true;
  }
  function runWorker(dataUrl,role,timeoutMs=12_000){
    const pool=ensureWorkers();
    if(!pool.length)return Promise.reject(new Error('DEVICE_WORKER_UNAVAILABLE'));
    const worker=pool[cursor++%pool.length];
    const id=`d${Date.now().toString(36)}-${++seq}`;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(new Error('DEVICE_WORKER_TIMEOUT'));armIdleCleanup();},timeoutMs);
      pending.set(id,{resolve,reject,timer});
      worker.postMessage({id,dataUrl,role,tier:profile.tier});
    });
  }
  async function analyzeViews(body){
    const top=typeof body?.topImage==='string'?body.topImage:typeof body?.image==='string'?body.image:'';
    const bottom=body?.mode==='general'&&typeof body?.bottomImage==='string'?body.bottomImage:'';
    if(!top)throw new Error('DEVICE_TOP_IMAGE_REQUIRED');
    let topResult=null,bottomResult=null;
    if(bottom&&profile.plan.parallelViews){
      [topResult,bottomResult]=await Promise.all([runWorker(top,'top'),runWorker(bottom,'bottom')]);
    }else{
      topResult=await runWorker(top,'top');
      if(bottom)bottomResult=await runWorker(bottom,'bottom');
    }
    return {
      schemaVersion:SCHEMA,runtimeVersion:VERSION,
      profile:{tier:profile.tier,logicalCores:profile.logicalCores,deviceMemoryGb:profile.deviceMemoryGb,network:profile.network,capabilities:profile.capabilities,plan:profile.plan},
      groundTruth:GROUND_TRUTH,top:topResult,bottom:bottomResult
    };
  }
  function isAnalyze(url,method){
    try{const u=new URL(url,location.href);return method==='POST'&&u.origin===location.origin&&u.pathname==='/api/analyze';}
    catch{return false;}
  }
  async function deviceLayer(input,init){
    const client=window.AITCRequestClient;
    const request=input instanceof Request?input:new Request(input,init);
    const method=String(request.method||'GET').toUpperCase();
    if(!isAnalyze(request.url,method))return client.fetchAfter('device-compute',input,init);
    let body=null;
    try{body=await request.clone().json();}catch{return client.fetchAfter('device-compute',input,init);}
    const started=performance.now();
    let deviceAnalysis=null;
    try{
      deviceAnalysis=await analyzeViews(body);
      const elapsedMs=Math.round(performance.now()-started);
      publishLastRun({
        status:'complete',mode:body?.mode==='general'?'general':'normal',elapsedMs,
        topElapsedMs:Number(deviceAnalysis?.top?.elapsedMs)||null,
        bottomElapsedMs:Number(deviceAnalysis?.bottom?.elapsedMs)||null,
        tier:profile.tier,activeBackend:profile.plan.activeBackend,workerCount:profile.plan.workerCount,
        parallelViews:Boolean(profile.plan.parallelViews),topSignature:Boolean(deviceAnalysis?.top?.signature),
        bottomFeatures:Boolean(deviceAnalysis?.bottom?.bottomFeatures)
      });
      body.deviceAnalysis=deviceAnalysis;
      if(deviceAnalysis?.top?.signature){
        body.academicSignature=deviceAnalysis.top.signature;
        body.academicSource={
          ...GROUND_TRUTH,
          execution:'device-worker',runtimeVersion:VERSION,schemaVersion:SCHEMA,
          workerVersion:deviceAnalysis.top.workerVersion||'',
          topImageDigest:deviceAnalysis.top.imageDigest||'',
          bottomImageDigest:deviceAnalysis.bottom?.imageDigest||''
        };
      }
      body.deviceRuntime={version:VERSION,schemaVersion:SCHEMA,status:'complete',elapsedMs,profile:{tier:profile.tier,plan:profile.plan}};
    }catch(error){
      const elapsedMs=Math.round(performance.now()-started);
      const reason=String(error?.message||error);
      publishLastRun({status:'fallback',mode:body?.mode==='general'?'general':'normal',elapsedMs,reason,tier:profile.tier,activeBackend:profile.plan.activeBackend,workerCount:profile.plan.workerCount,parallelViews:Boolean(profile.plan.parallelViews)});
      body.deviceRuntime={version:VERSION,schemaVersion:SCHEMA,status:'fallback',reason,elapsedMs,profile:{tier:profile.tier,plan:profile.plan},groundTruth:GROUND_TRUTH};
    }
    const headers=new Headers(request.headers);headers.set('content-type','application/json');headers.delete('content-length');
    const rewritten=new Request(request,{headers,body:JSON.stringify(body)});
    const response=await client.fetchAfter('device-compute',rewritten);
    queueShadowViews(top,bottom,{mode:body?.mode==='general'?'general':'normal',baselineCoverage:Number(deviceAnalysis?.top?.signature?.coverage),baselineTop:deviceAnalysis?.top?.coarseVisual||null,baselineBottom:deviceAnalysis?.bottom?.bottomFeatures||null});
    return response;
  }
  function tryRegister(){
    if(registered)return true;
    const client=window.AITCRequestClient;
    if(!client){if(registrationAttempts++<200)setTimeout(tryRegister,10);return false;}
    try{
      if(client.snapshot?.().sealed)return false;
      client.register('device-compute',deviceLayer,DEVICE_COMPUTE_PRIORITY);
      registered=true;
      return true;
    }catch(error){
      if(String(error?.message||error).includes('DUPLICATE')){registered=true;return true;}
      if(registrationAttempts++<200)setTimeout(tryRegister,10);
      return false;
    }
  }
  function snapshot(){return Object.freeze({version:VERSION,schemaVersion:SCHEMA,registered,profile,workers:workers.length,pending:pending.size,lastRun,lastShadow,shadowBusy,groundTruth:GROUND_TRUTH,priority:DEVICE_COMPUTE_PRIORITY});}

  ensureHardwareProfile();
  tryRegister();
  window.AITCDeviceRuntime=Object.freeze({version:VERSION,schemaVersion:SCHEMA,profile,groundTruth:GROUND_TRUTH,analyzeViews,snapshot,terminateWorkers});
  window.dispatchEvent(new CustomEvent('aitc:device-runtime',{detail:snapshot()}));
})();
