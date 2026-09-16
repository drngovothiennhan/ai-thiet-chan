(()=>{
  'use strict';
  const TOKEN_KEY='aitcClinicalAdminToken';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>{try{return new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(new Date(v));}catch{return String(v||'');}};

  function lockPublicCaseViews(){
    const history=document.querySelector('.history-card');if(history)history.hidden=true;
    const quality=document.querySelector('.quality-card');if(quality)quality.hidden=true;
    document.querySelectorAll('[data-nav="cases"]').forEach(n=>n.remove());
  }

  function ensureAdminUi(){
    const dashboard=$('adminDashboard');if(!dashboard||$('adminHistoryBlock'))return;
    const block=document.createElement('section');
    block.id='adminHistoryBlock';block.className='admin-block';
    block.innerHTML=`<div class="admin-block-head"><div><h3>Lịch sử phân tích</h3><p>Chỉ Admin được xem. Danh sách này là các ca duy nhất sau khử trùng lặp ảnh; không phải tổng số lượt bấm phân tích.</p></div><button id="adminHistoryRefreshBtn" class="btn ghost compact" type="button">Làm mới</button></div><div id="adminHistoryStats" class="admin-center-status">Chưa tải.</div><div id="adminHistoryList" class="admin-list"></div>`;
    const feedback=$('adminFeedbackList')?.closest('.admin-block');
    if(feedback)feedback.insertAdjacentElement('beforebegin',block);else dashboard.appendChild(block);
    $('adminHistoryRefreshBtn')?.addEventListener('click',loadAdminHistory);
    const observer=new MutationObserver(()=>{if(!dashboard.hidden)loadAdminHistory();});
    observer.observe(dashboard,{attributes:true,attributeFilter:['hidden']});
  }

  function render(rows){
    const list=$('adminHistoryList'),stats=$('adminHistoryStats');if(!list||!stats)return;
    const data=Array.isArray(rows)?rows:[];
    const general=data.filter(x=>x.assessment_mode==='general').length;
    const local=data.filter(x=>String(x.model||'').includes('local')).length;
    const gemini=data.length-local;
    stats.textContent=`${data.length} ca duy nhất gần nhất · ${general} ca tổng quát · ${gemini} Gemini · ${local} local fallback`;
    stats.className='admin-center-status good';
    if(!data.length){list.innerHTML='<div class="admin-empty">Chưa có ca được lưu.</div>';return;}
    list.innerHTML=data.map(x=>{
      const conf=Math.round(Math.max(0,Math.min(1,Number(x.confidence)||0))*100);
      const mode=x.assessment_mode==='general'?'Tổng quát':'Bình thường';
      const qTop=String(x.top_qc_grade||'—').toUpperCase();
      const qBottom=x.assessment_mode==='general'?` · QC dưới ${esc(String(x.bottom_qc_grade||'—').toUpperCase())}`:'';
      const features=[x.top_tongue_color&&`Lưỡi: ${x.top_tongue_color}`,x.top_coating_color&&`Rêu: ${x.top_coating_color}`,x.bottom_vessels&&`Mạch dưới: ${x.bottom_vessels}`].filter(Boolean).join(' · ');
      return `<article class="admin-item"><div class="admin-meta">${esc(fmt(x.created_at))} · ${esc(mode)} · QC trên ${esc(qTop)}${qBottom} · ${conf}% · ${esc(x.model||'')}</div>${features?`<p>${esc(features)}</p>`:''}<p>${esc(x.summary||'Không có tóm tắt.')}</p></article>`;
    }).join('');
  }

  async function loadAdminHistory(){
    const list=$('adminHistoryList'),stats=$('adminHistoryStats');if(!list||!stats)return;
    const token=sessionStorage.getItem(TOKEN_KEY)||'';
    if(!token){stats.textContent='Cần đăng nhập Admin Center.';stats.className='admin-center-status warn';list.innerHTML='';return;}
    stats.textContent='Đang tải lịch sử…';stats.className='admin-center-status';
    try{
      const response=await fetch('/api/cases?limit=100',{cache:'no-store',headers:{'x-admin-token':token}});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||`HTTP ${response.status}`);
      render(data?.cases||[]);
    }catch(err){stats.textContent=`Không tải được lịch sử: ${err.message}`;stats.className='admin-center-status warn';list.innerHTML='';}
  }

  function install(){lockPublicCaseViews();ensureAdminUi();}
  install();
  new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
})();
