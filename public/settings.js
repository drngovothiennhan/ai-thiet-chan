(()=>{
  const STORAGE_KEY='aiThietChanDefaultMode';
  const dialog=document.getElementById('settingsDialog');
  const openBtn=document.getElementById('settingsBtn');
  const closeBtn=document.getElementById('settingsCloseBtn');
  const normalSetting=document.getElementById('settingsNormalMode');
  const generalSetting=document.getElementById('settingsGeneralMode');
  const normalMode=document.getElementById('normalModeBtn');
  const generalMode=document.getElementById('generalModeBtn');
  const aiState=document.getElementById('settingsAiState');
  const storeState=document.getElementById('settingsStoreState');
  const versionState=document.getElementById('settingsVersion');
  const panel=dialog?.querySelector('.settings-panel');
  let deferredInstallPrompt=null;
  if(!dialog||!openBtn||!normalSetting||!generalSetting) return;

  function isStandalone(){
    return Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone===true);
  }
  function isIos(){return /iPad|iPhone|iPod/.test(navigator.userAgent||'')&&!window.MSStream;}
  function isAndroid(){return /Android/i.test(navigator.userAgent||'');}
  function installFallbackText(){
    if(isIos()) return 'Trên iPhone/iPad: mở nút Chia sẻ của Safari → “Thêm vào Màn hình chính”.';
    if(isAndroid()) return 'Nếu hộp cài đặt chưa xuất hiện: mở menu ⋮ của Chrome → “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”.';
    return 'Nếu trình duyệt chưa hiện hộp cài đặt: mở menu của Chrome/Edge → “Cài đặt A.I Thiệt Chẩn”.';
  }
  function ensureInstallUi(){
    if(!panel||document.getElementById('pwaInstallBtn')) return;
    const group=document.createElement('div');
    group.className='settings-group';
    group.id='pwaInstallGroup';
    group.innerHTML='<strong>Cài đặt ứng dụng trên thiết bị</strong><button id="pwaInstallBtn" class="btn primary full" type="button">Cài đặt A.I Thiệt Chẩn</button><p id="pwaInstallStatus" class="settings-note" style="margin-top:8px">Cài app để mở nhanh như ứng dụng độc lập trên điện thoại hoặc máy tính.</p>';
    const meta=panel.querySelector('.settings-meta');
    if(meta) panel.insertBefore(group,meta); else panel.appendChild(group);
    document.getElementById('pwaInstallBtn')?.addEventListener('click',installApp);
    updateInstallUi();
  }
  function updateInstallUi(message=''){
    const btn=document.getElementById('pwaInstallBtn');
    const status=document.getElementById('pwaInstallStatus');
    if(!btn||!status) return;
    if(isStandalone()){
      btn.textContent='Đã cài đặt';
      btn.disabled=true;
      status.textContent='A.I Thiệt Chẩn đang chạy ở chế độ ứng dụng độc lập.';
      return;
    }
    btn.disabled=false;
    btn.textContent=deferredInstallPrompt?'Cài đặt ngay':'Cài đặt A.I Thiệt Chẩn';
    status.textContent=message||(deferredInstallPrompt?'Thiết bị đã sẵn sàng. Nhấn “Cài đặt ngay” để xác nhận.':'Nhấn để cài ứng dụng. '+installFallbackText());
  }
  async function installApp(){
    if(isStandalone()){updateInstallUi();return;}
    if(deferredInstallPrompt){
      const prompt=deferredInstallPrompt;
      deferredInstallPrompt=null;
      try{
        await prompt.prompt();
        const choice=await prompt.userChoice;
        updateInstallUi(choice?.outcome==='accepted'?'Đã xác nhận cài đặt. Ứng dụng sẽ xuất hiện trên thiết bị.':'Bạn đã hủy cài đặt. Có thể thử lại từ menu trình duyệt.');
      }catch{updateInstallUi(installFallbackText());}
      return;
    }
    updateInstallUi(installFallbackText());
  }

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredInstallPrompt=event;
    ensureInstallUi();
    updateInstallUi();
  });
  window.addEventListener('appinstalled',()=>{
    deferredInstallPrompt=null;
    updateInstallUi('Đã cài A.I Thiệt Chẩn thành công.');
  });

  function readMode(){
    try{return localStorage.getItem(STORAGE_KEY)==='general'?'general':'normal';}catch{return 'normal';}
  }
  function saveMode(mode){try{localStorage.setItem(STORAGE_KEY,mode);}catch{}}
  function paint(mode){
    normalSetting.classList.toggle('active',mode==='normal');
    generalSetting.classList.toggle('active',mode==='general');
    normalSetting.setAttribute('aria-pressed',String(mode==='normal'));
    generalSetting.setAttribute('aria-pressed',String(mode==='general'));
  }
  function applyMode(mode){
    saveMode(mode);paint(mode);
    const target=mode==='general'?generalMode:normalMode;
    if(target&&!target.classList.contains('active')) target.click();
  }
  async function refreshStatus(){
    try{
      const r=await fetch('/api/health',{cache:'no-store'});const d=await r.json();
      if(!r.ok||!d.ok) throw new Error('health');
      if(aiState) aiState.textContent=d.providerConfigured?'Gemini máy chủ · sẵn sàng':'Chưa cấu hình';
      if(storeState) storeState.textContent=d.caseCollection?.storeReady?'Tự động · sẵn sàng':'Đang kết nối';
      if(versionState) versionState.textContent=d.version||'—';
    }catch{
      if(aiState) aiState.textContent='Không kiểm tra được';
      if(storeState) storeState.textContent='Không kiểm tra được';
    }
  }
  function open(){paint(readMode());ensureInstallUi();updateInstallUi();refreshStatus();if(typeof dialog.showModal==='function') dialog.showModal();else dialog.setAttribute('open','');}
  function close(){if(typeof dialog.close==='function') dialog.close();else dialog.removeAttribute('open');}

  openBtn.addEventListener('click',open);
  closeBtn?.addEventListener('click',close);
  normalSetting.addEventListener('click',()=>applyMode('normal'));
  generalSetting.addEventListener('click',()=>applyMode('general'));
  dialog.addEventListener('click',e=>{if(e.target===dialog) close();});
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});

  ensureInstallUi();
  const initial=readMode();paint(initial);
  queueMicrotask(()=>applyMode(initial));
})();

(()=>{
  if(document.querySelector('script[data-rear-torch]')) return;
  const script=document.createElement('script');
  script.src='/torch.js';script.async=false;script.dataset.rearTorch='true';
  document.head.appendChild(script);
})();
