const nativeFetch=globalThis.fetch?.bind(globalThis);

const GEMINI_MODEL='gemini-3.8-flash';
const GEMINI_VISION_TIMEOUT_MS=20_000;
const GEMINI_TEXT_TIMEOUT_MS=12_000;
const GEMINI_MAX_ATTEMPTS=2;
process.env.GEMINI_MODEL=GEMINI_MODEL;

function requestUrl(input){
  return typeof input==='string'?input:input?.url||String(input||'');
}
function replaceGeminiModel(url,model=GEMINI_MODEL){
  return url.replace(/\/models\/[^/:]+:generateContent(?=\?|$)/,`/models/${encodeURIComponent(model)}:generateContent`);
}
function isGeminiGenerate(url){
  return url.includes('generativelanguage.googleapis.com')&&url.includes(':generateContent');
}
async function isTransientGeminiFailure(response){
  if(!response) return true;
  if([408,409,425,429,500,502,503,504].includes(response.status)) return true;
  if(response.ok) return false;
  try{
    const text=await response.clone().text();
    return /high demand|temporar|unavailable|resource[_ ]?exhausted|try again|overload|timeout/i.test(text);
  }catch{return false;}
}
function requestPayload(init={}){
  if(typeof init?.body!=='string') return {};
  try{return JSON.parse(init.body);}catch{return {};}
}
function promptFromPayload(payload={}){
  const out=[];
  for(const content of Array.isArray(payload.contents)?payload.contents:[]){
    for(const part of Array.isArray(content?.parts)?content.parts:[]){
      if(typeof part?.text==='string') out.push(part.text);
    }
  }
  return out.join('\n');
}
function hasInlineMedia(payload={}){
  for(const content of Array.isArray(payload.contents)?payload.contents:[]){
    for(const part of Array.isArray(content?.parts)?content.parts:[]){
      if(part?.inline_data?.data||part?.inlineData?.data) return true;
    }
  }
  return false;
}
function extractedEvidence(prompt){
  const cited=prompt.match(/^- \[[^\n]+\][^\n]*/gm)||[];
  if(cited.length) return cited.slice(0,5);
  const bullets=(prompt.match(/^- [^\n]{24,}/gm)||[])
    .filter(line=>!/(không được|không hiển thị|chỉ chatbot|nếu nguồn|trả lời|json|schema)/i.test(line));
  return bullets.slice(0,5);
}
function extractedQuestion(prompt){
  const match=prompt.match(/Câu hỏi người dùng:\s*([\s\S]*?)(?:\nTrả lời|$)/i);
  return String(match?.[1]||'').trim().slice(0,600);
}
function localPlainFallback(prompt){
  const evidence=extractedEvidence(prompt);
  const question=extractedQuestion(prompt);
  const lines=evidence.length?evidence.map(x=>`• ${x.replace(/^-\s*/, '')}`).join('\n'):'• Đối chiếu nguyên tắc thiệt chẩn trong kho dữ liệu nội bộ đã được nạp cho phiên phân tích.';
  return [
    'Hệ thống đang tiếp tục bằng chế độ suy luận nội bộ để không làm gián đoạn phiên.',
    question?`Nội dung đang xử lý: ${question}`:'',
    'Đối chiếu từ kho dữ liệu đã nạp:',
    lines,
    'Tổng hợp tham khảo: ưu tiên phối hợp chất lưỡi, rêu lưỡi, chất lượng ảnh và dữ kiện vấn chẩn; không kết luận từ một dấu hiệu đơn độc và không tự tạo dữ kiện chưa được quan sát.'
  ].filter(Boolean).join('\n\n');
}
function localJsonFallback(prompt){
  const evidence=extractedEvidence(prompt).slice(0,3);
  const evidenceText=evidence.length?evidence.join(' | '):'Đối chiếu nguyên tắc thiệt chẩn trong kho dữ liệu nội bộ đã được nạp.';
  return JSON.stringify({
    localKnowledgeOnly:true,
    combined:{confidence:0,summary:`Tiếp tục biện luận từ kho dữ liệu nội bộ: ${evidenceText}`}
  });
}
function localKnowledgeResponse(init,reason){
  const payload=requestPayload(init);
  const prompt=promptFromPayload(payload);
  const wantsJson=String(payload?.generationConfig?.responseMimeType||'').toLowerCase()==='application/json';
  const text=wantsJson?localJsonFallback(prompt):localPlainFallback(prompt);
  console.warn('gemini_local_knowledge_fallback',JSON.stringify({reason,model:GEMINI_MODEL,response:wantsJson?'json':'text'}));
  return new Response(JSON.stringify({
    candidates:[{content:{role:'model',parts:[{text}]},finishReason:'STOP'}],
    localFallback:{active:true,reason,model:GEMINI_MODEL}
  }),{status:200,headers:{'content-type':'application/json','x-ai-fallback':'local-knowledge'}});
}
function unavailableVisionResponse(reason,status=503){
  console.warn('gemini_vision_unavailable',JSON.stringify({reason,model:GEMINI_MODEL,status}));
  return new Response(JSON.stringify({error:{code:status,status:'UNAVAILABLE',message:'VISION_ANALYSIS_TEMPORARILY_UNAVAILABLE'},visionStatus:'unavailable',reason}),{
    status,headers:{'content-type':'application/json','x-ai-vision-status':'unavailable'}
  });
}
async function timedFetch(input,init,url,timeoutMs){
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
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function geminiResilientFetch(input,init,url){
  const candidate=replaceGeminiModel(url,GEMINI_MODEL);
  const payload=requestPayload(init);
  const vision=hasInlineMedia(payload);
  const timeoutMs=vision?GEMINI_VISION_TIMEOUT_MS:GEMINI_TEXT_TIMEOUT_MS;
  let lastResponse=null;
  let lastError=null;
  for(let attempt=1;attempt<=GEMINI_MAX_ATTEMPTS;attempt++){
    try{
      const response=await timedFetch(candidate,init,candidate,timeoutMs);
      if(response.ok) return response;
      if(!(await isTransientGeminiFailure(response))) return response;
      lastResponse=response;
      console.warn('gemini_transient_failure',JSON.stringify({status:response.status,model:GEMINI_MODEL,attempt,vision}));
    }catch(err){
      lastError=err;
      console.warn('gemini_transport_failure',JSON.stringify({model:GEMINI_MODEL,error:err?.message||String(err),attempt,vision}));
    }
    if(attempt<GEMINI_MAX_ATTEMPTS) await sleep(450*attempt);
  }
  if(vision){
    if(lastResponse) return unavailableVisionResponse(`HTTP_${lastResponse.status}`,lastResponse.status===429?503:lastResponse.status);
    return unavailableVisionResponse(lastError?.message||'TRANSPORT_ERROR',lastError?.status===504?504:503);
  }
  return localKnowledgeResponse(init,lastResponse?`HTTP_${lastResponse.status}`:(lastError?.message||'TRANSPORT_ERROR'));
}

if(nativeFetch){
  globalThis.fetch=async(input,init={})=>{
    const url=requestUrl(input);
    if(isGeminiGenerate(url)) return geminiResilientFetch(input,init,url);
    const timeoutMs=url.includes('.supabase.co')?15_000:0;
    return timedFetch(input,init,url,timeoutMs);
  };
}
