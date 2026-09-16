(()=>{
  'use strict';
  if(window.AITCChatFlow?.version)return;

  const VERSION='chat-flow-ui-v2-gemini-followup-admin';
  const nativeFetch=window.fetch.bind(window);
  const state={caseSerial:0,initialPublished:false,lastAssessment:null,openHistoryWhenAdmin:false};
  const WORKFLOW_CONTROL=/^\[(?:THAP_VAN_CONTEXT|SKIP_THAP_VAN|DETAIL_WITHOUT_THAP_VAN|NO_THAP_VAN_CONTEXT)\]/;
  const FOLLOW_UP_MARKER='[FOLLOW_UP_QUESTION]';
  const OLD_FALLBACK='Đã Tham Vấn kho tri thức trong chế độ dự phòng không dùng Gemini.';
  const NEW_FALLBACK='Đã đối chiếu kho dữ liệu máy học.';

  function isSameOriginApi(input,path){
    try{
      const raw=typeof input==='string'?input:input?.url||'';
      const url=new URL(raw,location.href);
      return url.origin===location.origin&&url.pathname===path;
    }catch{return false;}
  }
  function clean(value){return String(value??'').trim();}
  function pct(value){const n=Number(value);return Number.isFinite(n)?`${Math.round(Math.max(0,Math.min(1,n))*100)}%`:'';}
  function compactParts(parts){return parts.map(clean).filter(Boolean).join(' · ');}
  function replaceRequestedCopy(value){
    return String(value||'')
      .replaceAll(OLD_FALLBACK,NEW_FALLBACK)
      .replace(/\s*Từ câu hỏi tiếp theo,[^\n]*/gi,'')
      .replace(/Chatbot\s+Gemini/gi,'Trợ lý tham vấn')
      .replace(/Chatbot/gi,'Trợ lý tham vấn')
      .replace(/Gemini/gi,'Trợ lý tham vấn')
      .replace(/Tham Vấn\s*·\s*Trợ lý tham vấn/gi,'Trợ lý tham vấn')
      .replace(/Trợ lý tham vấn\s+Trợ lý tham vấn/gi,'Trợ lý tham vấn')
      .replace(/[ \t]{2,}/g,' ')
      .trim();
  }
  function normalizeVisibleCopy(root){
    if(!root)return;
    const title=root.matches?.('.chat-card')?root.querySelector('h2'):root.querySelector?.('.chat-card h2');
    if(title)title.textContent='Trợ lý tham vấn';
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      if(node.parentElement?.closest('.bubble.user'))continue;
      const next=replaceRequestedCopy(node.nodeValue);
      if(next!==node.nodeValue)node.nodeValue=next;
    }
  }
  function observeVisibleCopy(root){
    if(!root)return;
    normalizeVisibleCopy(root);
    let scheduled=false;
    new MutationObserver(()=>{
      if(scheduled)return;scheduled=true;
      queueMicrotask(()=>{scheduled=false;normalizeVisibleCopy(root);});
    }).observe(root,{subtree:true,childList:true,characterData:true});
  }
  function appendBot(text){
    const log=document.getElementById('chatLog');if(!log||!text)return;
    const oldGreeting=[...log.querySelectorAll('.bubble.bot')].find(node=>/Bạn có thể hỏi (?:Gemini|Trợ lý tham vấn) trực tiếp/i.test(node.textContent||''));
    if(oldGreeting&&log.querySelectorAll('.bubble').length<=2)oldGreeting.remove();
    const div=document.createElement('div');div.className='bubble bot';div.dataset.aitcInitialResult='1';div.textContent=replaceRequestedCopy(text);log.appendChild(div);log.scrollTop=log.scrollHeight;
  }
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
    const summary=replaceRequestedCopy(combined.summary||top.summary);
    if(summary)rows.push(`Tổng hợp: ${summary}`);
    const confidence=pct(combined.confidence);
    if(confidence)rows.push(`Độ tin cậy nội bộ sau QC: ${confidence}.`);
    if(!rows.length)return '';
    return `Kết quả tổng quát ban đầu của ca hiện tại:\n${rows.map(x=>`• ${x}`).join('\n')}`;
  }
  function publishInitial(assessment,serial){
    if(serial!==state.caseSerial||state.initialPublished)return;
    const text=initialSummary(assessment);if(!text)return;
    state.initialPublished=true;state.lastAssessment=assessment;appendBot(text);
    window.dispatchEvent(new CustomEvent('aitc:initial-chat-result',{detail:{version:VERSION,serial}}));
  }
  function recentConversationContext(){
    const log=document.getElementById('chatLog');if(!log)return '';
    const rows=[...log.querySelectorAll('.bubble')]
      .filter(node=>node.dataset.aitcLoading!=='1'&&node.dataset.choiceBubble!=='1')
      .slice(-8)
      .map(node=>`${node.classList.contains('user')?'Người dùng':'Trợ lý'}: ${clean(node.textContent)}`)
      .filter(Boolean);
    return rows.join('\n').slice(-6000);
  }
  function followUpMessage(message){
    const raw=clean(message);if(!raw)return raw;
    const context=recentConversationContext();
    return `${FOLLOW_UP_MARKER}\nĐây là câu hỏi tiếp theo sau khi kết quả tổng quát của ca hiện tại đã được công bố. BẮT BUỘC dùng tầng tham vấn Gemini cho câu hỏi này; không thay bằng câu trả lời cục bộ, heuristic hoặc nội dung mẫu. Hãy đối chiếu kết quả thiệt chẩn hiện tại, kho tri thức được máy chủ truy hồi và ngữ cảnh hội thoại gần nhất. Trả lời đúng câu hỏi mới bằng nội dung cụ thể trong phạm vi dữ kiện hiện có: nêu kết luận/giải thích trực tiếp, bằng chứng liên quan và phần còn thiếu nếu có. Không lặp lại toàn bộ kết quả thiệt chẩn, không dùng cùng một đoạn trả lời cho các câu hỏi khác nhau, không tự thêm triệu chứng, không kê đơn và không biến dấu hiệu thiệt tượng thành chẩn đoán xác định. Nếu thiếu dữ kiện, vẫn trả phần có thể kết luận trước rồi mới nêu rõ dữ kiện còn thiếu.\n\nNGỮ CẢNH HỘI THOẠI GẦN NHẤT:\n${context||'Chưa có hội thoại bổ sung.'}\n\nCÂU HỎI HIỆN TẠI:\n${raw}`;
  }
  function installLoadingStyle(){
    if(document.getElementById('aitcGeminiLoadingStyle'))return;
    const style=document.createElement('style');style.id='aitcGeminiLoadingStyle';
    style.textContent='@keyframes aitcGeminiPulse{0%,100%{opacity:.35}50%{opacity:1}}.aitc-gemini-loading{opacity:.82}.aitc-gemini-loading::after{content:" …";display:inline-block;animation:aitcGeminiPulse .85s ease-in-out infinite}.quality-card[data-aitc-admin-only="1"],.history-card[data-aitc-admin-only="1"]{display:none!important}body.aitc-admin-view .quality-card[data-aitc-admin-only="1"],body.aitc-admin-view .history-card[data-aitc-admin-only="1"]{display:block!important}';
    document.head.appendChild(style);
  }
  function addLoading(){
    const log=document.getElementById('chatLog');if(!log)return null;
    const div=document.createElement('div');div.className='bubble bot aitc-gemini-loading';div.dataset.aitcLoading='1';div.textContent='Vui lòng chờ, Trợ lý tham vấn đang tra cứu và đối chiếu ngữ cảnh';log.appendChild(div);log.scrollTop=log.scrollHeight;return div;
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
      let loading=null;
      try{
        const body=JSON.parse(init.body);const message=clean(body.message);
        let routed=body.chatPhase==='gemini-followup'||message.includes(FOLLOW_UP_MARKER);
        if(state.initialPublished&&!WORKFLOW_CONTROL.test(message)&&!routed){
          body.message=followUpMessage(message);routed=true;
        }
        if(routed){
          body.chatPhase='gemini-followup';body.initialResultAlreadyPublished=true;body.consultationEngine='gemini';body.externalReasoning='required';body.requireConcreteAnswer=true;
          loading=addLoading();
          try{return await nativeFetch(input,{...init,body:JSON.stringify(body)});}finally{loading?.remove();}
        }
      }catch{loading?.remove();}
    }
    return nativeFetch(input,init);
  };

  function protectedCards(){return [document.querySelector('.quality-card'),document.querySelector('.history-card')].filter(Boolean);}
  function prepareAdminOnly(){for(const card of protectedCards()){card.dataset.aitcAdminOnly='1';card.hidden=true;}}
  function syncAdminOnly(){
    const dashboard=document.getElementById('adminDashboard');const authenticated=Boolean(dashboard&&!dashboard.hidden);
    document.body?.classList.toggle('aitc-admin-view',authenticated);
    for(const card of protectedCards())card.hidden=!authenticated;
    if(authenticated){
      window.dispatchEvent(new CustomEvent('aitc:quality-open'));
      if(state.openHistoryWhenAdmin){
        state.openHistoryWhenAdmin=false;
        queueMicrotask(()=>{const panel=document.getElementById('historyPanel'),toggle=document.getElementById('toggleHistoryBtn');if(panel?.hidden&&toggle)toggle.click();document.querySelector('.history-card')?.scrollIntoView({behavior:'smooth',block:'nearest'});});
      }
    }
  }
  function mountAdminOnly(){
    prepareAdminOnly();const dashboard=document.getElementById('adminDashboard');if(!dashboard)return false;
    let host=document.getElementById('adminProtectedViews');
    if(!host){host=document.createElement('section');host.id='adminProtectedViews';host.className='admin-block';host.innerHTML='<div class="admin-block-head"><div><h3>Dữ liệu & lịch sử</h3><p>Chỉ hiển thị trong phiên Admin đã xác thực.</p></div></div>';dashboard.appendChild(host);}
    for(const card of protectedCards())if(card.parentElement!==host)host.appendChild(card);
    if(!dashboard.dataset.aitcAdminGuard){dashboard.dataset.aitcAdminGuard='1';new MutationObserver(syncAdminOnly).observe(dashboard,{attributes:true,attributeFilter:['hidden']});}
    syncAdminOnly();return true;
  }
  function openAdminCenterForCases(){
    state.openHistoryWhenAdmin=true;mountAdminOnly();
    const open=()=>{const btn=document.getElementById('adminCenterOpenBtn');if(btn){btn.click();return true;}return false;};
    if(open())return;
    document.getElementById('settingsBtn')?.click();
    let tries=0;const timer=setInterval(()=>{tries+=1;if(open()||tries>=20)clearInterval(timer);},100);
  }

  installLoadingStyle();prepareAdminOnly();
  ['.chat-card','#resultCard','.history-card','#reportBox'].forEach(sel=>observeVisibleCopy(document.querySelector(sel)));
  const discovery=new MutationObserver(()=>{mountAdminOnly();normalizeVisibleCopy(document.querySelector('.chat-card'));});
  if(document.body)discovery.observe(document.body,{childList:true});
  mountAdminOnly();

  document.addEventListener('click',event=>{
    const casesButton=event.target.closest?.('#aitcBottomNav [data-nav="cases"]');
    if(!casesButton)return;
    event.preventDefault();event.stopImmediatePropagation();openAdminCenterForCases();
  },true);

  window.addEventListener('aitc:clear-session',()=>{state.caseSerial+=1;state.initialPublished=false;state.lastAssessment=null;});
  window.AITCChatFlow={version:VERSION,state,initialSummary,followUpMessage,mountAdminOnly,normalizeVisibleCopy};
})();
