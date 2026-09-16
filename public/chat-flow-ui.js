(()=>{
  'use strict';
  if(window.AITCChatFlow?.version)return;

  const VERSION='chat-flow-ui-v1';
  const nativeFetch=window.fetch.bind(window);
  const state={caseSerial:0,initialPublished:false,lastAssessment:null};
  const INTERNAL_PREFIX=/^\[(?:THAP_VAN_CONTEXT|SKIP_THAP_VAN|DETAIL_WITHOUT_THAP_VAN|NO_THAP_VAN_CONTEXT|FOLLOW_UP_QUESTION)\]/;

  function isSameOriginApi(input,path){
    try{
      const raw=typeof input==='string'?input:input?.url||'';
      const url=new URL(raw,location.href);
      return url.origin===location.origin&&url.pathname===path;
    }catch{return false;}
  }
  function appendBot(text){
    const log=document.getElementById('chatLog');if(!log||!text)return;
    const oldGreeting=[...log.querySelectorAll('.bubble.bot')].find(node=>/Bạn có thể hỏi (?:Gemini|Trợ lý tham vấn) trực tiếp/i.test(node.textContent||''));
    if(oldGreeting&&log.querySelectorAll('.bubble').length<=2)oldGreeting.remove();
    const div=document.createElement('div');div.className='bubble bot';div.dataset.aitcInitialResult='1';div.textContent=text;log.appendChild(div);log.scrollTop=log.scrollHeight;
  }
  function clean(value){return String(value??'').trim();}
  function pct(value){const n=Number(value);return Number.isFinite(n)?`${Math.round(Math.max(0,Math.min(1,n))*100)}%`:'';}
  function compactParts(parts){return parts.map(clean).filter(Boolean).join(' · ');}
  function initialSummary(assessment){
    if(!assessment||typeof assessment!=='object')return '';
    const top=assessment.top||{},bottom=assessment.bottom||{},combined=assessment.combined||{};
    const rows=[];
    const topLine=compactParts([
      top.tongueColor&&`chất lưỡi ${top.tongueColor}`,
      top.shape&&`hình thể ${top.shape}`,
      top.coatingColor&&`rêu ${top.coatingColor}${top.coatingThickness?` ${top.coatingThickness}`:''}`,
      top.moisture&&`độ ẩm ${top.moisture}`
    ]);
    if(topLine)rows.push(`Mặt trên: ${topLine}.`);
    if(assessment.mode==='general'&&bottom&&typeof bottom==='object'){
      const vessels=bottom.vessels||{};
      const bottomLine=compactParts([
        bottom.undersideColor&&`màu mặt dưới ${bottom.undersideColor}`,
        vessels.color&&`mạch ${vessels.color}`,
        vessels.prominence&&`mức nổi ${vessels.prominence}`,
        vessels.dilation&&`giãn ${vessels.dilation}`,
        vessels.tortuosity&&`uốn lượn ${vessels.tortuosity}`
      ]);
      if(bottomLine)rows.push(`Mặt dưới: ${bottomLine}.`);
    }
    const summary=clean(combined.summary||top.summary);
    if(summary)rows.push(`Tổng hợp: ${summary}`);
    const confidence=pct(combined.confidence);
    if(confidence)rows.push(`Độ tin cậy nội bộ sau QC: ${confidence}.`);
    if(!rows.length)return '';
    return `Kết quả tổng quát ban đầu của ca hiện tại:\n${rows.map(x=>`• ${x}`).join('\n')}\n\nTừ câu hỏi tiếp theo, Trợ lý tham vấn sẽ xử lý đúng câu hỏi mới và không lặp lại toàn bộ kết quả trên, trừ khi bạn yêu cầu.`;
  }
  function publishInitial(assessment,serial){
    if(serial!==state.caseSerial||state.initialPublished)return;
    const text=initialSummary(assessment);if(!text)return;
    state.initialPublished=true;state.lastAssessment=assessment;appendBot(text);
    window.dispatchEvent(new CustomEvent('aitc:initial-chat-result',{detail:{version:VERSION,serial}}));
  }
  function followUpMessage(message){
    const raw=clean(message);if(!raw||INTERNAL_PREFIX.test(raw))return raw;
    return `[FOLLOW_UP_QUESTION]\nĐây là câu hỏi tiếp theo sau khi kết quả tổng quát của ca hiện tại đã được công bố. Hãy gọi tầng tham vấn Gemini và chỉ trả lời đúng câu hỏi mới của người dùng. Không lặp lại toàn bộ kết quả thiệt chẩn, không tự mở đầu bằng bản tóm tắt ca và không lặp lại một câu trả lời mẫu; chỉ nhắc lại dữ kiện cũ khi thực sự cần để trả lời câu hỏi này. Giữ nguyên các giới hạn an toàn, không tự thêm triệu chứng, không kê đơn và không biến dấu hiệu thiệt tượng thành chẩn đoán xác định.\n\nCâu hỏi hiện tại: ${raw}`;
  }

  window.fetch=async(input,init={})=>{
    const method=String(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
    if(method==='POST'&&isSameOriginApi(input,'/api/analyze')){
      const serial=++state.caseSerial;state.initialPublished=false;state.lastAssessment=null;
      const response=await nativeFetch(input,init);
      if(response.ok){
        response.clone().json().then(data=>{
          const assessment=data?.assessment||data?.analysis;
          if(assessment)setTimeout(()=>publishInitial(assessment,serial),0);
        }).catch(()=>{});
      }
      return response;
    }
    if(method==='POST'&&isSameOriginApi(input,'/api/chat')&&typeof init?.body==='string'){
      try{
        const body=JSON.parse(init.body);
        if(typeof body.message==='string'&&!INTERNAL_PREFIX.test(body.message.trim())){
          body.message=followUpMessage(body.message);
          body.chatPhase='gemini-followup';
          body.initialResultAlreadyPublished=state.initialPublished;
          return nativeFetch(input,{...init,body:JSON.stringify(body)});
        }
      }catch{}
    }
    return nativeFetch(input,init);
  };

  function managementPanel(){return document.querySelector('#settingsDialog .settings-panel');}
  function organizeManagement(){
    const panel=managementPanel(),history=document.querySelector('.history-card');if(!panel||!history)return;
    let hub=document.getElementById('settingsManagementHub');
    if(!hub){
      hub=document.createElement('div');hub.id='settingsManagementHub';hub.className='settings-group settings-management-hub';
      hub.innerHTML='<strong>Quản lý</strong><p class="settings-note">Lịch sử ca và Admin Center được gom tại đây để màn hình chính gọn hơn.</p>';
      panel.appendChild(hub);
    }
    if(history.parentElement!==hub){history.classList.add('settings-management-history');hub.appendChild(history);}
    const adminEntry=document.querySelector('.admin-center-entry');
    if(adminEntry&&adminEntry.parentElement!==hub)hub.appendChild(adminEntry);
  }
  const managementObserver=new MutationObserver(()=>organizeManagement());
  if(document.body)managementObserver.observe(document.body,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',organizeManagement,{once:true});else organizeManagement();

  document.addEventListener('click',event=>{
    const casesButton=event.target.closest?.('#aitcBottomNav [data-nav="cases"]');
    if(!casesButton)return;
    event.preventDefault();event.stopImmediatePropagation();organizeManagement();
    document.getElementById('settingsBtn')?.click();
    setTimeout(()=>{
      const panel=document.getElementById('historyPanel'),toggle=document.getElementById('toggleHistoryBtn');
      if(panel?.hidden&&toggle)toggle.click();
      document.querySelector('.history-card')?.scrollIntoView({behavior:'smooth',block:'nearest'});
    },0);
  },true);

  window.addEventListener('aitc:clear-session',()=>{state.caseSerial+=1;state.initialPublished=false;state.lastAssessment=null;});
  window.AITCChatFlow={version:VERSION,state,initialSummary,organizeManagement};
})();
