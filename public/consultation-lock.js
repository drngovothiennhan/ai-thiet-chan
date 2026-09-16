(()=>{
'use strict';

const POLICY={
  uiName:'Trợ lý tham vấn',
  engine:'gemini',
  externalReasoning:'required',
  localFallbackForChat:false,
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

function installConsultationGeminiLock(){
  const priorFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:input?.url||'';
    const method=String(init?.method||'GET').toUpperCase();
    if(url.includes('/api/chat')&&method==='POST'&&typeof init?.body==='string'){
      try{
        const body=JSON.parse(init.body);
        body.assessment=scrubFallbackMarker(body.assessment);
        body.analysis=scrubFallbackMarker(body.analysis);
        body.consultationEngine='gemini';
        body.externalReasoning='required';
        if(typeof body.message==='string'&&body.message.trim()){
          body.message=`[TRO_LY_THAM_VAN_EXTERNAL]\nTrong khung chatbot, bắt buộc dùng năng lực suy luận của Gemini để trả lời câu hỏi tham vấn. Nếu nội dung cần kiến thức ngoài kho tài liệu đã nạp, được phép dùng kiến thức chung của Gemini; không thay câu trả lời bằng heuristic/máy học cục bộ và không lặp lại thông báo chế độ dự phòng của bước phân tích ảnh. Khi dùng kiến thức ngoài kho, tuân thủ cơ chế đánh dấu [A.I] của máy chủ.\n\n${body.message}`;
        }
        return priorFetch(input,{...init,body:JSON.stringify(body)});
      }catch{}
    }
    return priorFetch(input,init);
  };
}

replaceVisibleName();
if(chatCard){
  new MutationObserver(()=>replaceVisibleName()).observe(chatCard,{subtree:true,childList:true,characterData:true});
}
installCameraShutdown();
installConsultationGeminiLock();
})();
