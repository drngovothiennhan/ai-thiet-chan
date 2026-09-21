(()=>{
  const $=(q,root=document)=>root.querySelector(q);
  const $$=(q,root=document)=>[...root.querySelectorAll(q)];
  const content=$('.content');
  const capture=$('.capture-card');
  const result=$('#resultCard');
  const chat=$('.chat-card');
  const quality=$('.quality-card');
  if(!content||!capture||!result||!chat||!quality)return;

  const WORKSPACE_KEY='aitc-active-workspace-v2';
  let activeWorkspace='capture';

  function feedback(){return $('#clinicalFeedbackCard');}
  function panelsFor(name){
    if(name==='capture')return [capture];
    if(name==='result')return [result,feedback()].filter(Boolean);
    if(name==='symptoms')return [chat];
    if(name==='system')return [quality];
    return [];
  }
  function allPanels(){return [capture,result,chat,quality,feedback()].filter(Boolean);}
  function compactMode(){return (document.documentElement.dataset.aitcLayout||'')==='mobile';}

  function ensureDesktopStack(){
    let stack=$('#aitcDesktopSideStack');
    if(!stack){
      stack=document.createElement('div');stack.id='aitcDesktopSideStack';stack.className='desktop-side-stack';
      capture.insertAdjacentElement('afterend',stack);
    }
    stack.appendChild(chat);
    const fb=feedback();if(fb)stack.appendChild(fb);
    stack.appendChild(quality);
    return stack;
  }

  function installStepper(){
    if($('#aitcWorkflowStepper'))return;
    const node=document.createElement('div');
    node.id='aitcWorkflowStepper';node.className='workflow-stepper';node.setAttribute('aria-label','Quy trình thiệt chẩn');
    node.innerHTML='<div class="workflow-step" data-step="1"><b>1</b><span>Ảnh</span></div><i aria-hidden="true"></i><div class="workflow-step" data-step="2"><b>2</b><span>QC</span></div><i aria-hidden="true"></i><div class="workflow-step" data-step="3"><b>3</b><span>A.I</span></div><i aria-hidden="true"></i><div class="workflow-step" data-step="4"><b>4</b><span>Kết quả</span></div>';
    const mode=$('.mode-picker',capture);(mode||capture.firstElementChild)?.insertAdjacentElement('afterend',node);
  }
  function updateStepper(){
    const topReady=!$('#topPreview')?.hidden,bottomRequired=!$('#bottomCaptureCard')?.hidden,bottomReady=!$('#bottomPreview')?.hidden;
    const imagesReady=topReady&&(!bottomRequired||bottomReady);
    const qcReady=imagesReady&&!$('#topQcPanel')?.hidden&&(!bottomRequired||!$('#bottomQcPanel')?.hidden);
    const analyzing=$('#analyzeBtn')?.textContent?.includes('Đang phân tích'),resultReady=!result.hidden;
    const current=resultReady?4:analyzing?3:qcReady?3:imagesReady?2:1;
    $$('.workflow-step').forEach(el=>{const n=Number(el.dataset.step);el.classList.toggle('done',n<current);el.classList.toggle('active',n===current);});
  }
  function workspaceAvailable(name){return !((name==='result'||name==='symptoms')&&result.hidden);}
  function updateTaskbar(){
    const nav=$('#aitcBottomNav');if(!nav)return;
    nav.hidden=!compactMode();
    [...nav.querySelectorAll('button[data-nav]')].forEach(btn=>{
      const selected=btn.dataset.nav===activeWorkspace;
      btn.classList.toggle('active',selected);btn.setAttribute('aria-current',selected?'page':'false');
      if(btn.dataset.nav==='result'||btn.dataset.nav==='symptoms')btn.disabled=result.hidden;
    });
  }
  function showDesktop(){
    ensureDesktopStack();
    allPanels().forEach(panel=>{panel.classList.remove('aitc-workspace-hidden');panel.removeAttribute('aria-hidden');});
    updateTaskbar();
  }
  function setWorkspace(name,{focus=true,persist=true}={}){
    if(!compactMode()){showDesktop();return activeWorkspace;}
    const next=panelsFor(name).length&&workspaceAvailable(name)?name:'capture';activeWorkspace=next;
    allPanels().forEach(panel=>{
      const hidden=!panelsFor(next).includes(panel);
      panel.classList.toggle('aitc-workspace-hidden',hidden);panel.setAttribute('aria-hidden',hidden?'true':'false');
    });
    if(persist){try{sessionStorage.setItem(WORKSPACE_KEY,next);}catch{}}
    updateTaskbar();window.dispatchEvent(new CustomEvent('aitc:workspace-change',{detail:{workspace:next}}));
    if(focus)requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}));
    return next;
  }
  function installBottomNav(){
    if($('#aitcBottomNav'))return;
    const nav=document.createElement('nav');nav.id='aitcBottomNav';nav.className='aitc-bottom-nav';nav.setAttribute('aria-label','Thanh tác vụ chức năng');
    nav.innerHTML='<button type="button" data-nav="capture"><span>舌</span><small>Thiệt chẩn</small></button><button type="button" data-nav="result" disabled><span>✓</span><small>Kết quả</small></button><button type="button" data-nav="symptoms" disabled><span>✦</span><small>Đối chiếu</small></button><button type="button" data-nav="system"><span>◎</span><small>Hệ thống</small></button>';
    document.body.appendChild(nav);
    nav.addEventListener('click',ev=>{const btn=ev.target.closest('button[data-nav]');if(!btn||btn.disabled)return;setWorkspace(btn.dataset.nav);});
  }
  function installNewCaseButton(){
    if($('#newCaseBtn'))return;const health=$('#healthBadge');if(!health)return;
    const wrap=document.createElement('div');wrap.className='aitc-health-actions';health.parentElement?.replaceChild(wrap,health);wrap.appendChild(health);
    const btn=document.createElement('button');btn.id='newCaseBtn';btn.type='button';btn.className='btn ghost compact';btn.textContent='Bắt đầu ca mới';wrap.appendChild(btn);
    const style=document.createElement('style');style.textContent='.aitc-health-actions{display:grid;gap:8px;justify-items:end;align-content:start}.aitc-health-actions .btn{min-height:34px;padding:6px 10px;font-size:12px;white-space:nowrap}';document.head.appendChild(style);
    btn.addEventListener('click',()=>{try{sessionStorage.removeItem('aitc-current-session-v1');sessionStorage.removeItem('aitc-consultation-session-v4');}catch{}window.dispatchEvent(new CustomEvent('aitc:clear-session'));location.reload();});
  }
  function installClinicalContributionEntry(){
    const panel=document.querySelector('#settingsDialog .settings-panel');if(!panel||$('#aitcClinicalContributionEntry'))return;
    const group=document.createElement('div');group.id='aitcClinicalContributionEntry';group.className='settings-group';
    group.innerHTML='<strong>Đóng góp ca lâm sàng</strong><button id="aitcClinicalContributionBtn" class="btn ghost full" type="button">Bác sĩ/Y sĩ đóng góp nhãn xác nhận</button><p class="settings-note" style="margin-top:8px">Luồng độc lập, không hiển thị kết quả A.I trước khi gán nhãn.</p>';
    panel.appendChild(group);$('#aitcClinicalContributionBtn')?.addEventListener('click',()=>{location.href='/clinical-contribute-v1.html';});
  }
  const citationPattern=/\s*\[(?:TC1|DY1|MC1|AT1|PSY1)\s*,?\s*tr\.?\s*\d+\]\s*/gi;
  function cleanReferenceText(value){let text=String(value||'').replace(citationPattern,' ');const marker=text.search(/(?:^|\n)\s*(?:Nguồn đối chiếu|Tài liệu tham khảo|Tham khảo)\s*:/i);if(marker>=0)text=text.slice(0,marker);return text.replace(/[ \t]{2,}/g,' ').replace(/\n{3,}/g,'\n\n').trim();}
  function sanitizeNonChatReferences(root){if(!root)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const node of nodes){const cleaned=cleanReferenceText(node.nodeValue);if(cleaned!==node.nodeValue)node.nodeValue=cleaned;}$$('[data-source],[data-reference],.source-list,.reference-list,.citation-list',root).forEach(el=>el.remove());}
  function observeReferenceBoundary(){const targets=[result,$('#reportBox')].filter(Boolean);const observer=new MutationObserver(()=>targets.forEach(sanitizeNonChatReferences));targets.forEach(el=>observer.observe(el,{subtree:true,childList:true,characterData:true}));}
  function markEvidenceFirst(){result.classList.add('evidence-first-result');$('#theoryBox')?.classList.add('evidence-first-theory');$('#summaryText')?.closest('.summary-box')?.classList.add('evidence-summary');}
  function applyLayout(){
    ensureDesktopStack();
    if(compactMode())setWorkspace(activeWorkspace,{focus:false,persist:false});else showDesktop();
  }

  installStepper();installBottomNav();installNewCaseButton();installClinicalContributionEntry();markEvidenceFirst();observeReferenceBoundary();updateStepper();ensureDesktopStack();
  try{activeWorkspace=sessionStorage.getItem(WORKSPACE_KEY)||'capture';}catch{}
  applyLayout();

  const stateObserver=new MutationObserver(mutations=>{
    ensureDesktopStack();updateStepper();
    const resultChanged=mutations.some(m=>m.target===result&&m.type==='attributes'&&m.attributeName==='hidden');
    if(compactMode()){
      if(resultChanged&&!result.hidden)setWorkspace('result',{focus:true});
      else if(result.hidden&&(activeWorkspace==='result'||activeWorkspace==='symptoms'))setWorkspace('capture',{focus:false});
      else setWorkspace(activeWorkspace,{focus:false,persist:false});
    }else showDesktop();
  });
  ['#topPreview','#bottomPreview','#topQcPanel','#bottomQcPanel','#resultCard','#analyzeBtn','#bottomCaptureCard'].forEach(sel=>{const el=$(sel);if(el)stateObserver.observe(el,{attributes:true,attributeFilter:['hidden'],childList:true,characterData:true,subtree:true});});
  new MutationObserver(()=>{ensureDesktopStack();if(compactMode())setWorkspace(activeWorkspace,{focus:false,persist:false});}).observe(content,{childList:true});
  window.addEventListener('aitc:layout-change',applyLayout);
  document.addEventListener('change',()=>queueMicrotask(updateStepper));document.addEventListener('click',()=>setTimeout(updateStepper,0));
})();
(()=>{
  if(window.AITCPipelineContract)return;
  const version='pipeline-contract-v1';
  const layers=Object.freeze([
    Object.freeze({id:'capture-qc',order:1,runtime:'browser',authority:'input-quality',fallback:'reject-or-degrade-confidence'}),
    Object.freeze({id:'device-vision',order:2,runtime:'browser-worker',authority:'image-observation',fallback:'service-worker-signature-or-fail-closed'}),
    Object.freeze({id:'server-fusion',order:3,runtime:'server',authority:'verified-local-vision-synthesis',fallback:'fail-closed-on-unverified-visual-payload'}),
    Object.freeze({id:'learning-store',order:4,runtime:'supabase',authority:'approved-case-memory',fallback:'analysis-without-learning-retrieval'}),
    Object.freeze({id:'consultation',order:5,runtime:'server-provider',authority:'text-only-post-result-reasoning',fallback:'explicit-provider-error'})
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
      await loadScript('/book-fallback.js');
      await loadScript('/benchmark-telemetry.js');
      await loadScript('/consultation-lock.js');
      await loadScript('/admin-enhancement-collapse.js');
      if(settingsModulesReady)await settingsModulesReady;
      await loadScript('/request-integrity.js');
      window.dispatchEvent(new CustomEvent('aitc:runtime-ready',{detail:{requestIntegrity:Boolean(window.AITCRequestIntegrity),deviceRuntime:Boolean(window.AITCDeviceRuntime),pipelineContract:window.AITCPipelineContract?.version||null,pipelineLayers:window.AITCPipelineContract?.layers?.map(layer=>layer.id)||[]}}));
    }catch(err){console.warn('runtime_loader_failed',err?.message||err);}
  })();
})();
