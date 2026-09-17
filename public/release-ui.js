(()=>{
  const $=(q,root=document)=>root.querySelector(q);
  const $$=(q,root=document)=>[...root.querySelectorAll(q)];
  const capture=$('.capture-card');
  const result=$('#resultCard');
  const chat=$('.chat-card');
  const history=$('.history-card');
  if(!capture||!result||!chat||!history)return;

  function installStepper(){
    if($('#aitcWorkflowStepper'))return;
    const node=document.createElement('div');
    node.id='aitcWorkflowStepper';node.className='workflow-stepper';
    node.setAttribute('aria-label','Quy trình thiệt chẩn');
    node.innerHTML=`
      <div class="workflow-step" data-step="1"><b>1</b><span>Ảnh</span></div>
      <i aria-hidden="true"></i>
      <div class="workflow-step" data-step="2"><b>2</b><span>QC</span></div>
      <i aria-hidden="true"></i>
      <div class="workflow-step" data-step="3"><b>3</b><span>A.I</span></div>
      <i aria-hidden="true"></i>
      <div class="workflow-step" data-step="4"><b>4</b><span>Kết quả</span></div>`;
    const mode=$('.mode-picker',capture);(mode||capture.firstElementChild)?.insertAdjacentElement('afterend',node);
  }

  function updateStepper(){
    const topReady=!$('#topPreview')?.hidden;
    const bottomRequired=!$('#bottomCaptureCard')?.hidden;
    const bottomReady=!$('#bottomPreview')?.hidden;
    const imagesReady=topReady&&(!bottomRequired||bottomReady);
    const qcReady=imagesReady&&!$('#topQcPanel')?.hidden&&(!bottomRequired||!$('#bottomQcPanel')?.hidden);
    const analyzing=$('#analyzeBtn')?.textContent?.includes('Đang phân tích');
    const resultReady=!result.hidden;
    const current=resultReady?4:analyzing?3:qcReady?3:imagesReady?2:1;
    $$('.workflow-step').forEach(el=>{
      const n=Number(el.dataset.step);el.classList.toggle('done',n<current);el.classList.toggle('active',n===current);
    });
  }

  function installBottomNav(){
    if($('#aitcBottomNav'))return;
    const nav=document.createElement('nav');nav.id='aitcBottomNav';nav.className='aitc-bottom-nav';nav.setAttribute('aria-label','Điều hướng chính');
    nav.innerHTML=`
      <button type="button" data-nav="capture"><span>舌</span><small>Thiệt chẩn</small></button>
      <button type="button" data-nav="assistant"><span>✦</span><small>Trợ lý</small></button>
      <button type="button" data-nav="cases"><span>▤</span><small>Ca</small></button>
      <button type="button" data-nav="settings"><span>⚙</span><small>Cài đặt</small></button>`;
    document.body.appendChild(nav);
    nav.addEventListener('click',ev=>{
      const btn=ev.target.closest('button[data-nav]');if(!btn)return;
      const kind=btn.dataset.nav;
      if(kind==='capture')capture.scrollIntoView({behavior:'smooth',block:'start'});
      if(kind==='assistant')chat.scrollIntoView({behavior:'smooth',block:'start'});
      if(kind==='cases'){
        const toggle=$('#toggleHistoryBtn');const panel=$('#historyPanel');
        if(toggle&&panel?.hidden)toggle.click();history.scrollIntoView({behavior:'smooth',block:'start'});
      }
      if(kind==='settings')$('#settingsBtn')?.click();
    });
  }

  function installNewCaseButton(){
    if($('#newCaseBtn'))return;
    const health=$('#healthBadge');
    if(!health)return;
    const wrap=document.createElement('div');wrap.className='aitc-health-actions';
    health.parentElement?.replaceChild(wrap,health);wrap.appendChild(health);
    const btn=document.createElement('button');btn.id='newCaseBtn';btn.type='button';btn.className='btn ghost compact';btn.textContent='Bắt đầu ca mới';btn.setAttribute('aria-label','Xóa dữ liệu ca hiện tại và bắt đầu ca mới');wrap.appendChild(btn);
    const style=document.createElement('style');style.textContent='.aitc-health-actions{display:grid;gap:8px;justify-items:end;align-content:start}.aitc-health-actions .btn{min-height:34px;padding:6px 10px;font-size:12px;white-space:nowrap}@media(max-width:420px){.aitc-health-actions{justify-items:end}}';document.head.appendChild(style);
    btn.addEventListener('click',()=>{
      try{sessionStorage.removeItem('aitc-current-session-v1');sessionStorage.removeItem('aitc-consultation-session-v1');}catch{}
      window.dispatchEvent(new CustomEvent('aitc:clear-session'));
      location.reload();
    });
  }

  const citationPattern=/\s*\[(?:TC1|DY1|MC1|AT1|PSY1)\s*,?\s*tr\.?\s*\d+\]\s*/gi;
  function cleanReferenceText(value){
    let text=String(value||'').replace(citationPattern,' ');
    const marker=text.search(/(?:^|\n)\s*(?:Nguồn đối chiếu|Tài liệu tham khảo|Tham khảo)\s*:/i);
    if(marker>=0)text=text.slice(0,marker);
    return text.replace(/[ \t]{2,}/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  }
  function sanitizeNonChatReferences(root){
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){const cleaned=cleanReferenceText(node.nodeValue);if(cleaned!==node.nodeValue)node.nodeValue=cleaned;}
    $$('[data-source],[data-reference],.source-list,.reference-list,.citation-list',root).forEach(el=>el.remove());
  }
  function observeReferenceBoundary(){
    const targets=[result,$('#reportBox')].filter(Boolean);
    const observer=new MutationObserver(()=>targets.forEach(sanitizeNonChatReferences));
    targets.forEach(el=>observer.observe(el,{subtree:true,childList:true,characterData:true}));
  }

  function markEvidenceFirst(){
    result.classList.add('evidence-first-result');
    $('#theoryBox')?.classList.add('evidence-first-theory');
    $('#summaryText')?.closest('.summary-box')?.classList.add('evidence-summary');
  }

  installStepper();installBottomNav();installNewCaseButton();markEvidenceFirst();observeReferenceBoundary();updateStepper();
  const stateObserver=new MutationObserver(updateStepper);
  ['#topPreview','#bottomPreview','#topQcPanel','#bottomQcPanel','#resultCard','#analyzeBtn','#bottomCaptureCard'].forEach(sel=>{const el=$(sel);if(el)stateObserver.observe(el,{attributes:true,attributeFilter:['hidden'],childList:true,characterData:true,subtree:true});});
  document.addEventListener('change',()=>queueMicrotask(updateStepper));
  document.addEventListener('click',()=>setTimeout(updateStepper,0));
})();

