import { createHash } from 'node:crypto';

function bearerToken(req){
  const value=String(req.headers?.authorization||'').trim();
  return value.toLowerCase().startsWith('bearer ')?value.slice(7).trim():'';
}
function adminToken(req){
  return String(req.headers?.['x-aitc-admin-token']||'').trim().slice(0,256);
}

export function installAccessControl(app,{supabaseUrl,supabaseKey,requestIdentity}){
  if(!app||!supabaseUrl||!supabaseKey||typeof requestIdentity!=='function') throw new Error('ACCESS_CONTROL_CONFIG_INVALID');

  async function rpc(name,payload){
    const response=await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`,{
      method:'POST',
      headers:{'content-type':'application/json','apikey':supabaseKey,'authorization':`Bearer ${supabaseKey}`},
      body:JSON.stringify(payload||{})
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok){
      const error=new Error(data?.message||data?.hint||data?.error||`Access store HTTP ${response.status}`);
      error.status=response.status;
      throw error;
    }
    return data;
  }

  function guestKey(req){
    const ip=requestIdentity(req);
    const ua=String(req.headers?.['user-agent']||'').slice(0,256);
    const accept=String(req.headers?.accept||'').slice(0,96);
    return createHash('sha256').update(`aitc-guest-v1|${ip}|${ua}|${accept}`).digest('hex');
  }

  async function resolveAdmin(req){
    const token=adminToken(req);
    if(!token){req.adminAccess=null;return null;}
    try{
      await rpc('ai_thiet_chan_admin_verify_v1',{p_admin_token:token});
      req.adminAccess={role:'admin',unlimited:true};
      req.studentAccess={role:'student',unlimited:true,adminBridge:true};
      return req.adminAccess;
    }catch{
      req.adminAccess=null;
      return null;
    }
  }

  async function resolveStudent(req){
    if(req.adminAccess){return null;}
    const token=bearerToken(req);
    if(!token){req.studentAccess=null;return null;}
    try{
      const data=await rpc('ai_thiet_chan_student_verify_v1',{p_token:token});
      req.studentAccess=data?.role==='student'?data:null;
      return req.studentAccess;
    }catch{
      req.studentAccess=null;
      return null;
    }
  }

  async function consumeCaseAccess(req){
    if(req.adminAccess?.role==='admin') return {ok:true,role:'admin',unlimited:true};
    if(req.studentAccess?.role==='student') return {ok:true,role:'student',unlimited:true};
    const quota=await rpc('ai_thiet_chan_guest_consume_v1',{p_guest_key:guestKey(req)});
    if(!quota?.ok){
      const error=new Error('Khách đã dùng đủ 5 lượt thiệt chẩn hôm nay. Đăng nhập sinh viên để sử dụng không giới hạn.');
      error.status=429;
      error.code='GUEST_DAILY_LIMIT';
      error.quota=quota;
      throw error;
    }
    return quota;
  }

  app.use(async(req,res,next)=>{
    if(!req.path.startsWith('/api/')) return next();
    try{
      await resolveAdmin(req);
      if(!req.adminAccess) await resolveStudent(req);
      if(req.method==='POST'&&req.path==='/api/cases/collect-local'&&String(req.headers?.['x-aitc-local-primary']||'')==='1'){
        try{
          req.localPrimaryAccess=await consumeCaseAccess(req);
        }catch(err){
          const status=err?.status===429?429:503;
          return res.status(status).json({error:err?.code||'ACCESS_CONSUME_FAILED',message:err?.message||'Chưa xác nhận được lượt sử dụng.',quota:err?.quota||null});
        }
      }
      next();
    }catch(err){console.error('access_context_error',err?.message||err);next();}
  });

  app.get('/api/access/status',async(req,res)=>{
    try{
      if(req.adminAccess?.role==='admin') return res.json({role:'admin',unlimited:true});
      if(req.studentAccess?.role==='student') return res.json(req.studentAccess);
      const quota=await rpc('ai_thiet_chan_guest_status_v1',{p_guest_key:guestKey(req)});
      return res.json(quota);
    }catch(err){
      console.error('access_status_error',err?.message||err);
      return res.status(503).json({error:'ACCESS_STATUS_UNAVAILABLE',message:'Chưa kiểm tra được quyền sử dụng.'});
    }
  });

  app.post('/api/access/login',async(req,res)=>{
    const mssv=String(req.body?.mssv||'').trim();
    const password=String(req.body?.password||'');
    if(!mssv||!password) return res.status(400).json({error:'CREDENTIALS_REQUIRED',message:'Nhập MSSV và mật khẩu.'});
    try{
      const data=await rpc('ai_thiet_chan_student_login_v1',{p_mssv:mssv,p_password:password});
      return res.json(data);
    }catch(err){
      console.error('student_login_error',err?.message||err);
      return res.status(401).json({error:'LOGIN_FAILED',message:'MSSV hoặc mật khẩu không đúng, hoặc tài khoản chưa được duyệt.'});
    }
  });

  app.post('/api/access/logout',async(req,res)=>{
    const token=bearerToken(req);
    if(!token) return res.json({ok:true});
    try{await rpc('ai_thiet_chan_student_logout_v1',{p_token:token});return res.json({ok:true});}
    catch{return res.json({ok:true});}
  });

  app.post('/api/access/change-password',async(req,res)=>{
    const token=bearerToken(req);
    if(!token) return res.status(401).json({error:'LOGIN_REQUIRED',message:'Vui lòng đăng nhập sinh viên.'});
    const currentPassword=String(req.body?.currentPassword||'');
    const newPassword=String(req.body?.newPassword||'');
    if(!currentPassword||newPassword.length<6) return res.status(400).json({error:'PASSWORD_INVALID',message:'Mật khẩu mới phải có ít nhất 6 ký tự.'});
    try{
      const data=await rpc('ai_thiet_chan_student_change_password_v1',{p_token:token,p_current_password:currentPassword,p_new_password:newPassword});
      return res.json(data);
    }catch(err){
      console.error('student_password_error',err?.message||err);
      return res.status(400).json({error:'PASSWORD_CHANGE_FAILED',message:'Không đổi được mật khẩu. Kiểm tra mật khẩu hiện tại.'});
    }
  });

  return {consumeCaseAccess,resolveStudent,resolveAdmin};
}
