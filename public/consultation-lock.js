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

const OLD_FALLBACK_MARKER='Đã Tham Vấn kho tri thức trong chế độ dự phòng không dùng Gemini.';
const NEW_FALLBACK_MARKER='Đã đối chiếu kho dữ liệu máy học.';
const chatCard=document.querySelector('.chat-card');

function replaceVisibleName(root=chatCard){
  if(!root)return;
  const title=root.querySelector('h2');if(title)title.textContent='Trợ lý tham vấn';
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    if(node.parentElement?.closest('.bubble.user'))continue;
    const current=String(node.nodeValue||'');
    const next=current
      .replace(/Chatbot\s+Gemini/gi,'Trợ lý tham vấn')
      .replace(/Chatbot/gi,'Trợ lý tham vấn')
      .replace(/Gemini/gi,'Trợ lý tham vấn')
      .replace(/Tham Vấn\s*·\s*Trợ lý tham vấn/gi,'Trợ lý tham vấn')
      .replace(/Trợ lý tham vấn\s+Trợ lý tham vấn/gi,'Trợ lý tham vấn');
    if(next!==current)node.nodeValue=next;
  }
}

function scrubFallbackMarker(value){
  if(typeof value==='string')return value.replaceAll(OLD_FALLBACK_MARKER,'').replaceAll(NEW_FALLBACK_MARKER,'').replace(/\s{2,}/g,' ').trim();
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

function isWorkflowControl(message){return /^\[(?:THAP_VAN_CONTEXT|SKIP_THAP_VAN|DETAIL_WITHOUT_THAP_VAN|NO_THAP_VAN_CONTEXT)\]/.test(String(message||'').trim());}
function fallbackFollowUpPrompt(message){
  const raw=String(message||'').trim();
  const context=[...document.querySelectorAll('#chatLog .bubble')]
    .filter(node=>node.dataset.aitcLoading!=='1'&&node.dataset.choiceBubble!=='1')
    .slice(-8)
    .map(node=>`${node.classList.contains('user')?'Người dùng':'Trợ lý'}: ${String(node.textContent||'').trim()}`)
    .join('\n')
    .slice(-6000);
  return `[FOLLOW_UP_QUESTION]\nĐây là câu hỏi tiếp theo sau kết quả tổng quát. BẮT BUỘC dùng Gemini để tra cứu và đối chiếu theo kết quả ca hiện tại, kho tri thức được máy chủ truy hồi và hội thoại gần nhất. Trả lời cụ thể đúng câu hỏi, nêu bằng chứng liên quan và phần còn thiếu nếu có; không lặp lại toàn bộ kết quả, không dùng câu trả lời mẫu, không tự thêm triệu chứng, không kê đơn và không biến dấu hiệu thiệt tượng thành chẩn đoán xác định.\n\nNGỮ CẢNH GẦN NHẤT:\n${context||'Chưa có hội thoại bổ sung.'}\n\nCÂU HỎI HIỆN TẠI:\n${raw}`;
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
        const message=String(body.message||'').trim();
        const alreadyFollowUp=message.includes('[FOLLOW_UP_QUESTION]')||body.chatPhase==='gemini-followup';
        const shouldFollowUp=Boolean(window.AITCChatFlow?.state?.initialPublished)&&!isWorkflowControl(message);
        if(message&&shouldFollowUp&&!alreadyFollowUp){
          body.message=window.AITCChatFlow?.followUpMessage?.(message)||fallbackFollowUpPrompt(message);
          body.chatPhase='gemini-followup';
          body.initialResultAlreadyPublished=true;
          body.requireConcreteAnswer=true;
        }
        if(typeof body.message==='string'&&body.message.trim()){
          body.message=`[TRO_LY_THAM_VAN_EXTERNAL]\nTrong Trợ lý tham vấn, bắt buộc dùng năng lực suy luận của Gemini cho câu hỏi tham vấn. Khi là câu hỏi tiếp theo sau kết quả tổng quát, phải tra cứu và đối chiếu theo ngữ cảnh ca hiện tại cùng kho tri thức được máy chủ truy hồi, rồi trả ra nội dung cụ thể phù hợp với câu hỏi; không thay bằng heuristic/máy học cục bộ, không dùng câu trả lời mẫu và không lặp thông báo chế độ dự phòng. Nếu nội dung cần kiến thức ngoài kho đã nạp, được phép dùng kiến thức chung của Gemini và tuân thủ cơ chế đánh dấu [A.I] của máy chủ.\n\n${body.message}`;
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
