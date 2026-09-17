(()=>{
'use strict';
const SUPABASE_URL='https://gzmpnsrwqjpsbklyflqr.supabase.co';
const SUPABASE_KEY='sb_publishable_Y4hMhXROZ-aVgWoaQ5fFKQ_ZAcXuIzG';
const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');
const priorFetch=(input,init)=>requestClient.fetchAfter('benchmark-telemetry',input,init);
const now=()=>performance?.now?.()??Date.now();
let clickStartedAt=null;
let lastRequest=null;

function deviceClass(){
  const ua=navigator.userAgent||'';
  if(/Android/i.test(ua))return'android';
  if(/iPhone|iPad|iPod/i.test(ua))return'ios';
  if(/Windows/i.test(ua))return'windows';
  if(/Macintosh|Mac OS X/i.test(ua))return'macos';
  if(/Linux/i.test(ua))return'linux';
  return'other';
}
function modeFromBody(init){
  try{const b=JSON.parse(init?.body||'{}');return b.mode==='general'?'general':'normal';}catch{return'normal';}
}
function hardwareTelemetry(){
  const profile=window.AITCHardwareProfile?.profile||null;
  const meta=window.__aitcLastEnhancementMeta?.top||null;
  const hardware=meta?.hardware||null;
  return {
    hardwareTier:String(profile?.tier||hardware?.tier||'unknown'),
    hardwareCores:String(hardware?.cores||'unknown'),
    hardwareMemory:String(hardware?.memory||'unknown'),
    connectionClass:String(profile?.network||hardware?.network||'unknown'),
    enhancementProfile:String(meta?.profile||''),
    enhancementOutputPixels:Number(meta?.output?.pixels)||null,
    enhancementElapsedMs:Number(meta?.elapsedMs)||null
  };
}
async function captureAnalyze(response,startedAt,mode){
  let data={};try{data=await response.clone().json();}catch{}
  const timing=data?.timing||{};
  lastRequest={
    event:'analysis_render',
    requestToResultMs:Math.round(now()-startedAt),
    localVisionMs:Number(timing.localVisionMs)||null,
    fusionMs:Number(timing.fusionMs)||null,
    upstreamMs:Number(timing.upstreamMs)||Number(response.headers.get('x-ai-upstream-ms'))||null,
    fallback:Boolean(data?.fallback||data?.localVision),
    fallbackReason:String(data?.fallbackReason||''),
    inferenceSource:String(data?.inferenceSource||(data?.localVision?'local-open-source-vision-v1':'gemini-3.8-flash')),
    mode,
    success:Boolean(response.ok)
  };
}
const __aitcStage3bFetch=async(input,init={})=>{
  const url=typeof input==='string'?input:input?.url||'';
  if(!url.includes('/api/analyze'))return priorFetch(input,init);
  const startedAt=now(),mode=modeFromBody(init);
  try{
    const response=await priorFetch(input,init);
    await captureAnalyze(response,startedAt,mode);
    return response;
  }catch(err){
    lastRequest={event:'analysis_render',requestToResultMs:Math.round(now()-startedAt),fallback:false,fallbackReason:'request_error',inferenceSource:'none',mode,success:false};
    throw err;
  }
};
requestClient.register('benchmark-telemetry',__aitcStage3bFetch,1000);
async function persist(payload){
  try{
    await priorFetch(`${SUPABASE_URL}/rest/v1/rpc/ai_thiet_chan_benchmark_record_v1`,{
      method:'POST',
      headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'authorization':`Bearer ${SUPABASE_KEY}`},
      body:JSON.stringify({p_event:payload}),
      keepalive:true
    });
  }catch{}
}
function install(){
  const button=document.getElementById('analyzeBtn'),card=document.getElementById('resultCard');
  if(button)button.addEventListener('click',()=>{clickStartedAt=now();lastRequest=null;},{capture:true});
  if(card)new MutationObserver(()=>{
    if(card.hidden||clickStartedAt===null)return;
    const payload={...(lastRequest||{}),...hardwareTelemetry(),event:'analysis_render',clickToResultMs:Math.round(now()-clickStartedAt),deviceClass:deviceClass(),success:lastRequest?.success!==false};
    clickStartedAt=null;
    persist(payload);
  }).observe(card,{attributes:true,attributeFilter:['hidden']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
