(()=>{
  'use strict';
  const STYLE_ID='aitc-admin-enhancement-collapse-style';

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;
    style.textContent=`
      .aitc-admin-enhancement-collapsible{padding:0;overflow:hidden}
      .aitc-enhancement-summary{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:0;background:transparent;padding:13px;text-align:left;color:#214943;font:inherit;cursor:pointer}
      .aitc-enhancement-summary-copy{min-width:0;display:grid;gap:4px}
      .aitc-enhancement-summary-copy strong{font-size:14px;line-height:1.25}
      .aitc-enhancement-summary-copy small{font-size:11px;color:#71817e;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .aitc-enhancement-chevron{flex:0 0 auto;width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:#eef6f4;color:#31534d;font-size:14px;transition:transform .18s ease}
      .aitc-admin-enhancement-collapsible[data-open="true"] .aitc-enhancement-chevron{transform:rotate(180deg)}
      .aitc-admin-enhancement-body{padding:0 13px 13px}
      .aitc-admin-enhancement-body[hidden]{display:none!important}
      @media(max-width:640px){.aitc-enhancement-summary{padding:12px}.aitc-admin-enhancement-body{padding:0 12px 12px}}
    `;
    document.head.appendChild(style);
  }

  function install(){
    const state=document.getElementById('adminEnhancementState');
    const block=state?.closest('.admin-block');
    if(!block)return false;
    if(block.dataset.enhancementCollapsible==='1')return true;

    block.dataset.enhancementCollapsible='1';
    block.dataset.open='false';
    block.classList.add('aitc-admin-enhancement-collapsible');

    const body=document.createElement('div');body.className='aitc-admin-enhancement-body';body.hidden=true;
    [...block.children].forEach(node=>body.appendChild(node));

    const summary=document.createElement('button');summary.type='button';summary.id='adminEnhancementSectionToggle';summary.className='aitc-enhancement-summary';summary.setAttribute('aria-expanded','false');
    summary.innerHTML='<span class="aitc-enhancement-summary-copy"><strong>Kiểm định Image Enhancement</strong><small id="adminEnhancementCompactState">Ẩn mặc định · mở khi cần kiểm định</small></span><span class="aitc-enhancement-chevron" aria-hidden="true">⌄</span>';
    block.append(summary,body);

    const compact=summary.querySelector('#adminEnhancementCompactState');
    const syncCompactState=()=>{
      const text=String(state.textContent||'').trim();
      compact.textContent=text?text.replace(/^Enhancement:\s*/i,''):'Ẩn mặc định · mở khi cần kiểm định';
    };
    syncCompactState();
    new MutationObserver(syncCompactState).observe(state,{subtree:true,childList:true,characterData:true,attributes:true});

    summary.addEventListener('click',()=>{
      const open=block.dataset.open!=='true';
      block.dataset.open=String(open);body.hidden=!open;summary.setAttribute('aria-expanded',String(open));
    });
    return true;
  }

  function boot(){
    ensureStyle();
    if(install())return;
    const observer=new MutationObserver(()=>{if(install())observer.disconnect();});
    observer.observe(document.body,{childList:true,subtree:true});
  }

  function loadRuntime(src){
    return new Promise((resolve,reject)=>{
      if(document.querySelector(`script[data-aitc-quality-runtime="${src}"]`))return resolve();
      const s=document.createElement('script');s.src=src;s.defer=true;s.dataset.aitcQualityRuntime=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
    });
  }
  async function installQualityRuntime(){
    try{
      await loadRuntime('/clinical-learning.js');
      await loadRuntime('/quality-grounding-v4.js');
    }catch(err){console.warn('quality_grounding_loader_failed',err?.message||err);}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  installQualityRuntime();
})();
