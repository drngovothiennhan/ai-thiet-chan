import('/clinical-learning.js?v=2.9.0').catch(()=>{});
import('/session-persistence.js?v=2.9.4').catch(()=>{});

(()=>{
  const $=id=>document.getElementById(id);
  const form=$('chatForm'),input=$('chatInput'),log=$('chatLog'),startBtn=$('startInquiryBtn'),progress=$('inquiryProgress'),resultCard=$('resultCard');
  const historyToggle=$('toggleHistoryBtn'),historyPanel=$('historyPanel');
  const inquiryNote=document.querySelector('.inquiry-note');
  const SESSION_KEY='aitc-consultation-session-v2';
  const MAX_TURNS=4;

  if(historyToggle&&historyPanel){
    historyPanel.hidden=true;
    historyToggle.setAttribute('aria-expanded','false');
    historyToggle.addEventListener('click',()=>{
      const open=historyPanel.hidden;
      historyPanel.hidden=!open;
      historyToggle.textContent=open?'Ẩn lịch sử':'Xem lịch sử';
      historyToggle.setAttribute('aria-expanded',String(open));
      if(open)window.dispatchEvent(new CustomEvent('aitc:history-open'));
    });
  }

  if(!form||!input||!log||!startBtn||!progress) return;

  if(inquiryNote) inquiryNote.textContent='Không dùng bộ 10 câu cố định. Sau thiệt chẩn, Trợ lý hỏi từng câu ngắn để khai thác triệu chứng và đối chiếu các ca tương tự trong CSDL; tối đa 4 lượt.';
  progress.removeAttribute('role');
  progress.removeAttribute('tabindex');
  progress.style.cursor='default';

  const inquiry={active:false,turn:0,answers:[],completed:false,transcript:''};
  let pendingPrompt='';
  let pendingKind='';
  const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');
  const nativeFetch=(inputArg,init)=>requestClient.fetchAfter('consultation',inputArg,init);

  function savedMessages(){
    return [...log.querySelectorAll('.bubble')]
      .map(node=>({who:node.classList.contains('user')?'user':'bot',text:node.textContent||''}))
      .filter(item=>item.text.trim());
  }

  function saveSessionState(){
    try{
      sessionStorage.setItem(SESSION_KEY,JSON.stringify({
        inquiry:{...inquiry,answers:[...inquiry.answers]},
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

  function setProgress(){
    if(inquiry.completed)progress.textContent='Đã đối chiếu';
    else if(inquiry.active)progress.textContent='Đối chiếu '+Math.min(inquiry.turn+1,MAX_TURNS)+'/'+MAX_TURNS;
    else progress.textContent='Sẵn sàng đối chiếu';
  }

  function transcriptText(){
    return inquiry.answers.map((answer,index)=>(index+1)+'. '+answer).join('\n');
  }

  function normalizeText(value){
    return String(value||'').trim().toLocaleLowerCase('vi-VN').normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d')
      .replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  }

  function noMoreSymptoms(value){
    const n=normalizeText(value);
    if(!n)return false;
    return /^(khong|khong con|khong co|het|khong them|khong kho chiu gi|binh thuong|khong co gi them)$/.test(n)
      || /^(toi )?khong (con |co )?(trieu chung|kho chiu)/.test(n);
  }

  function openingQuestion(){
    return 'Bạn có triệu chứng gì thêm không, hoặc hiện có khó chịu gì không? Bạn có thể mô tả tự nhiên; nếu không có thêm, hãy trả lời “không”.';
  }

  function adaptivePrompt({final=false}={}){
    const transcript=transcriptText()||'Người dùng chưa cung cấp thêm triệu chứng.';
    if(final){
      return '[ADAPTIVE_SYMPTOM_INTAKE]\n'
        +'Dữ kiện triệu chứng/khó chịu do chính người dùng xác nhận:\n'+transcript+'\n\n'
        +'NHIỆM VỤ: Dùng kết quả thiệt chẩn hiện tại, hệ tri thức và các CA TƯƠNG TỰ được truy hồi từ CSDL để tổng hợp đối chiếu. '
        +'Trình bày ngắn gọn: (1) dữ kiện thiệt chẩn đã quan sát; (2) triệu chứng người dùng đã xác nhận; '
        +'(3) điểm tương đồng/khác biệt có căn cứ với các ca được truy hồi; (4) nhận định YHCT chỉ ở mức tham khảo khi có đủ căn cứ; '
        +'(5) dữ kiện còn thiếu hoặc mâu thuẫn. Không tự thêm triệu chứng, không biến ca lịch sử thành chẩn đoán cho người dùng, không kê đơn và không sao chép phương thuốc từ corpus.';
    }
    return '[ADAPTIVE_SYMPTOM_INTAKE]\n'
      +'Dữ kiện triệu chứng/khó chịu do chính người dùng xác nhận đến lúc này:\n'+transcript+'\n\n'
      +'NHIỆM VỤ: Dùng kết quả thiệt chẩn hiện tại cùng các CA TƯƠNG TỰ được truy hồi từ CSDL để chọn ĐÚNG MỘT câu hỏi tiếp theo có giá trị phân biệt cao nhất. '
      +'Chỉ hỏi về triệu chứng hoặc đặc điểm diễn tiến chưa được người dùng xác nhận. Câu hỏi phải ngắn, tự nhiên, dễ trả lời; '
      +'ưu tiên kiểu “Bạn có ... không?”, “Bạn còn khó chịu ... không?” hoặc hỏi thời điểm/tính chất khi thật sự giúp phân biệt các ca tương tự. '
      +'Không liệt kê nhiều câu, không chạy bộ Thập vấn cố định, không tự gán triệu chứng, không chẩn đoán và không kê đơn. '
      +'Nếu dữ kiện đã đủ và không còn câu hỏi phân biệt có căn cứ từ các ca truy hồi, hãy chuyển sang tổng hợp ngắn thay vì hỏi cho đủ lượt.';
  }

  function resetAdaptive(clearLog=false){
    inquiry.active=false;inquiry.turn=0;inquiry.answers=[];inquiry.completed=false;inquiry.transcript='';
    pendingPrompt='';pendingKind='';
    startBtn.textContent='Bổ sung triệu chứng';
    setProgress();
    if(clearLog){
      log.innerHTML='';
      bubble('Sau khi phân tích lưỡi, tôi sẽ chủ động hỏi triệu chứng để đối chiếu các ca tương tự trong CSDL. Bạn không cần tự nghĩ câu hỏi cho chatbot.');
    }else saveSessionState();
  }

  function beginAdaptive({preserveLog=false}={}){
    if(resultCard?.hidden){
      bubble('Hãy phân tích ảnh lưỡi trước để có kết quả làm nền cho đối chiếu triệu chứng.');
      return;
    }
    inquiry.active=true;inquiry.turn=0;inquiry.answers=[];inquiry.completed=false;inquiry.transcript='';
    pendingPrompt='';pendingKind='';
    if(!preserveLog)log.innerHTML='';
    startBtn.textContent='Bắt đầu lại';
    setProgress();
    bubble(openingQuestion());
    input.focus();
    saveSessionState();
  }

  function loadSessionState(){
    try{
      const data=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');
      if(!data||!data.savedAt||Date.now()-data.savedAt>12*60*60*1000)return false;
      if(data.inquiry&&typeof data.inquiry==='object'){
        inquiry.active=Boolean(data.inquiry.active);
        inquiry.turn=Math.max(0,Math.min(MAX_TURNS,Number(data.inquiry.turn)||0));
        inquiry.answers=Array.isArray(data.inquiry.answers)?data.inquiry.answers.slice(0,MAX_TURNS):[];
        inquiry.completed=Boolean(data.inquiry.completed);
        inquiry.transcript=String(data.inquiry.transcript||'');
      }
      log.innerHTML='';
      for(const item of Array.isArray(data.messages)?data.messages:[])bubble(item.text,item.who,{persist:false});
      input.value=String(data.draft||'');
      startBtn.textContent=inquiry.active?'Bắt đầu lại':'Bổ sung triệu chứng';
      setProgress();
      return true;
    }catch{return false;}
  }

  startBtn.addEventListener('click',()=>beginAdaptive());
  input.addEventListener('input',saveSessionState);

  form.addEventListener('submit',ev=>{
    if(!inquiry.active)return;
    const answer=input.value.trim();
    if(!answer){ev.preventDefault();ev.stopImmediatePropagation();return;}
    inquiry.answers.push(answer);
    inquiry.turn=inquiry.answers.length;
    inquiry.transcript=transcriptText();
    const shouldFinish=noMoreSymptoms(answer)||inquiry.turn>=MAX_TURNS;
    pendingPrompt=adaptivePrompt({final:shouldFinish});
    pendingKind=shouldFinish?'adaptive-final':'adaptive-next';
    if(shouldFinish){
      inquiry.active=false;
      inquiry.completed=true;
      startBtn.textContent='Bổ sung triệu chứng';
    }
    setProgress();
    saveSessionState();
  },true);

  const __aitcAdaptiveFetch=async(inputArg,init={})=>{
    const url=typeof inputArg==='string'?inputArg:inputArg?.url||'';
    const method=String(init?.method||'GET').toUpperCase();

    if(url.includes('/api/chat')&&method==='POST'&&typeof init?.body==='string'){
      try{
        const body=JSON.parse(init.body);
        let requestKind='';
        if(pendingPrompt){
          body.message=pendingPrompt;
          requestKind=pendingKind;
          pendingPrompt='';
          pendingKind='';
        }else if(inquiry.transcript&&typeof body.message==='string'){
          body.message='[ADAPTIVE_SYMPTOM_CONTEXT]\n'
            +'Triệu chứng/khó chịu người dùng đã xác nhận:\n'+inquiry.transcript+'\n\n'
            +'Câu hỏi hiện tại của người dùng: '+body.message+'\n'
            +'Ưu tiên đối chiếu kết quả thiệt chẩn, đúng dữ kiện người dùng đã xác nhận và các ca tương tự được truy hồi. '
            +'Không tự thêm triệu chứng, không chẩn đoán xác định, không kê đơn.';
        }

        const response=await nativeFetch(inputArg,{...init,body:JSON.stringify(body)});
        if(!response.ok&&requestKind==='adaptive-next'){
          queueMicrotask(()=>bubble('Lượt này chưa lấy được câu hỏi đối chiếu từ A.I/CSDL. Triệu chứng bạn vừa nhập vẫn được giữ. Bạn còn triệu chứng hoặc khó chịu nào khác không?'));
        }
        saveSessionState();
        return response;
      }catch{
        return nativeFetch(inputArg,init);
      }
    }

    if(url.includes('/api/analyze')&&method==='POST'){
      const response=await nativeFetch(inputArg,init);
      if(response.ok&&!window.__aitcRestoringSession){
        setTimeout(()=>{
          resetAdaptive(true);
          beginAdaptive({preserveLog:true});
        },0);
      }
      return response;
    }

    return nativeFetch(inputArg,init);
  };

  requestClient.register('consultation',__aitcAdaptiveFetch,300);

  if(!loadSessionState())resetAdaptive(true);
})();
