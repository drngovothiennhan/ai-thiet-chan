// Production access policy: guest 5 analyses/day; approved students unlimited.
(()=>{
  const TOKEN_KEY='aitcStudentSessionV1';
  const $=id=>document.getElementById(id);
  const nativeFetch=window.fetch.bind(window);
  const state={access:null};

  function token(){try{return localStorage.getItem(TOKEN_KEY)||'';}catch{return '';}}
  function setToken(value){try{if(value)localStorage.setItem(TOKEN_KEY,value);else localStorage.removeItem(TOKEN_KEY);}catch{}}
  function apiPath(input){
    try{
      const raw=typeof input==='string'?input:input?.url||'';
      const url=new URL(raw,location.href);
      return url.origin===location.origin&&url.pathname.startsWith('/api/')?url.pathname:'';
    }catch{return '';}
  }
  window.fetch=(input,init={})=>{
    const path=apiPath(input),t=token();
    if(!path)return nativeFetch(input,init);
    const headers=new Headers(init.headers||(input instanceof Request?input.headers:undefined));
    if(t&&!headers.has('authorization'))headers.set('authorization',`Bearer ${t}`);
    return nativeFetch(input,{...init,headers}).then(response=>{
      if(path==='/api/analyze')setTimeout(()=>refresh(),0);
      return response;
    });
  };

  function ensureUi(){
    const actions=document.querySelector('.topbar-actions');
    if(actions&&!$('accessBtn')){
      const btn=document.createElement('button');btn.id='accessBtn';btn.className='icon-btn';btn.type='button';btn.textContent='Khách · còn 5/5';btn.setAttribute('aria-label','Tài khoản sinh viên');
      actions.insertBefore(btn,actions.firstChild);btn.addEventListener('click',openDialog);
    }
    if(!$('accessDialog')){
      const dialog=document.createElement('dialog');dialog.id='accessDialog';dialog.className='settings-dialog';
      dialog.innerHTML=`<div class="settings-panel access-panel">
        <div class="settings-head"><div><h2>Tài khoản sử dụng</h2><p>Khách có 5 lượt thiệt chẩn/ngày. Sinh viên đã được admin duyệt sử dụng không giới hạn.</p></div><button id="accessCloseBtn" class="settings-close" type="button">×</button></div>
        <div id="accessGuestView">
          <div class="access-quota"><strong id="accessQuotaText">Đang kiểm tra…</strong><span>Lượt thiệt chẩn còn lại hôm nay</span></div>
          <form id="studentLoginForm" class="access-form">
            <label>MSSV<input id="studentMssv" autocomplete="username" required /></label>
            <label>Mật khẩu<input id="studentPassword" type="password" autocomplete="current-password" required /></label>
            <button class="btn primary full" type="submit">Đăng nhập sinh viên</button>
          </form>
          <p class="settings-note">Mật khẩu lần đầu là chính MSSV đã được admin nạp từ danh sách Excel.</p>
        </div>
        <div id="accessStudentView" hidden>
          <div class="access-student-card"><strong id="accessStudentName">—</strong><span id="accessStudentMeta">—</span><b>Không giới hạn tính năng</b></div>
          <form id="studentPasswordForm" class="access-form">
            <strong>Đổi mật khẩu</strong>
            <label>Mật khẩu hiện tại<input id="studentCurrentPassword" type="password" autocomplete="current-password" required /></label>
            <label>Mật khẩu mới<input id="studentNewPassword" type="password" minlength="6" autocomplete="new-password" required /></label>
            <button class="btn primary full" type="submit">Đổi mật khẩu</button>
          </form>
          <button id="studentLogoutBtn" class="btn ghost full" type="button">Đăng xuất</button>
        </div>
        <div id="accessMessage" class="admin-center-status" hidden></div>
      </div>`;
      document.body.appendChild(dialog);
      $('accessCloseBtn')?.addEventListener('click',()=>dialog.close());
      $('studentLoginForm')?.addEventListener('submit',login);
      $('studentPasswordForm')?.addEventListener('submit',changePassword);
      $('studentLogoutBtn')?.addEventListener('click',logout);
      dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close();});
      dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
      const style=document.createElement('style');style.textContent=`
        #accessBtn{min-width:max-content}.access-panel{max-width:520px}.access-quota{display:grid;gap:4px;padding:14px;border-radius:14px;background:var(--surface-soft,#f1f7f6);margin-bottom:14px}.access-quota strong{font-size:1.35rem}.access-quota span{font-size:.85rem;opacity:.75}.access-form{display:grid;gap:12px}.access-form label{display:grid;gap:6px;font-weight:600}.access-form input{width:100%;box-sizing:border-box;border:1px solid #cfdad8;border-radius:12px;padding:12px;background:#fff;color:#183532}.access-student-card{display:grid;gap:5px;padding:14px;border-radius:14px;background:#eef8f4;margin-bottom:14px}.access-student-card b{color:#0b6b64}.access-panel .full{width:100%}`;document.head.appendChild(style);
    }
  }
  function message(text,kind=''){
    const el=$('accessMessage');if(!el)return;el.hidden=!text;el.textContent=text||'';el.className=`admin-center-status ${kind}`.trim();
  }
  function paint(data){
    state.access=data||{role:'guest',limit:5};
    const student=data?.role==='student',btn=$('accessBtn');
    const limit=Number.isFinite(Number(data?.limit))?Number(data.limit):5;
    const remaining=Number.isFinite(Number(data?.remaining))?Number(data.remaining):null;
    if(btn)btn.textContent=student?`SV · ${data.student?.mssv||''}`:(remaining===null?'Khách':`Khách · còn ${remaining}/${limit}`);
    if($('accessGuestView'))$('accessGuestView').hidden=student;
    if($('accessStudentView'))$('accessStudentView').hidden=!student;
    if(student){
      $('accessStudentName').textContent=data.student?.fullName||data.student?.mssv||'Sinh viên';
      $('accessStudentMeta').textContent=[data.student?.mssv,data.student?.faculty,data.student?.className].filter(Boolean).join(' · ');
      if(data.student?.mustChangePassword)message('Đây là mật khẩu lần đầu. Bạn nên đổi mật khẩu sau khi đăng nhập.','warn');
      else message('', '');
    }else{
      if($('accessQuotaText'))$('accessQuotaText').textContent=remaining===null?'Chưa xác định':`${remaining}/${limit}`;
      message('', '');
    }
    window.dispatchEvent(new CustomEvent('aitc:access',{detail:data}));
  }
  async function refresh(){
    ensureUi();
    try{
      const response=await nativeFetch('/api/access/status',{cache:'no-store',headers:token()?{'authorization':`Bearer ${token()}`}:{}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data?.message||data?.error||`HTTP ${response.status}`);
      if(data?.role!=='student'&&token())setToken('');
      paint(data);
    }catch{
      if(!state.access)paint({role:'guest',limit:5});
      message('Chưa cập nhật được lượt sử dụng.','warn');
    }
  }
  async function login(event){
    event.preventDefault();message('Đang đăng nhập…');
    const button=event.currentTarget.querySelector('button');button.disabled=true;
    try{
      const response=await nativeFetch('/api/access/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mssv:$('studentMssv').value.trim(),password:$('studentPassword').value})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data?.message||'Đăng nhập thất bại.');
      setToken(data.token||'');$('studentPassword').value='';await refresh();message('Đăng nhập thành công.','good');
    }catch(err){message(err.message,'warn');}finally{button.disabled=false;}
  }
  async function logout(){
    try{await nativeFetch('/api/access/logout',{method:'POST',headers:token()?{'authorization':`Bearer ${token()}`}:{}});}catch{}
    setToken('');await refresh();message('Đã đăng xuất.','good');
  }
  async function changePassword(event){
    event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;message('Đang đổi mật khẩu…');
    try{
      const response=await nativeFetch('/api/access/change-password',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${token()}`},body:JSON.stringify({currentPassword:$('studentCurrentPassword').value,newPassword:$('studentNewPassword').value})});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.message||'Không đổi được mật khẩu.');
      $('studentCurrentPassword').value='';$('studentNewPassword').value='';await refresh();message('Đã đổi mật khẩu.','good');
    }catch(err){message(err.message,'warn');}finally{button.disabled=false;}
  }
  function openDialog(){ensureUi();refresh();const dialog=$('accessDialog');if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}

  ensureUi();refresh();
  window.addEventListener('aitc:access-refresh',refresh);
  window.AITCAccess={refresh,open:openDialog};
})();