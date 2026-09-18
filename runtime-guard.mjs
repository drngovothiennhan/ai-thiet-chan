const nativeFetch=globalThis.fetch?.bind(globalThis);

const GEMINI_MODEL='gemini-3.8-flash';
const GEMINI_TEXT_FALLBACK_MODEL='gemini-3.6-flash';
const GEMINI_TEXT_TIMEOUT_MS=Math.max(2000,Number(process.env.GEMINI_TEXT_TIMEOUT_MS||8000));
const GEMINI_TOTAL_BUDGET_MS=Math.max(GEMINI_TEXT_TIMEOUT_MS,Number(process.env.GEMINI_TOTAL_BUDGET_MS||18000));
const GEMINI_RETRY_BASE_MS=Math.max(0,Number(process.env.GEMINI_RETRY_BASE_MS||900));
const GEMINI_RETRY_MAX_MS=Math.max(GEMINI_RETRY_BASE_MS,Number(process.env.GEMINI_RETRY_MAX_MS||4000));
const GEMINI_CIRCUIT_503_MS=Math.max(5000,Number(process.env.GEMINI_CIRCUIT_503_MS||30000));
const GEMINI_CIRCUIT_429_MS=Math.max(10000,Number(process.env.GEMINI_CIRCUIT_429_MS||60000));
const AI_GATEWAY_TIMEOUT_MS=Math.max(2000,Number(process.env.AI_GATEWAY_TIMEOUT_MS||8000));
const AI_GATEWAY_PRIMARY_MODEL=String(process.env.AI_GATEWAY_PRIMARY_MODEL||'openai/gpt-5.6-sol').trim();
const AI_GATEWAY_ENABLED=String(process.env.AI_GATEWAY_ENABLED||'auto').trim().toLowerCase();
process.env.GEMINI_MODEL=GEMINI_MODEL;
process.env.GEMINI_TEXT_FALLBACK_MODEL=GEMINI_TEXT_FALLBACK_MODEL;
process.env.AITC_AI_GATEWAY_PRIMARY_MODEL=AI_GATEWAY_PRIMARY_MODEL;