(()=>{
  if(window.AITCPipelineContract)return;
  const version='pipeline-contract-v1';
  const layers=Object.freeze([
    Object.freeze({id:'capture-qc',order:1,runtime:'browser',authority:'input-quality',fallback:'reject-or-degrade-confidence'}),
    Object.freeze({id:'device-vision',order:2,runtime:'browser-worker',authority:'feature-extraction-only',fallback:'existing-server-pipeline'}),
    Object.freeze({id:'server-fusion',order:3,runtime:'server',authority:'assessment-synthesis',fallback:'fail-closed-on-provider-error'}),
    Object.freeze({id:'learning-store',order:4,runtime:'supabase',authority:'approved-case-memory',fallback:'analysis-without-learning-retrieval'}),
    Object.freeze({id:'consultation',order:5,runtime:'server-provider',authority:'post-result-reasoning',fallback:'explicit-provider-error'})
  ]);
  window.AITCPipelineContract=Object.freeze({version,layers});
})();

(()=>{
  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===src;}catch{return false;}});
      if(existing){
        if(existing.dataset.aitcLoaded==='true'||existing.readyState==='complete')return resolve();
        const done=()=>{existing.dataset.aitcLoaded='true';resolve();};
        existing.addEventListener('load',done,{once:true});existing.addEventListener('error',reject,{once:true});
        setTimeout(()=>{if(document.contains(existing))resolve();},1500);
        return;
      }
      const s=document.createElement('script');s.src=src;s.defer=true;s.dataset.aitcHotfix=src;
      s.onload=()=>{s.dataset.aitcLoaded='true';resolve();};s.onerror=reject;document.head.appendChild(s);
    });
  }
  (async()=>{
    try{
      if(!window.AITCHardwareProfile)await loadScript('/hardware-profile.js');
      if(!window.AITCDeviceRuntime)await loadScript('/device-runtime.js');
      const settingsModulesReady=window.__aitcSettingsModulesReady;
      await import('/clinical-learning.js?v=2.9.0').catch(()=>{});
      await import('/session-persistence.js?v=2.9.4').catch(()=>{});
      if(!window.AITCAcademicVision)await loadScript('/academic-vision.js');
      await loadScript('/analysis-hotfix.js');
      await loadScript('/book-fallback.js');
      await loadScript('/benchmark-telemetry.js');
      await loadScript('/consultation-lock.js');
      await loadScript('/admin-enhancement-collapse.js');
      if(settingsModulesReady)await settingsModulesReady;
      await loadScript('/request-integrity.js');
      window.dispatchEvent(new CustomEvent('aitc:runtime-ready',{detail:{requestIntegrity:Boolean(window.AITCRequestIntegrity),deviceRuntime:Boolean(window.AITCDeviceRuntime),pipelineContract:window.AITCPipelineContract?.version||null,pipelineLayers:window.AITCPipelineContract?.layers?.map(layer=>layer.id)||[]}}));
    }catch(err){console.warn('analysis_hotfix_loader_failed',err?.message||err);}
  })();
})();
