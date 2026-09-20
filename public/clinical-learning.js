(()=>{
  const $=id=>document.getElementById(id);
  const resultCard=$('resultCard');
  const SUPABASE_URL='https://gzmpnsrwqjpsbklyflqr.supabase.co';
  const SUPABASE_KEY='sb_publishable_Y4hMhXROZ-aVgWoaQ5fFKQ_ZAcXuIzG';
  const LEARNING_THRESHOLD=0.55;
  const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');
  const previousFetch=(input,init)=>requestClient.fetchAfter('clinical-learning',input,init);
  const rawFetch=(input,init)=>requestClient.fetchAfter('consultation',input,init);
  const learning={caseId:null,caseHash:'',topHash:'',bottomHash:'',assessment:null,featureVector:null,matches:[]};

  const subtitle=document.querySelector('.subtitle');
  if(subtitle) subtitle.textContent='HIU CLB YHCT';

  const style=document.createElement('style');
  style.textContent=`.clinical-feedback-card{display:block}.clinical-feedback-card.pending-analysis .clinical-learning-grid{opacity:.62}.clinical-learning-grid{display:grid;gap:10px}.clinical-learning-grid.two{grid-template-columns:1fr 1fr}.clinical-learning-grid label{display:grid;gap:6px;font-size:13px;font-weight:800;color:#314d48}.clinical-learning-grid input,.clinical-learning-grid select,.clinical-learning-grid textarea,.clinical-admin-auth input{width:100%;box-sizing:border-box;border:1px solid #cfdedb;border-radius:12px;padding:11px 12px;background:#fff;color:#17302d;font:inherit}.clinical-learning-grid textarea{min-height:108px;resize:vertical}.clinical-learning-note{font-size:12px;color:#647a75;margin:8px 0 0}.clinical-learning-status{margin-top:10px;padding:10px 12px;border-radius:12px;background:#eef7f5;font-size:13px}.clinical-learning-status.good{background:#e8f7ef;color:#176b46}.clinical-learning-status.warn{background:#fff7e8;color:#8c5d0b}.clinical-evidence{margin-top:12px;padding:12px;border:1px solid #cfe3de;border-radius:14px;background:#f7fbfa}.clinical-evidence strong{display:block;margin-bottom:6px}.clinical-evidence ul{margin:6px 0 0;padding-left:18px}.clinical-admin-trigger{margin-top:12px}.clinical-admin-dialog{border:0;border-radius:18px;padding:0;max-width:min(760px,94vw);width:100%;box-shadow:0 28px 80px #17302d33}.clinical-admin-dialog::backdrop{background:#102b2888}.clinical-admin-panel{padding:18px}.clinical-admin-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.clinical-admin-head h2{margin:0}.clinical-admin-auth{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:12px}.clinical-admin-list{display:grid;gap:10px;max-height:55vh;overflow:auto;margin-top:12px}.clinical-admin-item{border:1px solid #dbe9e6;border-radius:14px;padding:12px;background:#fff}.clinical-admin-item p{margin:6px 0;white-space:pre-wrap}.clinical-admin-meta{font-size:12px;color:#60736f}.clinical-admin-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}@media(max-width:640px){.clinical-learning-grid.two{grid-template-columns:1fr}.clinical-admin-auth{grid-template-columns:1fr}}`;
  document.head.appendChild(style);

  function escapeHtml(v){return String(v??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));}
  function setFeedbackStatus(text,kind=''){const node=$('clinicalFeedbackStatus');if(!node)return;node.hidden=false;node.textContent=text;node.className=`clinical-learning-status ${kind}`.trim();}
  function setAdminStatus(text,kind=''){const node=$('clinicalAdminStatus');if(!node)return;node.hidden=false;node.textContent=text;node.className=`clinical-learning-status ${kind}`.trim();}
  function setFeedbackState(){
    const card=$('clinicalFeedbackCard');if(!card)return;
    const ready=Boolean(learning.assessment&&learning.featureVector&&resultCard&&!resultCard.hidden);
    card.classList.toggle('pending-analysis',!ready);
    const badge=card.querySelector('.status-pill');if(badge)badge.textContent=ready?'Sẵn sàng góp ý':'Phân tích ca trước';
    for(const id of ['clinicalContributorName','clinicalProfessionalTitle','clinicalNote','clinicalSubmitBtn']){const node=$(id);if(node)node.disabled=!ready;}
    const status=$('clinicalFeedbackStatus');
    if(!ready){setFeedbackStatus('Hãy phân tích ảnh và xem kết quả trước. Sau đó bạn có thể gửi góp ý/chẩn đoán bổ sung về admin.','warn');}
    else if(status&&status.textContent.startsWith('Hãy phân tích ảnh')) status.hidden=true;
  }
  function removeLearningEvidence(){document.getElementById('clinicalLearningEvidence')?.remove();}
  function resetLearningContext(){Object.assign(learning,{caseId:null,caseHash:'',topHash:'',bottomHash:'',assessment:null,featureVector:null,matches:[]});const f=$('clinicalFeedbackForm');if(f)f.reset();removeLearningEvidence();setFeedbackState();}

  function createClinicalUi(){
    if(!resultCard||$('clinicalFeedbackCard')) return;
    const card=document.createElement('section');card.id='clinicalFeedbackCard';card.className='card clinical-feedback-card pending-analysis';
    card.innerHTML=`<div class="section-head"><div><h2>Góp ý ca lâm sàng</h2><p>Bổ sung nhận định khi ca chưa có trong dữ liệu hoặc kết quả hiện tại chưa đủ. Góp ý chỉ được đưa vào dữ liệu học sau khi admin duyệt.</p></div><span class="status-pill">Phân tích ca trước</span></div><form id="clinicalFeedbackForm" class="clinical-learning-grid"><div class="clinical-learning-grid two"><label>Họ và tên *<input id="clinicalContributorName" maxlength="160" required autocomplete="name" disabled /></label><label>Chức danh *<select id="clinicalProfessionalTitle" required disabled><option value="">Chọn chức danh</option><option value="bac_si">Bác sĩ</option><option value="y_si">Y sĩ</option></select></label></div><label>Góp ý / chẩn đoán bổ sung cho ca *<textarea id="clinicalNote" maxlength="5000" required disabled placeholder="Ghi nội dung chuyên môn cần bổ sung hoặc hiệu chỉnh dựa trên ca đang xem."></textarea></label><button id="clinicalSubmitBtn" class="btn primary" type="submit" disabled>Gửi về admin duyệt</button></form><p class="clinical-learning-note">Hệ thống không tự học từ nội dung chưa duyệt. Chỉ bản được admin phê duyệt mới được dùng khi gặp ca tương tự.</p><div id="clinicalFeedbackStatus" class="clinical-learning-status warn">Hãy phân tích ảnh và xem kết quả trước. Sau đó bạn có thể gửi góp ý/chẩn đoán bổ sung về admin.</div>`;
    resultCard.insertAdjacentElement('afterend',card);

    const settingsPanel=document.querySelector('#settingsDialog .settings-panel');
    if(settingsPanel&&!$('clinicalAdminOpenBtn')){const trigger=document.createElement('button');trigger.id='clinicalAdminOpenBtn';trigger.className='btn ghost full clinical-admin-trigger';trigger.type='button';trigger.textContent='Admin · Duyệt góp ý lâm sàng';settingsPanel.appendChild(trigger);trigger.addEventListener('click',openAdminDialog);}

    const dialog=document.createElement('dialog');dialog.id='clinicalAdminDialog';dialog.className='clinical-admin-dialog';
    dialog.innerHTML=`<div class="clinical-admin-panel"><div class="clinical-admin-head"><div><h2>Duyệt góp ý lâm sàng</h2><p class="clinical-learning-note">Chỉ nội dung được duyệt mới trở thành kiến thức học của hệ thống.</p></div><button id="clinicalAdminCloseBtn" class="settings-close" type="button" aria-label="Đóng">×</button></div><div class="clinical-admin-auth"><input id="clinicalAdminToken" type="password" autocomplete="off" placeholder="Khóa admin" /><button id="clinicalAdminLoadBtn" class="btn primary" type="button">Mở hàng chờ</button></div><div id="clinicalAdminStatus" class="clinical-learning-status" hidden></div><div id="clinicalAdminList" class="clinical-admin-list"></div></div>`;
    document.body.appendChild(dialog);
    $('clinicalAdminCloseBtn')?.addEventListener('click',()=>dialog.close());$('clinicalAdminLoadBtn')?.addEventListener('click',loadAdminQueue);$('clinicalFeedbackForm')?.addEventListener('submit',submitClinicalFeedback);
    setFeedbackState();
  }

  async function sha256Text(text){const data=new TextEncoder().encode(String(text||''));const digest=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');}
  async function hashDataUrl(dataUrl){return dataUrl?sha256Text(dataUrl):'';}
  async function supabaseRpc(name,payload){const response=await rawFetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'authorization':`Bearer ${SUPABASE_KEY}`},body:JSON.stringify(payload)});const data=await response.json().catch(()=>null);if(!response.ok){throw new Error(data?.message||data?.hint||data?.error||`HTTP ${response.status}`);}return data;}

  async function findApprovedLearning(){
    if(!learning.featureVector)return [];
    const rows=await supabaseRpc('ai_thiet_chan_find_learned_cases_v2',{p_feature_vector:learning.featureVector,p_top_image_hash:learning.topHash||'',p_bottom_image_hash:learning.bottomHash||'',p_limit:3});
    return (Array.isArray(rows)?rows:[]).filter(row=>Boolean(row.exact_image_match)||Number(row.similarity||0)>=LEARNING_THRESHOLD);
  }

  async function synthesizeWithLearning(baseAssessment,matches){
    if(!matches.length)return baseAssessment;
    const approvedKnowledge=matches.map(row=>({similarity:Number(row.similarity||0),exactImageMatch:Boolean(row.exact_image_match),approvedAt:row.approved_at,professionalTitle:row.professional_title,knowledgeRevision:row.knowledge_revision,clinicalNote:row.clinical_note,verifiedClinicalAnnotation:row.base_analysis?.verifiedClinicalAnnotation||null,verificationBasis:row.base_analysis?.verificationBasis||null,source:row.base_analysis?.source||'legacy-approved-feedback'}));
    const context=JSON.parse(JSON.stringify(baseAssessment||{}));context.approvedClinicalKnowledge=approvedKnowledge;
    try{
      const response=await rawFetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({assessment:context,message:'Hãy tổng hợp lại nhận định cho ca hiện tại bằng cách đối chiếu lý thuyết thiệt chẩn trong kết quả hiện tại với các góp ý lâm sàng đã được admin duyệt. Ưu tiên ca trùng ảnh hoặc có độ tương tự cao; khi độ tương tự gần nhau ưu tiên bản duyệt mới nhất. Chỉ mở rộng trong phạm vi dữ kiện nhìn thấy và kiến thức đã duyệt; nếu mâu thuẫn phải nêu rõ, không tự thêm triệu chứng, không kê đơn và không biến thành chẩn đoán xác định. Trả lời ngắn gọn bằng tiếng Việt.'})});
      const data=await response.json().catch(()=>({}));if(response.ok&&data.reply){context.combined=context.combined||{};context.combined.summary=data.reply;}
    }catch{}
    context.approvedClinicalKnowledge=approvedKnowledge;return context;
  }

  function renderLearningEvidence(){
    removeLearningEvidence();
  }

  async function submitClinicalFeedback(event){
    event.preventDefault();if(!learning.assessment||!learning.featureVector||resultCard?.hidden){setFeedbackStatus('Chưa có ca phân tích hiện tại để gửi góp ý.','warn');setFeedbackState();return;}
    const name=$('clinicalContributorName')?.value.trim()||'',title=$('clinicalProfessionalTitle')?.value||'',note=$('clinicalNote')?.value.trim()||'';
    if(name.length<2||!['bac_si','y_si'].includes(title)||note.length<5){setFeedbackStatus('Bắt buộc nhập họ tên, chọn chức danh Bác sĩ/Y sĩ và ghi nội dung góp ý.','warn');return;}
    const btn=$('clinicalSubmitBtn');if(btn){btn.disabled=true;btn.textContent='Đang gửi…';}
    try{await supabaseRpc('ai_thiet_chan_submit_feedback_v1',{p_case_id:learning.caseId||null,p_case_hash:learning.caseHash||'',p_top_image_hash:learning.topHash||'',p_bottom_image_hash:learning.bottomHash||'',p_feature_vector:learning.featureVector,p_analysis:learning.assessment,p_contributor_name:name,p_professional_title:title,p_clinical_note:note});setFeedbackStatus('Đã gửi về admin. Nội dung chưa được dùng để học cho đến khi được duyệt.','good');}
    catch(err){setFeedbackStatus(`Chưa gửi được: ${err.message}`,'warn');}
    finally{if(btn){btn.disabled=false;btn.textContent='Gửi về admin duyệt';}}
  }

  function openAdminDialog(){const dialog=$('clinicalAdminDialog');if(!dialog)return;const saved=sessionStorage.getItem('aitcClinicalAdminToken')||'';if($('clinicalAdminToken'))$('clinicalAdminToken').value=saved;if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
  async function loadAdminQueue(){
    const token=$('clinicalAdminToken')?.value.trim()||'';if(!token){setAdminStatus('Nhập khóa admin.','warn');return;}sessionStorage.setItem('aitcClinicalAdminToken',token);const list=$('clinicalAdminList');if(list)list.innerHTML='';setAdminStatus('Đang tải hàng chờ…');
    try{const rows=await supabaseRpc('ai_thiet_chan_admin_list_feedback_v1',{p_admin_token:token,p_limit:50});const pending=(Array.isArray(rows)?rows:[]).filter(row=>row.status==='pending');setAdminStatus(pending.length?`Có ${pending.length} góp ý đang chờ duyệt.`:'Không có góp ý đang chờ.','good');if(list)list.innerHTML=pending.map(row=>`<article class="clinical-admin-item" data-id="${escapeHtml(row.id)}"><div class="clinical-admin-meta">${escapeHtml(new Date(row.created_at).toLocaleString('vi-VN'))} · ${row.professional_title==='bac_si'?'Bác sĩ':'Y sĩ'} · ${escapeHtml(row.contributor_name)}</div><p><strong>Góp ý</strong><br>${escapeHtml(row.clinical_note)}</p><p class="clinical-admin-meta"><strong>Kết quả hiện tại:</strong> ${escapeHtml(row.analysis_snapshot?.combined?.summary||'Không có tóm tắt')}</p><div class="clinical-admin-actions"><button class="btn primary compact" type="button" data-decision="approved">Duyệt & đưa vào dữ liệu học</button><button class="btn ghost compact" type="button" data-decision="rejected">Từ chối</button></div></article>`).join('');list?.querySelectorAll('[data-decision]').forEach(btn=>btn.addEventListener('click',()=>reviewFeedback(btn.closest('[data-id]')?.dataset.id,btn.dataset.decision)));}
    catch(err){setAdminStatus(String(err.message).includes('unauthorized')?'Khóa admin không đúng.':`Không tải được hàng chờ: ${err.message}`,'warn');sessionStorage.removeItem('aitcClinicalAdminToken');}
  }
  async function reviewFeedback(id,decision){const token=sessionStorage.getItem('aitcClinicalAdminToken')||$('clinicalAdminToken')?.value.trim()||'';if(!id||!token)return;try{await supabaseRpc('ai_thiet_chan_admin_review_feedback_v1',{p_admin_token:token,p_feedback_id:id,p_decision:decision,p_admin_note:''});setAdminStatus(decision==='approved'?'Đã duyệt. Kiến thức này có hiệu lực ngay cho các ca tương tự.':'Đã từ chối góp ý.','good');await loadAdminQueue();}catch(err){setAdminStatus(`Không cập nhật được: ${err.message}`,'warn');}}

  createClinicalUi();
  if(resultCard)new MutationObserver(setFeedbackState).observe(resultCard,{attributes:true,attributeFilter:['hidden']});

  const __aitcStage3bFetch=async(inputArg,init={})=>{
    const url=typeof inputArg==='string'?inputArg:inputArg?.url||'',method=String(init?.method||'GET').toUpperCase();
    if(url.includes('/api/analyze')&&method==='POST'&&typeof init?.body==='string'){
      resetLearningContext();let requestBody={};try{requestBody=JSON.parse(init.body)||{};}catch{}
      const [topHash,bottomHash]=await Promise.all([hashDataUrl(requestBody.topImage||requestBody.image||''),hashDataUrl(requestBody.bottomImage||'')]);
      const response=await previousFetch(inputArg,init);if(!response.ok)return response;
      try{
        const data=await response.clone().json(),assessment=data.assessment||data.analysis||null;
        learning.caseId=data.collection?.caseId||null;learning.topHash=topHash;learning.bottomHash=bottomHash;learning.caseHash=await sha256Text(`${topHash}|${bottomHash}|${requestBody.mode||'normal'}`);learning.assessment=assessment;learning.featureVector=assessment?.ml?.featureVector||null;
        learning.matches=await findApprovedLearning().catch(()=>[]);
        if(assessment&&learning.matches.length){const enhanced=await synthesizeWithLearning(assessment,learning.matches);learning.assessment=enhanced;data.assessment=enhanced;data.analysis=enhanced;const headers=new Headers(response.headers);headers.delete('content-length');queueMicrotask(()=>{setFeedbackState();renderLearningEvidence();});return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers});}
        queueMicrotask(setFeedbackState);
      }catch{queueMicrotask(setFeedbackState);}
      return response;
    }
    return previousFetch(inputArg,init);
  };
  requestClient.register('clinical-learning',__aitcStage3bFetch,600);
})();