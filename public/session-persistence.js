(()=>{
  const KEY='aitc-current-session-v1';
  const MAX_AGE_MS=12*60*60*1000;
  const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');
  const rawFetch=(input,init)=>requestClient.fetchAfter('session-persistence',input,init);
  let restoring=false;
  let cached=null;

  function read(){
    try{
      const data=JSON.parse(sessionStorage.getItem(KEY)||'null');
      if(!data||!data.savedAt||Date.now()-data.savedAt>MAX_AGE_MS){sessionStorage.removeItem(KEY);return null;}
      return data;
    }catch{return null;}
  }
  function write(patch){
    try{
      const current=read()||{};
      sessionStorage.setItem(KEY,JSON.stringify({...current,...patch,savedAt:Date.now()}));
    }catch{}
  }
  function responseFrom(data){
    return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json','cache-control':'no-store','x-aitc-session-restore':'1'}});
  }
  function restorePreview(body={}){
    const top=document.getElementById('topPreview'),topEmpty=document.getElementById('topEmpty');
    if(top&&body.topImage){top.src=body.topImage;top.hidden=false;if(topEmpty)topEmpty.hidden=true;}
    const bottom=document.getElementById('bottomPreview'),bottomEmpty=document.getElementById('bottomEmpty'),bottomCard=document.getElementById('bottomCaptureCard');
    if(body.mode==='general'&&bottomCard)bottomCard.hidden=false;
    if(bottom&&body.bottomImage){bottom.src=body.bottomImage;bottom.hidden=false;if(bottomEmpty)bottomEmpty.hidden=true;}
  }

  const __aitcStage3bFetch=async(input,init={})=>{
    const url=typeof input==='string'?input:input?.url||'';
    const method=String(init?.method||'GET').toUpperCase();
    if(url.includes('/api/analyze')&&method==='POST'){
      if(restoring&&cached?.analysisResponse) return responseFrom(cached.analysisResponse);
      const response=await rawFetch(input,init);
      if(response.ok){
        try{
          const body=typeof init.body==='string'?JSON.parse(init.body):{};
          const data=await response.clone().json();
          if(data?.assessment||data?.analysis) write({analysisRequest:body,analysisResponse:data});
        }catch{}
      }
      return response;
    }
    return rawFetch(input,init);
  };
  requestClient.register('session-persistence',__aitcStage3bFetch,700);

  async function restore(){
    cached=read();
    if(!cached?.analysisResponse||!cached?.analysisRequest) return;
    const body=cached.analysisRequest;
    const mode=body.mode==='general'?'general':'normal';
    const modeBtn=document.getElementById(mode==='general'?'generalModeBtn':'normalModeBtn');
    modeBtn?.click();
    restorePreview(body);
    const analyzeBtn=document.getElementById('analyzeBtn');
    if(!analyzeBtn) return;
    window.__aitcRestoringSession=true;
    restoring=true;
    analyzeBtn.disabled=false;
    analyzeBtn.click();
    const started=Date.now();
    while(Date.now()-started<2500){
      const result=document.getElementById('resultCard');
      if(result&&!result.hidden) break;
      await new Promise(r=>setTimeout(r,50));
    }
    restoring=false;
    window.__aitcRestoringSession=false;
  }

  window.addEventListener('aitc:clear-session',()=>{try{sessionStorage.removeItem(KEY);}catch{}});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(restore,0),{once:true});
  else setTimeout(restore,0);
})();
