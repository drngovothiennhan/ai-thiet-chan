const nativeFetch=globalThis.fetch?.bind(globalThis);

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const GEMINI_FALLBACK_MODELS=['gemini-2.5-flash','gemini-2.5-flash-lite'];

function requestUrl(input){
  return typeof input==='string'?input:input?.url||String(input||'');
}
function replaceGeminiModel(url,model){
  return url.replace(/\/models\/[^/:]+:generateContent(?=\?|$)/,`/models/${encodeURIComponent(model)}:generateContent`);
}
function isGeminiGenerate(url){
  return url.includes('generativelanguage.googleapis.com')&&url.includes(':generateContent');
}
async function isTransientGeminiFailure(response){
  if(!response) return true;
  if(response.status===429||response.status===500||response.status===502||response.status===503||response.status===504) return true;
  if(response.ok) return false;
  try{
    const text=await response.clone().text();
    return /high demand|temporar|unavailable|resource[_ ]?exhausted|try again|overload/i.test(text);
  }catch{return false;}
}
async function timedFetch(input,init,url){
  const timeoutMs=url.includes('generativelanguage.googleapis.com')?45_000:url.includes('.supabase.co')?15_000:0;
  if(!timeoutMs||init?.signal) return nativeFetch(input,init);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await nativeFetch(input,{...init,signal:controller.signal});}
  catch(err){
    if(err?.name==='AbortError'){
      const timeoutError=new Error('UPSTREAM_TIMEOUT');
      timeoutError.status=504;
      throw timeoutError;
    }
    throw err;
  }finally{clearTimeout(timer);}
}
async function geminiResilientFetch(input,init,url){
  const candidates=[url,url,...GEMINI_FALLBACK_MODELS.map(model=>replaceGeminiModel(url,model))];
  const delays=[0,650,1250,0];
  let lastResponse=null;
  let lastError=null;
  for(let i=0;i<candidates.length;i++){
    if(delays[i]) await sleep(delays[i]);
    const candidate=candidates[i];
    try{
      const response=await timedFetch(candidate,init,candidate);
      lastResponse=response;
      if(response.ok) return response;
      if(!(await isTransientGeminiFailure(response))) return response;
      console.warn('gemini_transient_failure',JSON.stringify({attempt:i+1,status:response.status,model:(candidate.match(/\/models\/([^/:]+):generateContent/)||[])[1]||'unknown'}));
    }catch(err){
      lastError=err;
      console.warn('gemini_transport_failure',JSON.stringify({attempt:i+1,error:err?.message||String(err)}));
    }
  }
  if(lastResponse){
    return new Response(JSON.stringify({error:{code:503,status:'UNAVAILABLE',message:'Dịch vụ A.I đang bận tạm thời. Hệ thống đã thử các model dự phòng nhưng chưa nhận được phản hồi. Vui lòng thử lại sau ít giây.'}}),{status:503,headers:{'content-type':'application/json'}});
  }
  const err=new Error('AI_UPSTREAM_TEMPORARILY_UNAVAILABLE');
  err.status=503;
  err.cause=lastError;
  throw err;
}

if(nativeFetch){
  globalThis.fetch=async(input,init={})=>{
    const url=requestUrl(input);
    if(isGeminiGenerate(url)) return geminiResilientFetch(input,init,url);
    return timedFetch(input,init,url);
  };
}
