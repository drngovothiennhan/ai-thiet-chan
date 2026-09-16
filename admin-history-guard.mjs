import express from 'express';

const SUPABASE_URL=process.env.SUPABASE_URL||'https://gzmpnsrwqjpsbklyflqr.supabase.co';
const SUPABASE_KEY=process.env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_Y4hMhXROZ-aVgWoaQ5fFKQ_ZAcXuIzG';
const originalGet=express.application.get;

async function verifyAdminToken(token){
  if(!token)return false;
  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/ai_thiet_chan_admin_verify_v1`,{
      method:'POST',
      headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'authorization':`Bearer ${SUPABASE_KEY}`},
      body:JSON.stringify({p_admin_token:token})
    });
    return response.ok;
  }catch{return false;}
}

express.application.get=function(path,...handlers){
  if(path==='/api/cases'&&handlers.length){
    const adminGate=async(req,res,next)=>{
      const token=String(req.headers['x-admin-token']||'').trim();
      if(!(await verifyAdminToken(token))) return res.status(403).json({error:'ADMIN_REQUIRED'});
      return next();
    };
    return originalGet.call(this,path,adminGate,...handlers);
  }
  return originalGet.call(this,path,...handlers);
};
