const upstreamFetch=globalThis.fetch?.bind(globalThis);

const PRIMARY_MODEL='gemini-3.8-flash';
const FALLBACK_MODEL='gemini-3.6-flash';
const FALLBACK_TIMEOUT_MS=6_000;
const FAILURE_CACHE_MS=1_500;
const recentFailures=new Map();

process.env.GEMINI_VISION_FALLBACK_MODEL=FALLBACK_MODEL;

function requestUrl(input){
  return typeof input==='string'?input:input?.url||String(input||'');
}
function isGeminiGenerate(url){
  return url.includes('generativelanguage.googleapis.com')&&url.includes(':generateContent');
}
function requestPayload(init={}){
  if(typeof init?.body!=='string') return {};
  try{return JSON.parse(init.body);}catch{return {};}
}
function hasInlineMedia(payload={}){
  for(const content of Array.isArray(payload.contents)?payload.contents:[]){
    for(const part of Array.isArray(content?.parts)?content.parts:[]){
      if(part?.inline_data?.data||part?.inlineData?.data) return true;
    }
  }
  return false;
}
function replaceModel(url,model){
  return url.replace(/\/models\/[^/:]+:generateContent(?=\?|$)/,`/models/${encodeURIComponent(model)}:generateContent`);
}
function hash32(value){
  const text=String(value||'');
  let hash=2166136261;
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0).toString(16);
}
function requestKey(url,init){
  const route=url.replace(/\/models\/[^/:]+:generateContent(?=\?|$)/,'/models/:model:generateContent').replace(/\?.*$/,'');
  return `${route}:${hash32(init?.body)}`;
}
async function isTransient(response){
  if(!response) return true;
  if([408,409,425,429,500,502,503,504].includes(response.status)) return true;
  if(response.ok) return false;
  try{
    const text=await response.clone().text();
    return response.status===404&&/model|not found|not available|unsupported/i.test(text)
      || /high demand|temporar|unavailable|resource[_ ]?exhausted|try again|overload|timeout/i.test(text);
  }catch{return false;}
}
async function fallbackFetch(url,init={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),FALLBACK_TIMEOUT_MS);
  const {signal:_outerSignal,...rest}=init||{};
  try{return await upstreamFetch(url,{...rest,signal:controller.signal});}
  finally{clearTimeout(timer);}
}
async function cacheFailure(key,response){
  try{
    recentFailures.set(key,{
      expiresAt:Date.now()+FAILURE_CACHE_MS,
      status:response.status,
      statusText:response.statusText,
      headers:[...response.headers.entries()],
      body:await response.clone().text()
    });
  }catch{}
}
function cachedResponse(key){
  const cached=recentFailures.get(key);
  if(!cached) return null;
  if(cached.expiresAt<=Date.now()){
    recentFailures.delete(key);
    return null;
  }
  return new Response(cached.body,{status:cached.status,statusText:cached.statusText,headers:cached.headers});
}

if(upstreamFetch){
  globalThis.fetch=async(input,init={})=>{
    const url=requestUrl(input);
    const payload=requestPayload(init);
    if(!isGeminiGenerate(url)||!hasInlineMedia(payload)) return upstreamFetch(input,init);

    const key=requestKey(url,init);
    const cached=cachedResponse(key);
    if(cached){
      console.warn('gemini_vision_failover_cached_failure',JSON.stringify({primaryModel:PRIMARY_MODEL,fallbackModel:FALLBACK_MODEL,status:cached.status}));
      return cached;
    }

    let primaryResponse;
    try{
      primaryResponse=await upstreamFetch(input,init);
    }catch(primaryError){
      const fallbackUrl=replaceModel(url,FALLBACK_MODEL);
      try{
        const fallbackResponse=await fallbackFetch(fallbackUrl,init);
        if(fallbackResponse.ok){
          console.info('gemini_vision_model_fallback',JSON.stringify({primaryModel:PRIMARY_MODEL,fallbackModel:FALLBACK_MODEL,reason:'PRIMARY_TRANSPORT_ERROR',status:fallbackResponse.status}));
          return fallbackResponse;
        }
        await cacheFailure(key,fallbackResponse);
        return fallbackResponse;
      }catch{
        throw primaryError;
      }
    }

    if(primaryResponse.ok||!(await isTransient(primaryResponse))) return primaryResponse;

    const fallbackUrl=replaceModel(url,FALLBACK_MODEL);
    try{
      const fallbackResponse=await fallbackFetch(fallbackUrl,init);
      if(fallbackResponse.ok){
        console.info('gemini_vision_model_fallback',JSON.stringify({primaryModel:PRIMARY_MODEL,fallbackModel:FALLBACK_MODEL,reason:`HTTP_${primaryResponse.status}`,status:fallbackResponse.status}));
        return fallbackResponse;
      }
      if(await isTransient(fallbackResponse)) await cacheFailure(key,fallbackResponse);
      console.warn('gemini_vision_fallback_failed',JSON.stringify({primaryModel:PRIMARY_MODEL,primaryStatus:primaryResponse.status,fallbackModel:FALLBACK_MODEL,fallbackStatus:fallbackResponse.status}));
      return fallbackResponse;
    }catch(error){
      console.warn('gemini_vision_fallback_transport_failure',JSON.stringify({primaryModel:PRIMARY_MODEL,primaryStatus:primaryResponse.status,fallbackModel:FALLBACK_MODEL,error:error?.message||String(error)}));
      await cacheFailure(key,primaryResponse);
      return primaryResponse;
    }
  };
}
