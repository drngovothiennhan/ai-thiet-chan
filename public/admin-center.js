(()=>{
  const SUPABASE_URL='https://gzmpnsrwqjpsbklyflqr.supabase.co';
  const SUPABASE_KEY='sb_publishable_Y4hMhXROZ-aVgWoaQ5fFKQ_ZAcXuIzG';
  const TOKEN_KEY='aitcClinicalAdminToken';
  const DRIVE_FOLDER_URL='https://drive.google.com/drive/folders/1vPOIc34DkRnfbe5SIgZRTsJZcFJvEyWB';
  const DRIVE_BACKUP_URL='https://drive.google.com/drive/folders/1zxcIuA9Uk1T3F_VRa2mJsZRFHSscUBD5';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function rpc(name,payload){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'authorization':`Bearer ${SUPABASE_KEY}`},body:JSON.stringify(payload)});
    const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.message||d?.hint||d?.error||`HTTP ${r.status}`);return d;
  }
  function token(){return sessionStorage.getItem(TOKEN_KEY)||'';}
  function setStatus(text,kind=''){const n=$('adminCenterStatus');if(!n)return;n.hidden=false;n.textContent=text;n.className=`admin-center-status ${kind}`.trim();}
  function stripLegacyAdmin(){$('clinicalAdminOpenBtn')?.remove();$('clinicalAdminDialog')?.remove();}

  function ensureUi(){
    stripLegacyAdmin();const panel=document.querySelector('#settingsDialog .settings-panel');
    if(panel&&!$('adminCenterOpenBtn')){const g=document.createElement('div');g.className='settings-group admin-center-entry';g.innerHTML='<strong>Quản trị hệ thống</strong><button id="adminCenterOpenBtn" class="btn primary full" type="button">Đăng nhập Admin Center</button><p class="settings-note" style="margin-top:8px">Kiểm tra A.I, dữ liệu học, duyệt góp ý và quản lý backup.</p>';panel.appendChild(g);$('adminCenterOpenBtn')?.addEventListener('click',openCenter);}
    if(!$('adminCenterDialog')){
      const d=document.createElement('dialog');d.id='adminCenterDialog';d.className='admin-center-dialog';
      d.innerHTML=`<div class="admin-center-panel">
        <div class="admin-center-head"><div><h2>Admin Center</h2><p>Kiểm tra hệ thống · enhancement · duyệt góp ý · dữ liệu học · backup/khôi phục</p></div><button id="adminCenterCloseBtn" class="settings-close" type="button">×</button></div>
        <section id="adminLoginView" class="admin-login-view"><label>Khóa quản trị<input id="adminCenterToken" type="password" autocomplete="current-password" placeholder="Nhập khóa admin" /></label><button id="adminCenterLoginBtn" class="btn primary full" type="button">Đăng nhập</button><div id="adminCenterStatus" class="admin-center-status" hidden></div></section>
        <section id="adminDashboard" hidden>
          <div class="admin-toolbar"><button id="adminRefreshBtn" class="btn ghost compact" type="button">Kiểm tra lại</button><button id="adminLogoutBtn" class="btn ghost compact" type="button">Đăng xuất</button></div>
          <div class="admin-stat-grid"><div><span>A.I Gemini</span><strong id="adminAiState">—</strong></div><div><span>Kho dữ liệu</span><strong id="adminStoreState">—</strong></div><div><span>Ca đã thu thập</span><strong id="adminCaseCount">—</strong></div><div><span>Góp ý chờ duyệt</span><strong id="adminPendingCount">—</strong></div><div><span>Kiến thức đã duyệt</span><strong id="adminLearnedCount">—</strong></div><div><span>Học song song</span><strong id="adminContinualState">—</strong></div><div><span>Bản backup</span><strong id="adminBackupCount">—</strong></div></div>
          <div id="adminSystemStatus" class="admin-center-status"></div>
          <section class="admin-block"><div class="admin-block-head"><div><h3>Kiểm định Image Enhancement</h3><p>Chỉ Admin được bật/tắt. Mỗi ca lưu scale, gamma, color-drift, glare và trạng thái rollback trong QC.</p></div><button id="adminEnhancementToggle" class="btn ghost compact" type="button">—</button></div><div id="adminEnhancementState" class="admin-center-status"></div><div id="adminEnhancementAudit" class="admin-list"></div></section>
          <section class="admin-block"><div class="admin-block-head"><div><h3>Duyệt góp ý lâm sàng</h3><p>Chỉ góp ý được duyệt mới tham gia suy luận ca tương tự.</p></div><button id="adminFeedbackRefreshBtn" class="btn ghost compact" type="button">Làm mới</button></div><div id="adminFeedbackList" class="admin-list"></div></section>
          <section class="admin-block"><div class="admin-block-head"><div><h3>Duyệt đóng góp chuyên gia xác nhận</h3><p>Chỉ ca có xác nhận Bác sĩ/Y sĩ trên app, ROI độc lập và được Admin duyệt mới đi vào gold evidence. Một người chỉ tính một nhãn cho mỗi ca.</p></div><button id="adminVerifiedContributionRefreshBtn" class="btn ghost compact" type="button">Làm mới</button></div><div id="adminGoldProgress" class="admin-center-status"></div><div id="adminVerifiedContributionList" class="admin-list"></div><h4 style="margin:14px 0 8px">Chuyên gia đủ điều kiện adjudication</h4><div id="adminVerifiedExpertList" class="admin-list"></div></section>
          <section class="admin-block"><div class="admin-block-head"><div><h3>Học liên tục · serve-and-learn</h3><p>Serving không đổi model trong lúc học. Chỉ gold đã adjudication và không thuộc prospective holdout mới vào snapshot huấn luyện; silver được dùng làm replay.</p></div><button id="adminContinualRefreshBtn" class="btn ghost compact" type="button">Làm mới</button></div><div id="adminContinualStatus" class="admin-center-status"></div></section>
          <section class="admin-block"><div class="admin-block-head"><div><h3>Backup & khôi phục</h3><p>Backup vận hành được lưu trong hệ thống và đồng bộ định kỳ sang Drive A.I Thiệt Chẩn.</p></div><button id="adminCreateBackupBtn" class="btn primary compact" type="button">Tạo backup</button></div><div class="admin-backup-links"><a href="${DRIVE_FOLDER_URL}" target="_blank" rel="noopener">Drive A.I Thiệt Chẩn</a><a href="${DRIVE_BACKUP_URL}" target="_blank" rel="noopener">Thư mục Backups</a></div><div class="admin-import-row"><label class="btn ghost compact">Nhập backup từ Drive<input id="adminBackupFile" type="file" accept="application/json,.json" hidden /></label><span>Chọn file JSON đã tải từ thư mục Backups.</span></div><div id="adminBackupList" class="admin-list"></div></section>
        </section></div>`;
      document.body.appendChild(d);
      $('adminCenterCloseBtn')?.addEventListener('click',()=>d.close());$('adminCenterLoginBtn')?.addEventListener('click',login);$('adminRefreshBtn')?.addEventListener('click',refreshAll);$('adminLogoutBtn')?.addEventListener('click',logout);$('adminEnhancementToggle')?.addEventListener('click',toggleEnhancement);$('adminFeedbackRefreshBtn')?.addEventListener('click',loadFeedback);$('adminVerifiedContributionRefreshBtn')?.addEventListener('click',loadVerifiedContributions);$('adminContinualRefreshBtn')?.addEventListener('click',loadContinualStatus);$('adminCreateBackupBtn')?.addEventListener('click',createBackup);$('adminBackupFile')?.addEventListener('change',importBackupFile);$('adminCenterToken')?.addEventListener('keydown',e=>{if(e.key==='Enter')login();});d.addEventListener('cancel',e=>{e.preventDefault();d.close();});
    }
  }

  async function openCenter(){ensureUi();stripLegacyAdmin();const d=$('adminCenterDialog');if(!d)return;if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');const saved=token();if(saved){$('adminCenterToken').value=saved;await verifyAndOpen(saved,true);}else{$('adminLoginView').hidden=false;$('adminDashboard').hidden=true;$('adminCenterToken')?.focus();}}
  async function login(){const t=$('adminCenterToken')?.value.trim()||'';if(!t){setStatus('Nhập khóa quản trị.','warn');return;}await verifyAndOpen(t,false);}
  async function verifyAndOpen(t,silent){const btn=$('adminCenterLoginBtn');if(btn)btn.disabled=true;if(!silent)setStatus('Đang xác thực…');try{const info=await rpc('ai_thiet_chan_admin_verify_v1',{p_admin_token:t});sessionStorage.setItem(TOKEN_KEY,t);$('adminLoginView').hidden=true;$('adminDashboard').hidden=false;paintCounts(info);await refreshAll();}catch(err){sessionStorage.removeItem(TOKEN_KEY);$('adminLoginView').hidden=false;$('adminDashboard').hidden=true;setStatus(String(err.message).includes('unauthorized')?'Khóa admin không đúng.':'Không đăng nhập được: '+err.message,'warn');}finally{if(btn)btn.disabled=false;}}
  function logout(){sessionStorage.removeItem(TOKEN_KEY);$('adminDashboard').hidden=true;$('adminLoginView').hidden=false;$('adminCenterToken').value='';setStatus('Đã đăng xuất.','good');}
  function paintCounts(info={}){if($('adminCaseCount'))$('adminCaseCount').textContent=String(info.cases??'—');if($('adminPendingCount'))$('adminPendingCount').textContent=String(info.pendingFeedback??'—');if($('adminLearnedCount'))$('adminLearnedCount').textContent=String(info.activeLearned??'—');if($('adminBackupCount'))$('adminBackupCount').textContent=String(info.backups??'—');}

  async function loadEnhancement(){
    const state=$('adminEnhancementState'),list=$('adminEnhancementAudit'),btn=$('adminEnhancementToggle');if(!state||!list||!btn)return;
    try{
      const [cfg,rows]=await Promise.all([rpc('ai_thiet_chan_image_enhancement_config_v1',{}),rpc('ai_thiet_chan_admin_enhancement_audit_v1',{p_admin_token:token(),p_limit:30})]);
      state.dataset.enabled=String(Boolean(cfg?.enabled));state.textContent=`Enhancement: ${cfg?.enabled?'BẬT':'TẮT'} · version: ${cfg?.version||'—'}`;state.className=`admin-center-status ${cfg?.enabled?'good':'warn'}`;btn.textContent=cfg?.enabled?'Tắt enhancement':'Bật enhancement';
      const data=Array.isArray(rows)?rows:[];
      if(!data.length){list.innerHTML='<div class="admin-empty">Chưa có ca mới chứa audit enhancement. Các ca cũ không được suy diễn số liệu.</div>';return;}
      list.innerHTML=data.map(x=>{const t=x.top_enhancement||{},b=x.bottom_enhancement||null;const one=(label,m)=>m?`${label}: scale ${m.output?.scale??'—'} · gamma ${m.gamma??'—'} · drift ${m.colorDrift??'—'} · glare Δ ${m.glareDeltaPct??'—'}% · rollback ${m.rollback?'CÓ':'không'}${m.rollbackReason?.length?' ('+m.rollbackReason.join(', ')+')':''}`:`${label}: không có audit`;return `<article class="admin-item"><div class="admin-meta">${esc(new Date(x.created_at).toLocaleString('vi-VN'))} · ${esc(x.assessment_mode||'normal')} · ${esc(String(x.id).slice(0,8))}</div><p>${esc(one('Mặt trên',t))}</p>${b?`<p>${esc(one('Mặt dưới',b))}</p>`:''}</article>`;}).join('');
    }catch(err){state.textContent='Không tải được kiểm định enhancement: '+err.message;state.className='admin-center-status warn';list.innerHTML='';}
  }
  async function toggleEnhancement(){
    const state=$('adminEnhancementState'),btn=$('adminEnhancementToggle');if(!state||!btn)return;const next=state.dataset.enabled!=='true';btn.disabled=true;
    try{await rpc('ai_thiet_chan_admin_set_image_enhancement_v1',{p_admin_token:token(),p_enabled:next});await loadEnhancement();}
    catch(err){state.textContent='Không thay đổi được enhancement: '+err.message;state.className='admin-center-status warn';}
    finally{btn.disabled=false;}
  }

  async function refreshAll(){
    const t=token();if(!t)return logout();$('adminSystemStatus').textContent='Đang kiểm tra toàn hệ thống…';$('adminSystemStatus').className='admin-center-status';
    try{const [info,health]=await Promise.all([rpc('ai_thiet_chan_admin_verify_v1',{p_admin_token:t}),fetch('/api/health',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d?.error||`HTTP ${r.status}`);return d;})]);paintCounts(info);$('adminAiState').textContent=health.providerConfigured?'Sẵn sàng':'Chưa cấu hình';$('adminStoreState').textContent=health.caseCollection?.storeReady?'Sẵn sàng':'Chưa sẵn sàng';const healthy=Boolean(health.ok&&health.providerConfigured&&health.caseCollection?.storeReady);$('adminSystemStatus').textContent=healthy?'A.I, kho ca và pipeline thu thập dữ liệu đang sẵn sàng. Kiến thức lâm sàng chỉ được kích hoạt sau khi admin duyệt.':'Có thành phần chưa sẵn sàng. Kiểm tra trạng thái A.I/kho dữ liệu trước khi sử dụng.';$('adminSystemStatus').className=`admin-center-status ${healthy?'good':'warn'}`;await Promise.all([loadEnhancement(),loadFeedback(),loadVerifiedContributions(),loadContinualStatus(),loadBackups()]);}catch(err){$('adminSystemStatus').textContent='Kiểm tra thất bại: '+err.message;$('adminSystemStatus').className='admin-center-status warn';}
  }
  async function loadFeedback(){const list=$('adminFeedbackList');if(!list)return;list.innerHTML='<div class="admin-empty">Đang tải…</div>';try{const rows=await rpc('ai_thiet_chan_admin_list_feedback_v1',{p_admin_token:token(),p_limit:100});const pending=(Array.isArray(rows)?rows:[]).filter(x=>x.status==='pending');if(!pending.length){list.innerHTML='<div class="admin-empty">Không có góp ý đang chờ duyệt.</div>';return;}list.innerHTML=pending.map(x=>`<article class="admin-item" data-feedback-id="${esc(x.id)}"><div class="admin-meta">${esc(new Date(x.created_at).toLocaleString('vi-VN'))} · ${x.professional_title==='bac_si'?'Bác sĩ':'Y sĩ'} · ${esc(x.contributor_name)}</div><p>${esc(x.clinical_note)}</p><div class="admin-actions"><button class="btn primary compact" data-review="approved" type="button">Duyệt & học</button><button class="btn ghost compact" data-review="rejected" type="button">Từ chối</button></div></article>`).join('');list.querySelectorAll('[data-review]').forEach(b=>b.addEventListener('click',()=>reviewFeedback(b.closest('[data-feedback-id]')?.dataset.feedbackId,b.dataset.review)));}catch(err){list.innerHTML=`<div class="admin-empty warn">Không tải được góp ý: ${esc(err.message)}</div>`;}}
  async function reviewFeedback(id,decision){if(!id)return;try{await rpc('ai_thiet_chan_admin_review_feedback_v1',{p_admin_token:token(),p_feedback_id:id,p_decision:decision,p_admin_note:''});await refreshAll();}catch(err){$('adminSystemStatus').textContent='Không cập nhật được góp ý: '+err.message;$('adminSystemStatus').className='admin-center-status warn';}}
  async function loadVerifiedContributions(){
    const list=$('adminVerifiedContributionList'),progress=$('adminGoldProgress');if(!list||!progress)return;
    list.innerHTML='<div class="admin-empty">Đang tải đóng góp chuyên gia…</div>';
    try{
      const [rows,p,experts]=await Promise.all([
        rpc('ai_thiet_chan_admin_list_verified_clinical_contributions_v1',{p_admin_token:token(),p_limit:100}),
        rpc('ai_thiet_chan_admin_gold_progress_v2',{p_admin_token:token()}),
        rpc('ai_thiet_chan_admin_list_verified_gold_experts_v1',{p_admin_token:token()})
      ]);
      progress.textContent='Gold: '+String(p.withOneExpert||0)+' ca có ≥1 chuyên gia · '+String(p.withTwoIndependentExperts||0)+' ca đủ 2 chuyên gia · '+String(p.adjudicated||0)+' adjudicated · '+String(p.lockedHoldout||0)+' holdout.';
      progress.className='admin-center-status '+(Number(p.withTwoIndependentExperts||0)>0?'good':'warn');
      const expertList=$('adminVerifiedExpertList');
      const verifiedExperts=Array.isArray(experts)?experts:[];
      if(expertList){
        expertList.innerHTML=verifiedExperts.length?verifiedExperts.map(x=>'<article class="admin-item" data-expert-hash="'+esc(x.contributor_hash)+'"><div class="admin-meta">'+(x.professional_title==='bac_si'?'Bác sĩ':'Y sĩ')+' · '+esc(x.contributor_name)+' · '+String(x.approved_contributions||0)+' đóng góp đã duyệt</div><div class="admin-actions"><button class="btn ghost compact" data-create-adjudicator type="button">Tạo phiên adjudication 72h</button></div></article>').join(''):'<div class="admin-empty">Chưa có chuyên gia nào được Admin duyệt để làm adjudicator.</div>';
        expertList.querySelectorAll('[data-create-adjudicator]').forEach(b=>b.addEventListener('click',()=>createVerifiedAdjudicatorSession(b.closest('[data-expert-hash]')?.dataset.expertHash)));
      }
      const pending=(Array.isArray(rows)?rows:[]).filter(x=>x.status==='pending');
      if(!pending.length){list.innerHTML='<div class="admin-empty">Không có đóng góp chuyên gia đang chờ duyệt.</div>';return;}
      list.innerHTML=pending.map(x=>{
        const title=x.professional_title==='bac_si'?'Bác sĩ':'Y sĩ';
        const a=x.annotation||{};
        return '<article class="admin-item" data-contribution-id="'+esc(x.id)+'"><div class="admin-meta">'+esc(new Date(x.created_at).toLocaleString('vi-VN'))+' · '+title+' · '+esc(x.contributor_name)+'</div><p><strong>Xác nhận app:</strong> '+(x.professional_attested?'CÓ':'KHÔNG')+' · <strong>quality:</strong> '+esc(a.image_quality||'—')+' · <strong>tongue:</strong> '+esc(String(a.tongue_present))+'</p><p>'+esc(x.clinical_note||'Không ghi chú')+'</p><div class="admin-actions"><button class="btn primary compact" data-contribution-review="approved" type="button">Duyệt vào gold</button><button class="btn ghost compact" data-contribution-review="rejected" type="button">Từ chối</button></div></article>';
      }).join('');
      list.querySelectorAll('[data-contribution-review]').forEach(b=>b.addEventListener('click',()=>reviewVerifiedContribution(b.closest('[data-contribution-id]')?.dataset.contributionId,b.dataset.contributionReview)));
    }catch(err){progress.textContent='Không tải được gold progress: '+err.message;progress.className='admin-center-status warn';list.innerHTML='';}
  }
  async function reviewVerifiedContribution(id,decision){
    if(!id)return;
    try{
      const out=await rpc('ai_thiet_chan_admin_review_verified_clinical_contribution_v1',{p_admin_token:token(),p_contribution_id:id,p_decision:decision,p_admin_note:''});
      $('adminSystemStatus').textContent=decision==='approved'
        ?'Đã duyệt đóng góp chuyên gia. Số nhãn độc lập của ca: '+String(out.independentGoldCount||0)+(out.adjudicationEligible?' · ĐỦ ĐIỀU KIỆN adjudication':'')
        :'Đã từ chối đóng góp chuyên gia.';
      $('adminSystemStatus').className='admin-center-status good';
      await loadVerifiedContributions();
    }catch(err){$('adminSystemStatus').textContent='Không duyệt được đóng góp chuyên gia: '+err.message;$('adminSystemStatus').className='admin-center-status warn';}
  }
  async function createVerifiedAdjudicatorSession(contributorHash){
    if(!contributorHash)return;
    try{
      const out=await rpc('ai_thiet_chan_admin_create_verified_adjudicator_session_v1',{p_admin_token:token(),p_contributor_hash:contributorHash,p_hours:72});
      const link=location.origin+String(out.reviewUrl||'/gold-review-v1.html')+'?t='+encodeURIComponent(out.reviewerToken||'');
      try{await navigator.clipboard.writeText(link);}catch{}
      $('adminSystemStatus').textContent='Đã tạo phiên adjudication 72h cho '+String(out.contributorName||'chuyên gia')+'. Link đã được sao chép nếu trình duyệt cho phép.';
      $('adminSystemStatus').className='admin-center-status good';
      window.prompt('Gửi link này cho adjudicator đã xác nhận chuyên môn:',link);
      await loadVerifiedContributions();
    }catch(err){$('adminSystemStatus').textContent='Không tạo được phiên adjudication: '+err.message;$('adminSystemStatus').className='admin-center-status warn';}
  }
  async function loadContinualStatus(){
    const box=$('adminContinualStatus'),state=$('adminContinualState');if(!box)return;
    try{
      const d=await rpc('ai_thiet_chan_admin_continual_learning_status_v1',{p_admin_token:token()});
      const l=d.learningLane||{},s=d.servingLane||{},snap=d.latestSnapshot||null;
      if(state)state.textContent='Sẵn sàng';
      box.textContent='Serving độc lập huấn luyện: '+(s.availabilityIndependentFromTraining?'CÓ':'KHÔNG')+
        ' · queued '+String(l.queuedEvents||0)+
        ' · holdout-blocked '+String(l.blockedHoldoutEvents||0)+
        ' · snapshot '+String(l.snapshots||0)+
        ' · job chờ '+String(l.pendingTrainingJobs||0)+
        (snap?' · latest '+String(snap.snapshotVersion||'')+' ('+String(snap.supervisedCount||0)+' mẫu)':'');
      box.className='admin-center-status good';
    }catch(err){
      if(state)state.textContent='Chưa sẵn sàng';
      box.textContent='Không đọc được trạng thái học liên tục: '+err.message;box.className='admin-center-status warn';
    }
  }
  async function createBackup(){const b=$('adminCreateBackupBtn');if(b)b.disabled=true;try{await rpc('ai_thiet_chan_admin_create_backup_v1',{p_admin_token:token(),p_source:'manual-admin-center',p_label:'Backup thủ công từ Admin Center',p_drive_file_id:'',p_drive_web_view_link:''});await refreshAll();}catch(err){$('adminSystemStatus').textContent='Tạo backup thất bại: '+err.message;$('adminSystemStatus').className='admin-center-status warn';}finally{if(b)b.disabled=false;}}
  async function loadBackups(){const list=$('adminBackupList');if(!list)return;list.innerHTML='<div class="admin-empty">Đang tải backup…</div>';try{const rows=await rpc('ai_thiet_chan_admin_list_backups_v1',{p_admin_token:token(),p_limit:50});if(!Array.isArray(rows)||!rows.length){list.innerHTML='<div class="admin-empty">Chưa có backup.</div>';return;}list.innerHTML=rows.map(x=>`<article class="admin-item" data-backup-id="${esc(x.id)}"><div class="admin-meta">${esc(new Date(x.created_at).toLocaleString('vi-VN'))} · ${esc(x.source)}</div><strong>${esc(x.label||'Backup')}</strong><p>${x.case_count} ca · ${x.feedback_count} góp ý · ${x.learned_count} kiến thức học</p><div class="admin-actions">${x.drive_web_view_link?`<a class="btn ghost compact" href="${esc(x.drive_web_view_link)}" target="_blank" rel="noopener">Mở Drive</a>`:''}<button class="btn ghost compact" data-export type="button">Xuất JSON</button><button class="btn danger compact" data-restore type="button">Khôi phục</button></div></article>`).join('');list.querySelectorAll('[data-export]').forEach(b=>b.addEventListener('click',()=>exportBackup(b.closest('[data-backup-id]')?.dataset.backupId)));list.querySelectorAll('[data-restore]').forEach(b=>b.addEventListener('click',()=>restoreBackup(b.closest('[data-backup-id]')?.dataset.backupId)));}catch(err){list.innerHTML=`<div class="admin-empty warn">Không tải được backup: ${esc(err.message)}</div>`;}}
  async function exportBackup(id){try{const d=await rpc('ai_thiet_chan_admin_export_backup_v1',{p_admin_token:token(),p_backup_id:id});const blob=new Blob([JSON.stringify(d.snapshot,null,2)],{type:'application/json'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=`ai-thiet-chan-backup-${new Date().toISOString().slice(0,10)}-${id.slice(0,8)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}catch(err){$('adminSystemStatus').textContent='Xuất backup thất bại: '+err.message;$('adminSystemStatus').className='admin-center-status warn';}}
  async function restoreBackup(id){if(!id||!window.confirm('Khôi phục backup này sẽ thay thế kho ca, góp ý và kiến thức học hiện tại. Tiếp tục?'))return;try{await rpc('ai_thiet_chan_admin_restore_backup_v1',{p_admin_token:token(),p_backup_id:id,p_confirm:'KHOI_PHUC'});$('adminSystemStatus').textContent='Khôi phục thành công. Đang kiểm tra lại dữ liệu…';$('adminSystemStatus').className='admin-center-status good';await refreshAll();}catch(err){$('adminSystemStatus').textContent='Khôi phục thất bại: '+err.message;$('adminSystemStatus').className='admin-center-status warn';}}
  async function importBackupFile(e){const file=e.target.files?.[0];if(!file)return;try{const snapshot=JSON.parse(await file.text());if(snapshot?.schemaVersion!=='ai-thiet-chan-backup-v1')throw new Error('File không đúng định dạng backup A.I Thiệt Chẩn.');const id=await rpc('ai_thiet_chan_admin_import_backup_v1',{p_admin_token:token(),p_snapshot:snapshot,p_label:`Drive import · ${file.name}`});$('adminSystemStatus').textContent=`Đã nhập backup ${String(id).slice(0,8)}. Chọn Khôi phục khi cần.`;$('adminSystemStatus').className='admin-center-status good';await loadBackups();}catch(err){$('adminSystemStatus').textContent='Nhập backup thất bại: '+err.message;$('adminSystemStatus').className='admin-center-status warn';}finally{e.target.value='';}}

  ensureUi();new MutationObserver(()=>{stripLegacyAdmin();ensureUi();}).observe(document.body,{childList:true,subtree:true});
})();