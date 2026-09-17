(()=>{
  'use strict';

  const VERSION='request-integrity-v1';
  const SUPABASE_URL='https://gzmpnsrwqjpsbklyflqr.supabase.co';
  const SUPABASE_KEY='sb_publishable_Y4hMhXROZ-aVgWoaQ5fFKQ_ZAcXuIzG';
  const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');
  const priorFetch=(input,init)=>requestClient.fetchAfter('request-integrity',input,init);
  const state={active:0,total:0,failed:0,lastRequest:null,sealed:false};
  const recentFaults=new Map();
  const MAX_FAULTS_PER_MINUTE=8;
  let faultWindowStarted=Date.now();
  let faultCount=0;

  function requestId(){
    try{return crypto.randomUUID();}catch{return `aitc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;}
  }
  function requestMeta(input,init={}){
    try{
      const raw=input instanceof Request?input.url:String(input||'');
      const url=new URL(raw,location.href);
      const method=String(init?.method||(input instanceof Request?input.method:'GET')||'GET').toUpperCase();
      return {url,method,sameOrigin:url.origin===location.origin,api:url.origin===location.origin&&url.pathname.startsWith('/api/'),path:url.pathname};
    }catch{return {url:null,method:'GET',sameOrigin:false,api:false,path:''};}
  }
  function withRequestHeader(input,init,id){
    const meta=requestMeta(input,init);
    if(!meta.api)return {input,init};
    const baseHeaders=init?.headers||(input instanceof Request?input.headers:undefined);
    const headers=new Headers(baseHeaders||{});
    if(!headers.has('x-aitc-request-id'))headers.set('x-aitc-request-id',id);
    if(input instanceof Request)return {input:new Request(input,{...init,headers}),init:undefined};
    return {input,init:{...init,headers}};
  }
  function faultBucket(value){
    let candidate='Error';
    if(value&&typeof value==='object')candidate=value.name||value.constructor?.name||'Error';
    const name=String(candidate).replace(/[^A-Za-z0-9_.-]/g,'').slice(0,40)||'Error';
    return name;
  }
  function sourceBucket(filename){
    try{
      if(!filename)return 'unknown';
      const url=new URL(String(filename),location.href);
      if(url.origin===location.origin)return 'app';
      if(/cdn\.jsdelivr\.net$/i.test(url.hostname))return 'cdn';
      return 'external';
    }catch{return 'unknown';}
  }
  function canRecordFault(fingerprint){
    const now=Date.now();
    if(now-faultWindowStarted>=60_000){faultWindowStarted=now;faultCount=0;}
    if(faultCount>=MAX_FAULTS_PER_MINUTE)return false;
    const previous=recentFaults.get(fingerprint)||0;
    if(now-previous<60_000)return false;
    recentFaults.set(fingerprint,now);faultCount+=1;
    if(recentFaults.size>40){for(const [key,at] of recentFaults)if(now-at>120_000)recentFaults.delete(key);}
    return true;
  }
  function coarseDeviceClass(){
    const profile=window.AITCHardwareProfile?.profile;
    return String(profile?.tier||'unknown').slice(0,40);
  }
  async function recordFault(kind,error,source='app'){
    const reason=`${kind}:${faultBucket(error)}:${source}`.slice(0,80);
    if(!canRecordFault(reason))return;
    try{
      await priorFetch(`${SUPABASE_URL}/rest/v1/rpc/ai_thiet_chan_benchmark_record_v1`,{
        method:'POST',
        headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'authorization':`Bearer ${SUPABASE_KEY}`},
        body:JSON.stringify({p_event:{event:'client_error',fallback:false,fallbackReason:reason,inferenceSource:'client-runtime',success:false,deviceClass:coarseDeviceClass(),hardwareTier:window.AITCHardwareProfile?.profile?.tier||'unknown'}}),
        keepalive:true
      });
    }catch{}
  }

  const guardedFetch=async(input,init={})=>{
    const id=requestId(),meta=requestMeta(input,init),prepared=withRequestHeader(input,init,id),started=performance?.now?.()??Date.now();
    state.active+=1;state.total+=1;state.lastRequest={id,path:meta.path,method:meta.method,state:'pending',startedAt:Date.now()};
    try{
      window.dispatchEvent(new CustomEvent('aitc:request-start',{detail:{id,path:meta.path,method:meta.method,api:meta.api}}));
      const response=await priorFetch(prepared.input,prepared.init);
      state.lastRequest={id,path:meta.path,method:meta.method,state:'complete',status:response.status,elapsedMs:Math.round((performance?.now?.()??Date.now())-started)};
      window.dispatchEvent(new CustomEvent('aitc:request-end',{detail:{...state.lastRequest,api:meta.api}}));
      return response;
    }catch(err){
      state.failed+=1;state.lastRequest={id,path:meta.path,method:meta.method,state:'failed',elapsedMs:Math.round((performance?.now?.()??Date.now())-started)};
      window.dispatchEvent(new CustomEvent('aitc:request-end',{detail:{...state.lastRequest,api:meta.api}}));
      recordFault('request',err,meta.api?'api':'network');
      throw err;
    }finally{state.active=Math.max(0,state.active-1);}
  };

  window.addEventListener('error',event=>{recordFault('error',event?.error||{name:'WindowError'},sourceBucket(event?.filename));});
  window.addEventListener('unhandledrejection',event=>{recordFault('rejection',(event?.reason&&typeof event.reason==='object')?event.reason:{name:'UnhandledRejection'},'app');});

  requestClient.register('request-integrity',guardedFetch,1200);
  state.sealed=requestClient.seal();

  window.AITCRequestIntegrity=Object.freeze({
    version:VERSION,
    snapshot:()=>Object.freeze({...state,lastRequest:state.lastRequest?{...state.lastRequest}:null})
  });
})();
