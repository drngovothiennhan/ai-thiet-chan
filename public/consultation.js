import('/clinical-learning.js?v=2.9.0').catch(()=>{});
import('/session-persistence.js?v=2.9.4').catch(()=>{});

(()=>{
  const $=id=>document.getElementById(id);
  const form=$('chatForm'),input=$('chatInput'),log=$('chatLog'),
    supplementBtn=$('startInquiryBtn'),readyBtn=$('readyCompareBtn'),
    progress=$('inquiryProgress'),resultCard=$('resultCard');
  const SESSION_KEY='aitc-consultation-session-v4';
  const MAX_FOLLOWUPS=3;
  const SUPPLEMENT_LABEL='Bổ sung triệu chứng';
  const READY_LABEL='Sẵn sàng đối chiếu';
  const requestClient=window.AITCRequestClient;
  if(!form||!input||!log||!supplementBtn||!readyBtn||!progress||!resultCard||!requestClient)return;
  const nativeFetch=(inputArg,init)=>requestClient.fetchAfter('consultation',inputArg,init);

  const flow={
    mode:null,active:false,turn:0,answers:[],interactions:[],
    askedConceptIds:[],currentConceptId:null,completed:false
  };
  let pendingKind='';
  let busy=false;

  function savedMessages(){
    return [...log.querySelectorAll('.bubble')]
      .map(node=>({who:node.classList.contains('user')?'user':'bot',text:String(node.textContent||'').slice(0,2000)}))
      .filter(item=>item.text.trim())
      .slice(-24);
  }
  function saveSessionState(){
    try{
      sessionStorage.setItem(SESSION_KEY,JSON.stringify({
        flow:{
          ...flow,
          answers:[...flow.answers],
          interactions:[...flow.interactions],
          askedConceptIds:[...flow.askedConceptIds]
        },
        messages:savedMessages(),draft:input.value,savedAt:Date.now()
      }));
    }catch{}
  }
  function bubble(text,who='bot',{persist=true}={}){
    const div=document.createElement('div');
    div.className='bubble '+who;
    div.textContent=text;
    log.appendChild(div);
    log.scrollTop=log.scrollHeight;
    if(persist)saveSessionState();
  }
  function hasResult(){return !resultCard.hidden;}
  function syncControls(){
    const ready=hasResult();
    supplementBtn.disabled=!ready||busy;
    readyBtn.disabled=!ready||busy;
    supplementBtn.textContent=SUPPLEMENT_LABEL;
    readyBtn.textContent=READY_LABEL;
    if(busy)progress.textContent='Đang đối chiếu…';
    else if(flow.completed&&ready)progress.textContent='Đã kết thúc tư vấn';
    else if(flow.active)progress.textContent='Đối chiếu '+Math.min(flow.turn+1,MAX_FOLLOWUPS)+'/'+MAX_FOLLOWUPS;
    else if(ready)progress.textContent='Chọn cách đối chiếu';
    else progress.textContent='Phân tích ảnh trước';
  }
  function resetFlow({clearLog=false}={}){
    flow.mode=null;flow.active=false;flow.turn=0;flow.answers=[];flow.interactions=[];
    flow.askedConceptIds=[];flow.currentConceptId=null;flow.completed=false;
    pendingKind='';busy=false;
    if(clearLog)log.innerHTML='';
    syncControls();saveSessionState();
  }
  function normalizeText(value){
    return String(value||'').trim().toLocaleLowerCase('vi-VN').normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d')
      .replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  }
  function noMoreSymptoms(value){
    const n=normalizeText(value);
    if(!n)return false;
    return /^(khong|khong con|khong co|het|khong them|binh thuong|khong co gi them)$/.test(n)
      || /^(toi )?khong (con |co )?(trieu chung|kho chiu)/.test(n);
  }
  function openingQuestion(){
    return 'Ngoài dấu hiệu trên lưỡi, điều gì đang làm bạn khó chịu nhất? Xin cho biết khi nào bắt đầu và diễn biến đến nay; bạn có thể bổ sung triệu chứng liên quan nếu có. Hệ thống sẽ hỏi thêm tối đa 3 ý để đối chiếu chứng trạng; nếu không có gì thêm, hãy trả lời “không”.';
  }
  function transcriptText(){
    if(!flow.interactions.length)return '';
    return flow.interactions.map((item,index)=>{
      const q=String(item?.question||'').trim();
      const a=String(item?.answer||'').trim();
      const concept=String(item?.conceptId||'').trim();
      return (index+1)+'. '+(q?'Hỏi: '+q+'\n   ':'')+'Đáp: '+a+(concept?'\n   Mục đã hỏi: '+concept:'');
    }).join('\n');
  }
  function finalPrompt(){
    const transcript=transcriptText()||'Người dùng không cung cấp thêm triệu chứng.';
    return '[DUAL_CONSULT_FINAL]\n'
      +'Dữ kiện người dùng đã xác nhận trong phiên:\n'+transcript+'\n\n'
      +'NHIỆM VỤ: Dùng kết quả thiệt chẩn hiện tại, hệ tri thức YHCT và các CA TƯƠNG TỰ được truy hồi từ CSDL để kết thúc tư vấn. '
      +'Trình bày bằng tiếng Việt chuyên môn, rõ và dễ hiểu; dùng nhất quán các thuật ngữ chất lưỡi/thân lưỡi, rêu lưỡi, hình thể, độ nhuận/khô, dấu răng, rãnh giữa và nứt. Khi dùng thuật ngữ YHCT như hàn-nhiệt, hư-thực hoặc biểu-lý, giải thích ngắn bằng lời phổ thông. '
      +'Sắp xếp ngắn gọn: (1) thiệt tượng đã quan sát; (2) vấn chứng người dùng đã xác nhận; (3) điểm phù hợp/khác biệt với ca truy hồi và dẫn chứng tri thức được cung cấp; (4) biện chứng YHCT có điều kiện nếu đủ căn cứ; (5) dữ kiện còn thiếu/mâu thuẫn; (6) gợi ý bước tiếp theo an toàn, không kê đơn. '
      +'Không tự thêm triệu chứng, không biến ca lịch sử thành chẩn đoán cho người hiện tại, không suy bệnh danh hiện đại chỉ từ ảnh, không kê đơn và không sao chép phương thuốc từ corpus.';
  }
  function lastBotQuestion(){
    const nodes=[...log.querySelectorAll('.bubble.bot')];
    return String(nodes.at(-1)?.textContent||'').trim().slice(0,500);
  }
  function rememberAskedConcept(value){
    const id=String(value||'').trim();
    if(!id)return;
    if(!flow.askedConceptIds.includes(id))flow.askedConceptIds.push(id);
    flow.currentConceptId=id;
  }
  function startSupplement(){
    if(!hasResult()){bubble('Hãy phân tích ảnh lưỡi trước để có kết quả làm nền.');syncControls();return;}
    resetFlow({clearLog:true});
    flow.mode='supplement';flow.active=true;
    bubble(openingQuestion());
    input.focus();syncControls();saveSessionState();
  }
  function startReady(){
    if(!hasResult()){bubble('Hãy phân tích ảnh lưỡi trước để có kết quả làm nền.');syncControls();return;}
    resetFlow({clearLog:true});
    flow.mode='ready';
    pendingKind='ready-probe';
    input.value=READY_LABEL;
    form.requestSubmit();
  }
  function restoreSession(){
    try{
      const data=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');
      if(!data||!data.savedAt||Date.now()-data.savedAt>12*60*60*1000)return false;
      const saved=data.flow&&typeof data.flow==='object'?data.flow:{};
      flow.mode=saved.mode==='supplement'||saved.mode==='ready'?saved.mode:null;
      flow.active=Boolean(saved.active);
      flow.turn=Math.max(0,Math.min(MAX_FOLLOWUPS,Number(saved.turn)||0));
      flow.answers=Array.isArray(saved.answers)?saved.answers.slice(0,MAX_FOLLOWUPS):[];
      flow.interactions=Array.isArray(saved.interactions)?saved.interactions.slice(0,MAX_FOLLOWUPS).map(item=>({
        question:String(item?.question||'').slice(0,500),
        answer:String(item?.answer||'').slice(0,1000),
        conceptId:String(item?.conceptId||'').slice(0,80)
      })):[];
      flow.askedConceptIds=Array.isArray(saved.askedConceptIds)?[...new Set(saved.askedConceptIds.map(String).filter(Boolean))].slice(0,MAX_FOLLOWUPS):[];
      flow.currentConceptId=String(saved.currentConceptId||'')||null;
      flow.completed=Boolean(saved.completed);
      log.innerHTML='';
      for(const item of Array.isArray(data.messages)?data.messages:[])bubble(item.text,item.who,{persist:false});
      input.value=String(data.draft||'');
      return true;
    }catch{return false;}
  }
  async function finalizeFromBody(body,init){
    flow.active=false;flow.completed=true;pendingKind='';
    const finalBody={...body,message:finalPrompt()};
    const response=await nativeFetch('/api/chat',{...init,body:JSON.stringify(finalBody)});
    syncControls();saveSessionState();
    return response;
  }
  async function requestNext(body,init){
    const nextBody={
      ...body,
      symptomContext:transcriptText(),
      askedConceptIds:[...flow.askedConceptIds],
      message:String(body.message||'')
    };
    const response=await nativeFetch('/api/symptom-next',{...init,body:JSON.stringify(nextBody)});
    if(!response.ok)return finalizeFromBody(body,init);
    let payload={};
    try{payload=await response.clone().json();}catch{}
    if(payload?.evidenceBased===true&&payload?.selectedConcept&&flow.turn<MAX_FOLLOWUPS){
      rememberAskedConcept(payload.selectedConcept);
      flow.active=true;flow.completed=false;
      syncControls();saveSessionState();
      return response;
    }
    return finalizeFromBody(body,init);
  }

  supplementBtn.addEventListener('click',startSupplement);
  readyBtn.addEventListener('click',startReady);
  input.addEventListener('input',saveSessionState);
  new MutationObserver(saveSessionState).observe(log,{childList:true});

  form.addEventListener('submit',ev=>{
    if(!flow.active)return;
    const answer=input.value.trim();
    if(!answer){ev.preventDefault();ev.stopImmediatePropagation();return;}
    const answeredQuestion=lastBotQuestion();
    flow.answers.push(answer);
    flow.interactions.push({
      question:answeredQuestion,
      answer,
      conceptId:flow.currentConceptId||''
    });
    if(flow.currentConceptId)rememberAskedConcept(flow.currentConceptId);
    flow.currentConceptId=null;
    flow.turn=flow.answers.length;
    pendingKind=(noMoreSymptoms(answer)||flow.turn>=MAX_FOLLOWUPS)?'final':'next';
    if(pendingKind==='final')flow.active=false;
    syncControls();saveSessionState();
  },true);

  const __aitcDualConsultFetch=async(inputArg,init={})=>{
    const url=typeof inputArg==='string'?inputArg:inputArg?.url||'';
    const method=String(init?.method||'GET').toUpperCase();

    if(url.includes('/api/chat')&&method==='POST'&&typeof init?.body==='string'){
      let body;
      try{body=JSON.parse(init.body);}catch{return nativeFetch(inputArg,init);}
      const kind=pendingKind;pendingKind='';
      if(kind==='ready-probe'){
        busy=true;syncControls();
        try{return await requestNext(body,init);}
        finally{busy=false;syncControls();saveSessionState();}
      }
      if(kind==='next'){
        busy=true;syncControls();
        try{return await requestNext(body,init);}
        finally{busy=false;syncControls();saveSessionState();}
      }
      if(kind==='final'){
        busy=true;syncControls();
        try{return await finalizeFromBody(body,init);}
        finally{busy=false;syncControls();saveSessionState();}
      }
      return nativeFetch(inputArg,init);
    }

    if(url.includes('/api/analyze')&&method==='POST'){
      const response=await nativeFetch(inputArg,init);
      if(response.ok&&!window.__aitcRestoringSession){
        setTimeout(()=>{
          resetFlow({clearLog:true});
          bubble('Kết quả thiệt chẩn đã sẵn sàng. Chọn “Bổ sung triệu chứng” nếu muốn cung cấp thêm dữ kiện, hoặc “Sẵn sàng đối chiếu” để hệ thống tự quyết định hỏi thêm vài ý cần thiết hay kết thúc tư vấn.');
          syncControls();saveSessionState();
        },0);
      }
      return response;
    }
    return nativeFetch(inputArg,init);
  };

  requestClient.register('consultation',__aitcDualConsultFetch,300);
  if(!restoreSession()){
    log.innerHTML='';
    bubble('Sau khi phân tích lưỡi, bạn có thể chọn “Bổ sung triệu chứng” hoặc “Sẵn sàng đối chiếu”. Hệ thống chỉ hỏi thêm tối đa vài ý có căn cứ rồi kết thúc tư vấn.');
  }
  new MutationObserver(syncControls).observe(resultCard,{attributes:true,attributeFilter:['hidden']});
  window.addEventListener('aitc:clear-session',()=>{try{sessionStorage.removeItem(SESSION_KEY);}catch{}resetFlow();});
  syncControls();
})();