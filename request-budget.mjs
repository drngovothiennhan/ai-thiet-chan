// Per-process admission before parsing large image JSON; no unbounded queue.
export function aiAdmission(limit=4){
  let active=0;
  return (req,res,next)=>{
    if(req.method!=='POST'||!['/api/analyze','/api/chat','/api/report'].includes(req.path))return next();
    if(active>=limit){res.setHeader('Retry-After','3');return res.status(503).json({error:'AI_BUSY',message:'Hệ thống đang xử lý nhiều ca. Vui lòng thử lại sau ít giây.'});}
    active++;
    const controller=new AbortController();req.aiSignal=controller.signal;
    let released=false;
    const release=()=>{if(released)return;released=true;active--;clearTimeout(timer);controller.abort();};
    const timer=setTimeout(()=>{
      controller.abort(Object.assign(new Error('REQUEST_TIMEOUT'),{status:504}));
      if(!res.headersSent)res.status(504).json({error:'REQUEST_TIMEOUT'});
      else res.destroy();
    },45000);
    res.once('finish',release);res.once('close',release);
    next();
  };
}
