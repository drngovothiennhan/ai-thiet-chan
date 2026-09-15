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
function extractedQuestion(prompt){
  const match=prompt.match(/Câu hỏi người dùng:\s*([\s\S]*?)(?:\nTrả lời|$)/i);
  return String(match?.[1]||'').trim().slice(0,1200);
}
function extractAssessment(prompt){
  const match=prompt.match(/Bối cảnh phân tích:\s*([\s\S]*?)\nCâu hỏi người dùng:/i);
  if(!match) return null;
  const text=String(match[1]||'').trim();
  if(!text||text==='Chưa có kết quả phân tích hình lưỡi.') return null;
  try{return JSON.parse(text);}catch{return null;}
}
function cleanText(v){return String(v||'').trim();}
function compactUnique(items,limit=5){
  return [...new Set(items.map(cleanText).filter(Boolean))].slice(0,limit);
}
function signalText(item){
  if(!item||typeof item!=='object') return '';
  const label=cleanText(item.label);
  const evidence=cleanText(item.evidence);
  return [label,evidence].filter(Boolean).join(': ');
}
function localClinicalFallback(prompt){
  const assessment=extractAssessment(prompt);
  const question=extractedQuestion(prompt);
  if(!assessment){
    return 'Tôi chưa có đủ kết quả quan sát của ca hiện tại để đưa ra nhận định. Hãy hoàn tất phân tích ảnh trước, sau đó tôi sẽ đối chiếu các dấu hiệu và trả lời theo dữ kiện đã có.';
  }

  const top=assessment?.top||{};
  const bottom=assessment?.bottom||null;
  const combined=assessment?.combined||{};
  const details=[
    top.tongueColor&&`chất lưỡi ${top.tongueColor}`,
    top.shape&&`hình thể ${top.shape}`,
    top.coatingColor&&`rêu ${top.coatingColor}`,
    top.coatingThickness&&`độ dày rêu ${top.coatingThickness}`,
    top.coatingTexture&&`tính chất rêu ${top.coatingTexture}`,
    top.moisture&&`độ ẩm ${top.moisture}`,
    top.fissures&&`nứt ${top.fissures}`,
    top.toothmarks&&`dấu răng ${top.toothmarks}`
  ].filter(Boolean);
  if(bottom){
    const vessels=bottom?.vessels||{};
    if(bottom.undersideColor) details.push(`mặt dưới ${bottom.undersideColor}`);
    if(vessels.color) details.push(`mạch dưới lưỡi ${vessels.color}`);
    if(vessels.prominence) details.push(`mức nổi mạch ${vessels.prominence}`);
    if(vessels.dilation) details.push(`giãn mạch ${vessels.dilation}`);
  }

  const signals=compactUnique([
    ...(Array.isArray(combined.generalSignals)?combined.generalSignals.map(signalText):[]),
    ...(Array.isArray(combined.stomachPatternSignals)?combined.stomachPatternSignals.map(signalText):[]),
    ...(Array.isArray(top?.theoryAssessment?.generalSignals)?top.theoryAssessment.generalSignals.map(signalText):[]),
    ...(Array.isArray(top?.theoryAssessment?.stomachPatternSignals)?top.theoryAssessment.stomachPatternSignals.map(signalText):[])
  ],5);
  const limits=compactUnique([
    ...(Array.isArray(combined.cannotConclude)?combined.cannotConclude:[]),
    ...(Array.isArray(top.limitations)?top.limitations:[]),
    ...(bottom&&Array.isArray(bottom.limitations)?bottom.limitations:[])
  ],4);
  const summary=cleanText(combined.summary||top.summary);
  const wantsDetail=/DETAIL_WITHOUT_THAP_VAN|chi tiết|chi tiet/i.test(question);
  const skipped=/SKIP_THAP_VAN|NO_THAP_VAN_CONTEXT/i.test(question);

  const out=[];
  if(wantsDetail) out.push('Nhận định chi tiết từ dữ kiện hiện có:');
  else out.push('Nhận định hiện tại:');
  if(details.length) out.push(`• Quan sát: ${details.join('; ')}.`);
  if(summary) out.push(`• Tổng hợp: ${summary}`);
  if(signals.length) out.push(`• Đối chiếu YHCT: ${signals.join(' | ')}.`);
  if(skipped) out.push('• Do chưa bổ sung Thập vấn, mức biện chứng chỉ dựa trên thiệt tượng hiện có và cần xem là nhận định tham khảo.');
  if(limits.length) out.push(`• Chưa đủ căn cứ: ${limits.join(' | ')}.`);
  if(wantsDetail) out.push('Nếu cần tăng độ chắc chắn, lựa chọn Thập vấn sẽ giúp đối chiếu thêm các dữ kiện còn thiếu mà không thay đổi những gì đã quan sát từ ảnh.');
  return out.join('\n');
}
function localJsonFallback(){
  return JSON.stringify({localKnowledgeOnly:true,combined:{confidence:0,summary:'Chưa có phản hồi thị giác mới; không tự tạo đặc điểm hình ảnh.'}});
}
function localKnowledgeResponse(init,reason){
  const payload=requestPayload(init);
  const prompt=promptFromPayload(payload);
  const wantsJson=String(payload?.generationConfig?.responseMimeType||'').toLowerCase()==='application/json';
  const text=wantsJson?localJsonFallback():localClinicalFallback(prompt);
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
