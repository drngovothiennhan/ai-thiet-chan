(()=>{
'use strict';

const POLICY={
  uiName:'Trợ lý tham vấn',
  engine:'local-grounded',
  externalReasoning:'optional',
  localFallbackForChat:true,
  primaryReasoning:'local-grounded',
  auxiliaryReasoning:'optional-gemini',
  cameraOffBeforeAnalysis:true
};
window.AITCConsultationPolicy=Object.freeze({...POLICY});

const FALLBACK_MARKER='Đã Tham Vấn kho tri thức trong chế độ dự phòng không dùng Gemini.';
const chatCard=document.querySelector('.chat-card');

function replaceVisibleName(root=chatCard){
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    const current=String(node.nodeValue||'');
    const next=current.replace(/Gemini/gi,'Trợ lý tham vấn');
    if(next!==current)node.nodeValue=next;
  }
}

function scrubFallbackMarker(value){
  if(typeof value==='string')return value.replaceAll(FALLBACK_MARKER,'').replace(/\s{2,}/g,' ').trim();
  if(Array.isArray(value))return value.map(scrubFallbackMarker);
  if(value&&typeof value==='object'){
    const out={};
    for(const [key,item] of Object.entries(value))out[key]=scrubFallbackMarker(item);
    return out;
  }
  return value;
}

function hardStopCamera(){
  const video=document.getElementById('video');
  const stream=video?.srcObject;
  try{stream?.getTracks?.().forEach(track=>{try{track.stop();}catch{}});}catch{}
  if(video){
    try{video.pause();}catch{}
    try{video.srcObject=null;}catch{}
    try{video.removeAttribute('src');video.load?.();}catch{}
  }
}

function installCameraShutdown(){
  const analyze=document.getElementById('analyzeBtn');
  const close=document.getElementById('closeCameraBtn');
  const panel=document.getElementById('cameraPanel');
  if(analyze){
    analyze.addEventListener('click',()=>{
      if(panel&&!panel.hidden)try{close?.click();}catch{}
      hardStopCamera();
      queueMicrotask(hardStopCamera);
    },true);
  }
  if(panel){
    new MutationObserver(()=>{if(panel.hidden)hardStopCamera();}).observe(panel,{attributes:true,attributeFilter:['hidden']});
  }
  window.addEventListener('pagehide',hardStopCamera);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)hardStopCamera();});
}

function installConsultationGroundedPolicy(){
  const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');
  const priorFetch=(input,init)=>requestClient.fetchAfter('consultation-lock',input,init);
  const __aitcGroundedFetch=async(input,init={})=>{
    const url=typeof input==='string'?input:input?.url||'';
    const method=String(init?.method||'GET').toUpperCase();
    if(url.includes('/api/chat')&&method==='POST'&&typeof init?.body==='string'){
      try{
        const body=JSON.parse(init.body);
        body.assessment=scrubFallbackMarker(body.assessment);
        body.analysis=scrubFallbackMarker(body.analysis);
        body.consultationEngine='local-grounded';
        body.externalReasoning='optional';
        body.useAuxiliary=body.useAuxiliary===true;
        return priorFetch(input,{...init,body:JSON.stringify(body)});
      }catch{}
    }
    if(url.includes('/api/report')&&method==='POST'&&typeof init?.body==='string'){
      try{
        const body=JSON.parse(init.body);
        body.useAuxiliary=body.useAuxiliary===true;
        return priorFetch(input,{...init,body:JSON.stringify(body)});
      }catch{}
    }
    return priorFetch(input,init);
  };
  requestClient.register('consultation-lock',__aitcGroundedFetch,1100);
}

replaceVisibleName();
if(chatCard){
  new MutationObserver(()=>replaceVisibleName()).observe(chatCard,{subtree:true,childList:true,characterData:true});
}
installCameraShutdown();
installConsultationGroundedPolicy();
})();
