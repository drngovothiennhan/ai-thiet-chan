(()=>{
  'use strict';
  const nativeFetch=window.fetch.bind(window);

  function deviceClass(){
    const ua=navigator.userAgent||'';
    if(/Android/i.test(ua)) return 'android';
    if(/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if(/Windows/i.test(ua)) return 'windows';
    if(/Macintosh|Mac OS X/i.test(ua)) return 'macos';
    if(/Linux/i.test(ua)) return 'linux';
    return 'other';
  }
  function viewportClass(){
    const w=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0);
    return w<600?'mobile':w<1024?'tablet':'desktop';
  }
  function captureContext(){
    return {
      schemaVersion:'capture-context-v1',
      deviceClass:deviceClass(),
      viewportClass:viewportClass(),
      cameraApi:Boolean(navigator.mediaDevices?.getUserMedia),
      standalone:Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone===true)
    };
  }
  async function normalizeVisionFailure(response){
    if(response.status!==502) return response;
    const data=await response.clone().json().catch(()=>null);
    if(!String(data?.message||'').includes('VISION_ANALYSIS_TEMPORARILY_UNAVAILABLE')) return response;
    return new Response(JSON.stringify({
      error:'ANALYZE_FAILED',
      message:'A.I thị giác đang tạm quá tải. Hệ thống không tạo kết quả thay thế khi chưa phân tích được ảnh; vui lòng thử lại sau ít phút.',
      visionStatus:'unavailable'
    }),{status:502,headers:{'content-type':'application/json','cache-control':'no-store','x-ai-vision-status':'unavailable'}});
  }

  window.fetch=async(input,init={})=>{
    try{
      const url=typeof input==='string'?input:input?.url||'';
      if(url.includes('/api/analyze')&&String(init?.method||'GET').toUpperCase()==='POST'&&typeof init?.body==='string'){
        const body=JSON.parse(init.body);
        const meta=captureContext();
        body.topQc={...(body.topQc||body.qc||{}),captureContext:meta};
        if(body.mode==='general') body.bottomQc={...(body.bottomQc||{}),captureContext:meta};
        const response=await nativeFetch(input,{...init,body:JSON.stringify(body)});
        return normalizeVisionFailure(response);
      }
    }catch{}
    return nativeFetch(input,init);
  };
})();
