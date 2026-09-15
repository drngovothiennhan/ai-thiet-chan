(()=>{
  const SUPABASE_URL='https://gzmpnsrwqjpsbklyflqr.supabase.co';
  const SUPABASE_KEY='sb_publishable_Y4hMhXROZ-aVgWoaQ5fFKQ_ZAcXuIzG';
  const TOKEN_KEY='aitcClinicalAdminToken';
  const USER_KEY='aitcAdminUsername';
  const $=id=>document.getElementById(id);
  let pendingUsername='';
  let pendingPassword='';

  async function rpc(name,payload){
    const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'authorization':`Bearer ${SUPABASE_KEY}`},body:JSON.stringify(payload)});
    const d=await r.json().catch(()=>null);
    if(!r.ok) throw new Error(d?.message||d?.hint||d?.error||`HTTP ${r.status}`);
    return d;
  }
  function setStatus(text,kind=''){
    const n=$('adminCenterStatus');if(!n)return;
    n.hidden=false;n.textContent=text;n.className=`admin-center-status ${kind}`.trim();
  }
  function showLogin(){
    if($('adminCredentialChange'))$('adminCredentialChange').hidden=true;
    if($('adminCredentialLogin'))$('adminCredentialLogin').hidden=false;
    if($('adminDashboard'))$('adminDashboard').hidden=true;
  }
  function showDashboard(username,password){
    sessionStorage.setItem(USER_KEY,username);
    sessionStorage.setItem(TOKEN_KEY,password);
    pendingUsername='';pendingPassword='';
    if($('adminCredentialChange'))$('adminCredentialChange').hidden=true;
    if($('adminLoginView'))$('adminLoginView').hidden=true;
    if($('adminDashboard'))$('adminDashboard').hidden=false;
    queueMicrotask(()=>$('adminRefreshBtn')?.click());
  }
  async function login(){
    const username=$('adminCenterUsername')?.value.trim()||'';
    const password=$('adminCenterPassword')?.value||'';
    if(!username||!password){setStatus('Nhập tài khoản và mật khẩu.','warn');return;}
    const btn=$('adminCenterLoginBtn');if(btn)btn.disabled=true;
    setStatus('Đang xác thực…');
    try{
      const info=await rpc('ai_thiet_chan_admin_login_v1',{p_username:username,p_password:password});
      if(info?.mustChangePassword){
        pendingUsername=String(info.username||username);pendingPassword=password;
        $('adminCredentialLogin').hidden=true;$('adminCredentialChange').hidden=false;
        $('adminNewUsername').value=pendingUsername;
        $('adminNewPassword').value='';$('adminNewPasswordConfirm').value='';
        setStatus('Đăng nhập thành công. Đây là tài khoản mặc định; bắt buộc đổi tài khoản/mật khẩu trước khi vào Admin Center.','warn');
        $('adminNewUsername')?.focus();
      }else{
        setStatus('Đăng nhập thành công.','good');
        showDashboard(String(info.username||username),password);
      }
    }catch(err){
      sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(USER_KEY);
      setStatus(String(err.message).includes('unauthorized')?'Tài khoản hoặc mật khẩu không đúng.':'Không đăng nhập được: '+err.message,'warn');
    }finally{if(btn)btn.disabled=false;}
  }
  async function changeCredentials(){
    const newUsername=$('adminNewUsername')?.value.trim()||'';
    const newPassword=$('adminNewPassword')?.value||'';
    const confirmPassword=$('adminNewPasswordConfirm')?.value||'';
    if(newUsername.length<3){setStatus('Tài khoản mới phải có ít nhất 3 ký tự.','warn');return;}
    if(newPassword.length<12){setStatus('Mật khẩu mới phải có ít nhất 12 ký tự.','warn');return;}
    if(newPassword!==confirmPassword){setStatus('Xác nhận mật khẩu không khớp.','warn');return;}
    const btn=$('adminChangeCredentialsBtn');if(btn)btn.disabled=true;
    setStatus('Đang đổi thông tin quản trị…');
    try{
      const info=await rpc('ai_thiet_chan_admin_change_credentials_v1',{p_username:pendingUsername,p_password:pendingPassword,p_new_username:newUsername,p_new_password:newPassword});
      setStatus('Đã đổi tài khoản và mật khẩu. Admin Center đã được mở.','good');
      showDashboard(String(info.username||newUsername),newPassword);
    }catch(err){setStatus('Không đổi được thông tin quản trị: '+err.message,'warn');}
    finally{if(btn)btn.disabled=false;}
  }
  function enhance(){
    const view=$('adminLoginView');if(!view||view.dataset.credentialsV1==='true')return;
    view.dataset.credentialsV1='true';
    view.innerHTML=`
      <div id="adminCredentialLogin" class="admin-credential-form">
        <label>Tài khoản<input id="adminCenterUsername" type="text" autocomplete="username" value="${sessionStorage.getItem(USER_KEY)||'admin'}" placeholder="Tài khoản admin" /></label>
        <label>Mật khẩu<input id="adminCenterPassword" type="password" autocomplete="current-password" placeholder="Mật khẩu admin" /></label>
        <button id="adminCenterLoginBtn" class="btn primary full" type="button">Đăng nhập</button>
      </div>
      <div id="adminCredentialChange" class="admin-credential-form" hidden>
        <strong>Đổi thông tin quản trị lần đầu</strong>
        <label>Tài khoản mới<input id="adminNewUsername" type="text" autocomplete="username" maxlength="64" /></label>
        <label>Mật khẩu mới<input id="adminNewPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" /></label>
        <label>Nhập lại mật khẩu<input id="adminNewPasswordConfirm" type="password" autocomplete="new-password" minlength="12" maxlength="128" /></label>
        <button id="adminChangeCredentialsBtn" class="btn primary full" type="button">Lưu và vào Admin Center</button>
      </div>
      <div id="adminCenterStatus" class="admin-center-status" hidden></div>`;
    $('adminCenterLoginBtn')?.addEventListener('click',login);
    $('adminCenterPassword')?.addEventListener('keydown',e=>{if(e.key==='Enter')login();});
    $('adminChangeCredentialsBtn')?.addEventListener('click',changeCredentials);
    $('adminNewPasswordConfirm')?.addEventListener('keydown',e=>{if(e.key==='Enter')changeCredentials();});
    $('adminLogoutBtn')?.addEventListener('click',()=>{sessionStorage.removeItem(USER_KEY);pendingUsername='';pendingPassword='';queueMicrotask(showLogin);},{capture:true});
  }

  enhance();
  new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});
})();
