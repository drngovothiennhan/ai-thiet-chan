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
function deviceRuntimeState(){
  try{return window.AITCDeviceRuntime?.snapshot?.()||null;}catch{return null;}
}
function hardwareTelemetry(){
  const profile=window.AITCHardwareProfile?.profile||null;
  const runtime=deviceRuntimeState();
  const deviceProfile=runtime?.profile||null;
  const meta=window.__aitcLastEnhancementMeta?.top||null;
  const hardware=meta?.hardware||null;
  const cores=profile?.logicalCores??deviceProfile?.logicalCores??hardware?.cores??'unknown';
  const memory=profile?.deviceMemoryGb??deviceProfile?.deviceMemoryGb??hardware?.memory??'unknown';
  return {
    hardwareTier:String(deviceProfile?.tier||profile?.tier||hardware?.tier||'unknown'),
    hardwareCores:String(cores),
    hardwareMemory:String(memory),
    connectionClass:String(deviceProfile?.network||profile?.network||hardware?.network||'unknown'),
    enhancementProfile:String(meta?.profile||''),
    enhancementOutputPixels:Number(meta?.output?.pixels)||null,
    enhancementElapsedMs:Number(meta?.elapsedMs)||null
  };
}
function deviceComputeElapsedMs(){
  const run=deviceRuntimeState()?.lastRun||window.__aitcLastDeviceCompute||null;
  if(run?.status!=='complete')return null;
  const value=Number(run.elapsedMs);
  return Number.isFinite(value)&&value>0?Math.min(120000,Math.round(value)):null;
}
async function captureAnalyze(response,startedAt,mode){
  let data={};try{data=await response.clone().json();}catch{}
  const timing=data?.timing||{};
  const deviceMs=deviceComputeElapsedMs();
  lastRequest={
    event:'analysis_render',
    requestToResultMs:Math.round(now()-startedAt),
    localVisionMs:deviceMs||Number(timing.localVisionMs)||null,
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
    lastRequest={event:'analysis_render',requestToResultMs:Math.round(now()-startedAt),localVisionMs:deviceComputeElapsedMs(),fallback:false,fallbackReason:'request_error',inferenceSource:'none',mode,success:false};
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
async function persistShadow(payload){
  try{
    await priorFetch(`${SUPABASE_URL}/rest/v1/rpc/ai_thiet_chan_vision_shadow_record_v2`,{
      method:'POST',
      headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'authorization':`Bearer ${SUPABASE_KEY}`},
      body:JSON.stringify({p_event:payload}),
      keepalive:true
    });
  }catch{}
}
function install(){
  const button=document.getElementById('analyzeBtn'),card=document.getElementById('resultCard');
  window.addEventListener('aitc:vision-shadow',event=>{
    const shadow=event?.detail||{};
    persistShadow({
      event:'vision_shadow',
      eventSchema:'aitc-vision-shadow-v2',
      runtimeVersion:String(shadow.runtimeVersion||shadow.workerVersion||''),
      modelId:String(shadow.modelId||'aitc-tongue-roi-mlp-bootstrap-v1'),
      modelSha256:String(shadow.modelSha256||''),
      shadowStatus:String(shadow.status||'unknown'),
      latencyMs:Number(shadow.latencyMs)||null,
      shadowCoverage:Number.isFinite(Number(shadow.coverage))?Number(shadow.coverage):null,
      baselineCoverage:Number.isFinite(Number(shadow.baselineCoverage))?Number(shadow.baselineCoverage):null,
      coverageDelta:Number.isFinite(Number(shadow.coverageDelta))?Number(shadow.coverageDelta):null,
      shadowPresence:typeof shadow.presence==='boolean'?shadow.presence:null,
      shadowFeatureVersion:String(shadow.featureVersion||''),
      qcGlareRatio:Number.isFinite(Number(shadow?.topFeatures?.qc?.glareRatio))?Number(shadow.topFeatures.qc.glareRatio):null,
      qcFlashRiskScore:Number.isFinite(Number(shadow?.topFeatures?.qc?.flashRiskScore))?Number(shadow.topFeatures.qc.flashRiskScore):null,
      qcSharpnessProxy:Number.isFinite(Number(shadow?.topFeatures?.qc?.sharpnessProxy))?Number(shadow.topFeatures.qc.sharpnessProxy):null,
      baselineTopColor:String(shadow.baselineTopColor||''),
      topColorCandidate:String(shadow?.topFeatures?.topCandidates?.color?.labelCandidate||''),
      topColorCandidateScore:Number.isFinite(Number(shadow?.topFeatures?.topCandidates?.color?.score))?Number(shadow.topFeatures.topCandidates.color.score):null,
      topColorAgreement:typeof shadow.topColorAgreement==='boolean'?shadow.topColorAgreement:null,
      baselineTopFissure:typeof shadow.baselineTopFissure==='boolean'?shadow.baselineTopFissure:null,
      topMedianSulcusScore:Number.isFinite(Number(shadow?.topFeatures?.topCandidates?.medianSulcus?.score))?Number(shadow.topFeatures.topCandidates.medianSulcus.score):null,
      topFissureCandidateScore:Number.isFinite(Number(shadow?.topFeatures?.topCandidates?.fissure?.score))?Number(shadow.topFeatures.topCandidates.fissure.score):null,
      topMoistureProxyScore:Number.isFinite(Number(shadow?.topFeatures?.topCandidates?.moisture?.score))?Number(shadow.topFeatures.topCandidates.moisture.score):null,
      topMoistureReliability:Number.isFinite(Number(shadow?.topFeatures?.topCandidates?.moisture?.reliability))?Number(shadow.topFeatures.topCandidates.moisture.reliability):null,
      bottomFrameScore:Number.isFinite(Number(shadow?.bottomFeatures?.bottomCandidates?.undersideFrame?.score))?Number(shadow.bottomFeatures.bottomCandidates.undersideFrame.score):null,
      baselineBottomVesselCandidateRatio:Number.isFinite(Number(shadow.baselineBottomVesselCandidateRatio))?Number(shadow.baselineBottomVesselCandidateRatio):null,
      bottomVesselCandidateRatio:Number.isFinite(Number(shadow?.bottomFeatures?.bottomCandidates?.vesselVisibility?.candidateRatio))?Number(shadow.bottomFeatures.bottomCandidates.vesselVisibility.candidateRatio):null,
      bottomVesselVisibilityScore:Number.isFinite(Number(shadow?.bottomFeatures?.bottomCandidates?.vesselVisibility?.score))?Number(shadow.bottomFeatures.bottomCandidates.vesselVisibility.score):null,
      bottomVesselBalance:Number.isFinite(Number(shadow?.bottomFeatures?.bottomCandidates?.bilateralVessels?.balance))?Number(shadow.bottomFeatures.bottomCandidates.bilateralVessels.balance):null,
      baselineBottomDarkPurpleRatio:Number.isFinite(Number(shadow.baselineBottomDarkPurpleRatio))?Number(shadow.baselineBottomDarkPurpleRatio):null,
      bottomDarkPurpleRatio:Number.isFinite(Number(shadow?.bottomFeatures?.bottomCandidates?.darkPurple?.ratio))?Number(shadow.bottomFeatures.bottomCandidates.darkPurple.ratio):null,
      clinicalGold:false,
      productionEligible:false,
      pipelineImpact:String(shadow.pipelineImpact||'none'),
      deviceClass:deviceClass(),
      ...hardwareTelemetry()
    });
  });
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