function requestUrl(input){
  return typeof input==='string'?input:input?.url||String(input||'');
}
function replaceGeminiModel(url,model=GEMINI_MODEL){
  return url.replace(/\/models\/[^/:]+:generateContent(?=\?|$)/,`/models/${encodeURIComponent(model)}:generateContent`);
}
function isGeminiGenerate(url){
  return url.includes('generativelanguage.googleapis.com')&&url.includes(':generateContent');
}
const circuitState=new Map();
function gatewayCredential(){return String(process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN||'').trim();}
function gatewayAvailable(){return AI_GATEWAY_ENABLED!=='false'&&Boolean(gatewayCredential());}
function circuitInfo(model){
  const state=circuitState.get(model)||{failures:0,openedUntil:0,lastStatus:0};
  if(state.openedUntil&&state.openedUntil<=Date.now()){state.openedUntil=0;state.failures=0;state.lastStatus=0;circuitState.set(model,state);}
  return state;
}
function circuitOpen(model){if(process.env.AITC_TEST_DISABLE_CIRCUIT==='1')return false;return circuitInfo(model).openedUntil>Date.now();}
function openCircuit(model,status,ms){
  const state=circuitInfo(model);
  state.failures=Math.max(1,state.failures||0);
  state.lastStatus=Number(status)||0;
  state.openedUntil=Math.max(state.openedUntil||0,Date.now()+Math.max(1,Number(ms)||1));
  circuitState.set(model,state);
  console.warn('gemini_circuit_open',JSON.stringify({model,status:state.lastStatus,failures:state.failures,openMs:Math.max(0,state.openedUntil-Date.now())}));
}
function recordModelSuccess(model){circuitState.set(model,{failures:0,openedUntil:0,lastStatus:200});}
function recordTransientFailure(model,status,retryAfterMs=0){
  if(process.env.AITC_TEST_DISABLE_CIRCUIT==='1')return;
  const state=circuitInfo(model);state.failures=(state.failures||0)+1;state.lastStatus=Number(status)||0;
  if(Number(status)===429)openCircuit(model,status,Math.max(GEMINI_CIRCUIT_429_MS,retryAfterMs||0));
  else if(state.failures>=2)openCircuit(model,status,GEMINI_CIRCUIT_503_MS);
  else circuitState.set(model,state);
}
function parseRetryAfterMs(value){
  const text=String(value||'').trim();if(!text)return 0;
  const seconds=Number(text);if(Number.isFinite(seconds))return Math.max(0,Math.round(seconds*1000));
  const at=Date.parse(text);return Number.isFinite(at)?Math.max(0,at-Date.now()):0;
}
function parseRetryDelayMs(value){
  if(typeof value==='string'){const s=value.match(/^([0-9.]+)s$/i);if(s)return Math.round(Number(s[1])*1000);const ms=value.match(/^([0-9.]+)ms$/i);if(ms)return Math.round(Number(ms[1]));}
  if(value&&typeof value==='object'){const seconds=Number(value.seconds||0),nanos=Number(value.nanos||0);if(Number.isFinite(seconds)&&Number.isFinite(nanos))return Math.max(0,Math.round(seconds*1000+nanos/1e6));}
  return 0;
}
async function transientDiagnostics(response){
  const retryHeaderMs=parseRetryAfterMs(response?.headers?.get?.('retry-after'));
  let body=null;try{body=await response.clone().json();}catch{}
  const err=body?.error||{},details=Array.isArray(err.details)?err.details:[];let retryDetailMs=0;const quotaViolations=[];
  for(const detail of details){
    const type=String(detail?.['@type']||'');
    if(/RetryInfo$/i.test(type))retryDetailMs=Math.max(retryDetailMs,parseRetryDelayMs(detail.retryDelay));
    if(/QuotaFailure$/i.test(type))for(const v of Array.isArray(detail.violations)?detail.violations:[])quotaViolations.push({subject:String(v?.subject||'').slice(0,180),description:String(v?.description||'').slice(0,240),quotaMetric:String(v?.quotaMetric||'').slice(0,180),quotaId:String(v?.quotaId||'').slice(0,180),quotaDimensions:v?.quotaDimensions&&typeof v.quotaDimensions==='object'?v.quotaDimensions:undefined});
  }
  return {status:Number(response?.status)||0,errorStatus:String(err.status||'').slice(0,80),errorCode:Number(err.code)||0,message:String(err.message||'').replace(/([?&]\s*)?key\s*=\s*[^&\s]+/gi,'key=[redacted]').replace(/AIza[0-9A-Za-z_-]{20,}/g,'[redacted-google-key]').slice(0,260),retryAfterMs:Math.max(retryHeaderMs,retryDetailMs),quotaViolations:quotaViolations.slice(0,6)};
}
function backoffMs(sequence,retryAfterMs=0){
  if(retryAfterMs>0)return Math.min(retryAfterMs,GEMINI_RETRY_MAX_MS);
  const raw=Math.min(GEMINI_RETRY_MAX_MS,GEMINI_RETRY_BASE_MS*Math.pow(2,Math.max(0,sequence)));
  return raw?Math.max(0,Math.round(raw*(0.75+Math.random()*0.5))):0;
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
function requiresExternalGemini(payload={}){
  return /\[TRO_LY_THAM_VAN_EXTERNAL\]/.test(promptFromPayload(payload));
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
function extractGroundedKnowledge(prompt){
  const match=prompt.match(/HỆ TRI THỨC[^:]*:\s*([\s\S]*?)(?:\nCâu hỏi người dùng:|\nBối cảnh phân tích:|$)/i);
  if(!match)return[];
  return String(match[1]||'').split('\n').map(x=>x.trim()).filter(x=>x.startsWith('- ')).slice(0,5);
}
function cleanText(v){return String(v||'').trim();}
function compactUnique(items,limit=5){return [...new Set(items.map(cleanText).filter(Boolean))].slice(0,limit);}
function signalText(item){
  if(!item||typeof item!=='object') return '';
  return [cleanText(item.label),cleanText(item.evidence)].filter(Boolean).join(': ');
}
function localClinicalFallback(prompt){
  const assessment=extractAssessment(prompt);
  const question=extractedQuestion(prompt);
  const groundedKnowledge=extractGroundedKnowledge(prompt);
  const groundingProtocol=/\[CHAT_GROUNDING_PROTOCOL\]/.test(prompt);
  if(!assessment){
    const out=['Tham Vấn từ kho tri thức:'];
    if(groundedKnowledge.length) out.push(...groundedKnowledge);
    out.push('Chưa có đủ kết quả quan sát của ca hiện tại để gắn các quy tắc trên vào hình lưỡi cụ thể. Hãy hoàn tất phân tích ảnh; hệ thống sẽ đối chiếu tiếp mà không tự tạo đặc điểm hình ảnh.');
    return groundingProtocol?`GROUNDING=IN\n${out.join('\n')}`:out.join('\n');
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
  const out=[wantsDetail?'Nhận định chi tiết từ dữ kiện hiện có:':'Nhận định hiện tại:'];
  if(details.length) out.push(`• Quan sát: ${details.join('; ')}.`);
  if(summary) out.push(`• Tổng hợp: ${summary}`);
  if(signals.length) out.push(`• Đối chiếu YHCT: ${signals.join(' | ')}.`);
  if(skipped) out.push('• Do chưa bổ sung Thập vấn, mức biện chứng chỉ dựa trên thiệt tượng hiện có và cần xem là nhận định tham khảo.');
  if(limits.length) out.push(`• Chưa đủ căn cứ: ${limits.join(' | ')}.`);
  if(wantsDetail) out.push('Nếu cần tăng độ chắc chắn, lựa chọn Thập vấn sẽ giúp đối chiếu thêm các dữ kiện còn thiếu mà không thay đổi những gì đã quan sát từ ảnh.');
  const text=out.join('\n');
  return groundingProtocol?`GROUNDING=IN\n${text}`:text;
}
function localJsonFallback(){
  return JSON.stringify({localKnowledgeOnly:true,combined:{confidence:0,summary:'Chưa có phản hồi thị giác mới; không tự tạo đặc điểm hình ảnh.'}});
}
function localKnowledgeResponse(init,reason,elapsedMs){
  const payload=requestPayload(init);
  const prompt=promptFromPayload(payload);
  const wantsJson=String(payload?.generationConfig?.responseMimeType||'').toLowerCase()==='application/json';
  const text=wantsJson?localJsonFallback():localClinicalFallback(prompt);
  console.warn('gemini_local_knowledge_fallback',JSON.stringify({reason,model:GEMINI_MODEL,response:wantsJson?'json':'text',elapsedMs}));
  return new Response(JSON.stringify({
    candidates:[{content:{role:'model',parts:[{text}]},finishReason:'STOP'}],
    localFallback:{active:true,reason,model:GEMINI_MODEL,elapsedMs}
  }),{status:200,headers:{'content-type':'application/json','x-ai-fallback':'local-knowledge','x-ai-upstream-ms':String(elapsedMs||0)}});
}
function unavailableTextResponse(reason,status=503,elapsedMs=0){
  console.warn('gemini_consultation_unavailable',JSON.stringify({reason,model:GEMINI_MODEL,status,elapsedMs}));
  return new Response(JSON.stringify({error:{code:status,status:'UNAVAILABLE',message:'CONSULTATION_GEMINI_TEMPORARILY_UNAVAILABLE'},consultationStatus:'unavailable',reason,elapsedMs}),{
    status,headers:{'content-type':'application/json','x-ai-consultation-status':'unavailable','x-ai-upstream-ms':String(elapsedMs||0)}
  });
}
function blockedVisionResponse(){
  console.error('gemini_vision_blocked',JSON.stringify({policy:'local-vision-only',model:GEMINI_MODEL}));
  return new Response(JSON.stringify({
    error:{code:422,status:'FAILED_PRECONDITION',message:'GEMINI_VISION_DISABLED'},
    visionStatus:'blocked',
    policy:'local-vision-only'
  }),{status:422,headers:{'content-type':'application/json','x-ai-vision-status':'blocked'}});
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
const sleep=ms=>ms>0?new Promise(resolve=>setTimeout(resolve,ms)):Promise.resolve();
function textMessagesForGateway(payload={}){
  const messages=[];
  for(const content of Array.isArray(payload.contents)?payload.contents:[]){
    const text=(Array.isArray(content?.parts)?content.parts:[]).map(part=>typeof part?.text==='string'?part.text:'').filter(Boolean).join('\n');
    if(!text)continue;
    messages.push({role:content?.role==='model'?'assistant':'user',content:text});
  }
  return messages;
}
async function gatewayFallbackResponse(payload,startedAt){
  if(!gatewayAvailable())return null;
  const credential=gatewayCredential(),messages=textMessagesForGateway(payload);if(!messages.length)return null;
  const remaining=Math.max(0,GEMINI_TOTAL_BUDGET_MS-(Date.now()-startedAt));if(remaining<1000)return null;
  const timeout=Math.min(AI_GATEWAY_TIMEOUT_MS,remaining),gatewayStarted=Date.now();
  try{
    const response=await timedFetch('https://ai-gateway.vercel.sh/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+credential},body:JSON.stringify({model:AI_GATEWAY_PRIMARY_MODEL,messages,stream:false,temperature:Number(payload?.generationConfig?.temperature??0.15),max_tokens:1600})},'https://ai-gateway.vercel.sh/v1/chat/completions',timeout);
    const elapsedMs=Date.now()-gatewayStarted,data=await response.json().catch(()=>({}));
    if(!response.ok){console.warn('ai_gateway_failure',JSON.stringify({status:response.status,model:AI_GATEWAY_PRIMARY_MODEL,elapsedMs,message:String(data?.error?.message||'').slice(0,220)}));return null;}
    const text=String(data?.choices?.[0]?.message?.content||'').trim();if(!text)return null;
    const usedModel=String(data?.model||AI_GATEWAY_PRIMARY_MODEL).slice(0,120);
    console.info('ai_gateway_fallback_complete',JSON.stringify({model:usedModel,status:response.status,elapsedMs,totalMs:Date.now()-startedAt}));
    return new Response(JSON.stringify({candidates:[{content:{role:'model',parts:[{text}]},finishReason:'STOP'}],gatewayFallback:{active:true,model:usedModel,elapsedMs}}),{status:200,headers:{'content-type':'application/json','x-ai-fallback':'vercel-ai-gateway','x-ai-gateway-model':usedModel,'x-ai-upstream-ms':String(elapsedMs)}});
  }catch(err){
    console.warn('ai_gateway_transport_failure',JSON.stringify({model:AI_GATEWAY_PRIMARY_MODEL,error:err?.message||String(err),elapsedMs:Date.now()-gatewayStarted,totalMs:Date.now()-startedAt}));
    return null;
  }
}
async function geminiResilientFetch(input,init,url){
  const startedAt=Date.now();
  const payload=requestPayload(init);
  const vision=hasInlineMedia(payload);
  const externalGeminiRequired=!vision&&requiresExternalGemini(payload);
  if(vision) return blockedVisionResponse();

  const plan=[{model:GEMINI_MODEL,maxAttempts:2},{model:GEMINI_TEXT_FALLBACK_MODEL,maxAttempts:1}];
  let lastResponse=null,lastError=null,lastDiagnostics=null,sequence=0;

  for(const step of plan){
    const model=step.model;
    if(circuitOpen(model)){
      const state=circuitInfo(model);
      console.warn('gemini_circuit_skip',JSON.stringify({model,lastStatus:state.lastStatus,remainingOpenMs:Math.max(0,state.openedUntil-Date.now())}));
      continue;
    }
    for(let localAttempt=1;localAttempt<=step.maxAttempts;localAttempt++){
      const remaining=Math.max(0,GEMINI_TOTAL_BUDGET_MS-(Date.now()-startedAt));
      if(remaining<1000)break;
      const candidate=replaceGeminiModel(url,model),attemptStarted=Date.now(),timeout=Math.min(GEMINI_TEXT_TIMEOUT_MS,remaining);
      try{
        const response=await timedFetch(candidate,init,candidate,timeout);
        const attemptMs=Date.now()-attemptStarted;
        if(response.ok){
          recordModelSuccess(model);
          console.info('gemini_attempt_complete',JSON.stringify({model,attempt:localAttempt,sequence:sequence+1,vision:false,status:response.status,attemptMs,totalMs:Date.now()-startedAt}));
          if(model!==GEMINI_MODEL)console.info('gemini_text_model_fallback',JSON.stringify({primaryModel:GEMINI_MODEL,fallbackModel:model,attempt:localAttempt,totalMs:Date.now()-startedAt}));
          return response;
        }
        if(!(await isTransientGeminiFailure(response))){
          const diag=await transientDiagnostics(response);
          console.warn('gemini_nontransient_failure',JSON.stringify({model,attempt:localAttempt,sequence:sequence+1,vision:false,attemptMs,totalMs:Date.now()-startedAt,...diag}));
          return response;
        }
        const diag=await transientDiagnostics(response);
        lastResponse=response;lastDiagnostics=diag;sequence+=1;
        recordTransientFailure(model,response.status,diag.retryAfterMs);
        console.warn('gemini_transient_failure',JSON.stringify({model,attempt:localAttempt,sequence,vision:false,attemptMs,totalMs:Date.now()-startedAt,...diag}));
        if(response.status===429||circuitOpen(model))break;
        if(localAttempt<step.maxAttempts){
          const wait=backoffMs(sequence-1,diag.retryAfterMs),room=GEMINI_TOTAL_BUDGET_MS-(Date.now()-startedAt);
          if(room<=wait+750)break;
          console.info('gemini_retry_backoff',JSON.stringify({model,attempt:localAttempt,nextAttempt:localAttempt+1,waitMs:wait,totalMs:Date.now()-startedAt}));
          await sleep(wait);
        }
      }catch(err){
        lastError=err;sequence+=1;
        const attemptMs=Date.now()-attemptStarted;
        recordTransientFailure(model,err?.status||504,0);
        console.warn('gemini_transport_failure',JSON.stringify({model,error:err?.message||String(err),attempt:localAttempt,sequence,vision:false,attemptMs,totalMs:Date.now()-startedAt}));
        if(err?.message==='UPSTREAM_TIMEOUT'||circuitOpen(model))break;
        if(localAttempt<step.maxAttempts){
          const wait=backoffMs(sequence-1,0),room=GEMINI_TOTAL_BUDGET_MS-(Date.now()-startedAt);
          if(room<=wait+750)break;
          await sleep(wait);
        }
      }
    }
  }

  const gateway=await gatewayFallbackResponse(payload,startedAt);
  if(gateway)return gateway;

  const elapsedMs=Date.now()-startedAt;
  const finalReason=lastDiagnostics?'HTTP_'+lastDiagnostics.status:(lastError?.message||'TRANSPORT_ERROR');
  if(externalGeminiRequired){
    let status=lastDiagnostics?.status||lastError?.status||503;if(status===429)status=503;
    return unavailableTextResponse(finalReason,status,elapsedMs);
  }
  return localKnowledgeResponse(init,finalReason,elapsedMs);
}

if(nativeFetch){
  globalThis.fetch=async(input,init={})=>{
    const url=requestUrl(input);
    if(isGeminiGenerate(url)) return geminiResilientFetch(input,init,url);
    const timeoutMs=url.includes('.supabase.co')?15_000:0;
    return timedFetch(input,init,url,timeoutMs);
  };
}
