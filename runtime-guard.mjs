const nativeFetch=globalThis.fetch?.bind(globalThis);

const GEMINI_MODEL='gemini-3.8-flash';
const GEMINI_VISION_TIMEOUT_MS=8_000;
const GEMINI_TEXT_TIMEOUT_MS=4_000;
const GEMINI_TEXT_MAX_ATTEMPTS=1;
const GEMINI_VISION_MAX_ATTEMPTS=2;
process.env.GEMINI_MODEL=GEMINI_MODEL;

function requestUrl(input){return typeof input==='string'?input:input?.url||String(input||'');}
function replaceGeminiModel(url,model=GEMINI_MODEL){return url.replace(/\/models\/[^/:]+:generateContent(?=\?|$)/,`/models/${encodeURIComponent(model)}:generateContent`);}
function isGeminiGenerate(url){return url.includes('generativelanguage.googleapis.com')&&url.includes(':generateContent');}
function requestPayload(init={}){if(typeof init?.body!=='string')return{};try{return JSON.parse(init.body);}catch{return{};}}
function promptFromPayload(payload={}){const out=[];for(const content of Array.isArray(payload.contents)?payload.contents:[])for(const part of Array.isArray(content?.parts)?content.parts:[])if(typeof part?.text==='string')out.push(part.text);return out.join('\n');}
function hasInlineMedia(payload={}){for(const content of Array.isArray(payload.contents)?payload.contents:[])for(const part of Array.isArray(content?.parts)?content.parts:[])if(part?.inline_data?.data||part?.inlineData?.data)return true;return false;}
function cleanText(v){return String(v||'').trim();}
function byteLength(v){return Buffer.byteLength(String(v||''),'utf8');}
function compactUnique(items,limit=6){return [...new Set(items.map(cleanText).filter(Boolean))].slice(0,limit);}
function extractedQuestion(prompt){const match=prompt.match(/Câu hỏi người dùng:\s*([\s\S]*?)(?:\nTrả lời|$)/i);return String(match?.[1]||'').trim().slice(0,6000);}
function extractAssessment(prompt){const match=prompt.match(/Bối cảnh phân tích:\s*([\s\S]*?)\nCâu hỏi người dùng:/i);if(!match)return null;const text=String(match[1]||'').trim();if(!text||text==='Chưa có kết quả phân tích hình lưỡi.')return null;try{return JSON.parse(text);}catch{return null;}}
function compactAssessment(a){
  if(!a||typeof a!=='object')return null;
  const t=a.top||{},b=a.bottom||null,c=a.combined||{},fv=a?.ml?.featureVector||{};
  return {
    mode:a.mode||fv.mode||'normal',
    top:{quality:t.quality,visualValidity:t.visualValidity,tongueColor:t.tongueColor,shape:t.shape,coatingColor:t.coatingColor,coatingThickness:t.coatingThickness,coatingTexture:t.coatingTexture,moisture:t.moisture,fissures:t.fissures,toothmarks:t.toothmarks,pricklesSpots:t.pricklesSpots,stasisMarks:t.stasisMarks,limitations:Array.isArray(t.limitations)?t.limitations.slice(0,4):[]},
    bottom:b?{quality:b.quality,visualValidity:b.visualValidity,undersideColor:b.undersideColor,vessels:b.vessels,limitations:Array.isArray(b.limitations)?b.limitations.slice(0,3):[]}:null,
    combined:{summary:cleanText(c.summary).slice(0,1400),generalSignals:Array.isArray(c.generalSignals)?c.generalSignals.slice(0,6):[],stomachPatternSignals:Array.isArray(c.stomachPatternSignals)?c.stomachPatternSignals.slice(0,4):[],cannotConclude:Array.isArray(c.cannotConclude)?c.cannotConclude.slice(0,5):[]},
    featureVector:{schemaVersion:fv.schemaVersion,top:fv.top?{visual:fv.top.visual,validity:fv.top.validity,qc:fv.top.qc,confidence:fv.top.confidence}:null,bottom:fv.bottom?{visual:fv.bottom.visual,validity:fv.bottom.validity,qc:fv.bottom.qc,confidence:fv.bottom.confidence}:null,combined:fv.combined||null}
  };
}
function adaptiveEvidence(prompt){
  const block=prompt.match(/\[ADAPTIVE_EVIDENCE\]([\s\S]*?)(?:\[\/ADAPTIVE_EVIDENCE\]|$)/i)?.[1]||'';
  return compactUnique(block.split('\n').map(x=>x.trim()).filter(x=>/^[-*]\s*\[(?!PSY1)/i.test(x)).map(x=>x.replace(/^\*\s*/, '- ')),6);
}
function groundedEvidence(prompt){
  const adaptive=adaptiveEvidence(prompt);if(adaptive.length)return adaptive;
  const match=prompt.match(/HỆ TRI THỨC[^:]*:\s*([\s\S]*?)(?:\nBối cảnh phân tích:|\nCâu hỏi người dùng:|$)/i);
  if(!match)return[];
  return compactUnique(String(match[1]).split('\n').map(x=>x.trim()).filter(x=>x.startsWith('- ')&&!/\[PSY1\b/i.test(x)),6);
}
function compactChatInit(init={}){
  const payload=requestPayload(init),prompt=promptFromPayload(payload);
  if(!/\[CHAT_GROUNDING_PROTOCOL\]/.test(prompt))return{init,meta:null};
  const assessment=compactAssessment(extractAssessment(prompt));
  const question=extractedQuestion(prompt);
  const evidence=groundedEvidence(prompt);
  const adaptive=/\[ADAPTIVE_FOLLOWUP\]/i.test(question);
  const compactPrompt=`[CHAT_GROUNDING_PROTOCOL]\nBạn là tầng Tham vấn A.I chỉ tổng hợp trên dữ kiện đã có. Không tự tạo triệu chứng, bệnh danh, đặc điểm thị giác, nguyên nhân hoặc phương thuốc; không biến một dấu đơn độc thành chẩn đoán xác định. Nếu evidence không đủ phù hợp, phải nói rõ chưa đủ căn cứ. Không mô tả model/nhà cung cấp/quy trình nội bộ.\n\nEVIDENCE ĐƯỢC PHÉP DÙNG (${evidence.length}):\n${evidence.length?evidence.join('\n'):'- Chưa tìm thấy evidence đủ phù hợp.'}\n\nCA HIỆN TẠI (rút gọn):\n${assessment?JSON.stringify(assessment):'Chưa có kết quả phân tích hình lưỡi.'}\n\nCâu hỏi người dùng: ${question}\nTrả lời tiếng Việt, tách rõ quan sát ảnh / dữ kiện người dùng trả lời / tổng hợp có điều kiện. Dòng đầu là GROUNDING=IN khi toàn bộ nội dung y học được hỗ trợ bởi dữ kiện/evidence trên, ngược lại GROUNDING=OUT.`;
  const next=structuredClone(payload);let replaced=false;
  for(const content of Array.isArray(next.contents)?next.contents:[])for(const part of Array.isArray(content?.parts)?content.parts:[]){if(!replaced&&typeof part?.text==='string'){part.text=compactPrompt;replaced=true;}else if(typeof part?.text==='string')part.text='';}
  const nextInit={...init,body:JSON.stringify(next)};
  return{init:nextInit,meta:{adaptive,retrievedEvidenceCount:evidence.length,promptBytesBefore:byteLength(init.body),promptBytesAfter:byteLength(nextInit.body)}};
}
function signalText(item){if(!item||typeof item!=='object')return'';return[cleanText(item.label),cleanText(item.evidence)].filter(Boolean).join(': ');}
function localClinicalFallback(prompt){
  const assessment=extractAssessment(prompt),question=extractedQuestion(prompt),grounded=groundedEvidence(prompt),protocol=/\[CHAT_GROUNDING_PROTOCOL\]/.test(prompt);
  if(!assessment){const out=['Tham Vấn từ kho tri thức:'];if(grounded.length)out.push(...grounded);out.push('Chưa có đủ kết quả quan sát của ca hiện tại để gắn các quy tắc trên vào hình lưỡi cụ thể.');return protocol?`GROUNDING=IN\n${out.join('\n')}`:out.join('\n');}
  const top=assessment.top||{},bottom=assessment.bottom||null,combined=assessment.combined||{};
  const details=[top.tongueColor&&`chất lưỡi ${top.tongueColor}`,top.shape&&`hình thể ${top.shape}`,top.coatingColor&&`rêu ${top.coatingColor}`,top.coatingThickness&&`độ dày rêu ${top.coatingThickness}`,top.coatingTexture&&`tính chất rêu ${top.coatingTexture}`,top.moisture&&`độ ẩm ${top.moisture}`,top.fissures&&`nứt ${top.fissures}`,top.toothmarks&&`dấu răng ${top.toothmarks}`].filter(Boolean);
  if(bottom){const v=bottom.vessels||{};if(bottom.undersideColor)details.push(`mặt dưới ${bottom.undersideColor}`);if(v.color)details.push(`mạch dưới lưỡi ${v.color}`);if(v.prominence)details.push(`mức nổi mạch ${v.prominence}`);if(v.dilation)details.push(`giãn mạch ${v.dilation}`);}
  const signals=compactUnique([...(Array.isArray(combined.generalSignals)?combined.generalSignals.map(signalText):[]),...(Array.isArray(combined.stomachPatternSignals)?combined.stomachPatternSignals.map(signalText):[])],5);
  const limits=compactUnique([...(Array.isArray(combined.cannotConclude)?combined.cannotConclude:[]),...(Array.isArray(top.limitations)?top.limitations:[]),...(bottom&&Array.isArray(bottom.limitations)?bottom.limitations:[])],4);
  const out=['Nhận định hiện tại:'];if(details.length)out.push(`• Quan sát: ${details.join('; ')}.`);if(combined.summary)out.push(`• Tổng hợp: ${combined.summary}`);if(signals.length)out.push(`• Đối chiếu YHCT: ${signals.join(' | ')}.`);if(limits.length)out.push(`• Chưa đủ căn cứ: ${limits.join(' | ')}.`);if(/ADAPTIVE_FOLLOWUP/i.test(question))out.push('• Phần kiểm tra nhanh chỉ bổ sung dữ kiện người dùng đã trả lời; không thay đổi đặc điểm thị giác đã xác định.');
  return protocol?`GROUNDING=IN\n${out.join('\n')}`:out.join('\n');
}
function localJsonFallback(){return JSON.stringify({localKnowledgeOnly:true,combined:{confidence:0,summary:'Chưa có phản hồi thị giác mới; không tự tạo đặc điểm hình ảnh.'}});}
async function isTransientGeminiFailure(response){if(!response)return true;if([408,409,425,429,500,502,503,504].includes(response.status))return true;if(response.ok)return false;try{return /high demand|temporar|unavailable|resource[_ ]?exhausted|try again|overload|timeout/i.test(await response.clone().text());}catch{return false;}}
async function timedBufferedFetch(input,init,timeoutMs){
  const started=Date.now(),controller=!init?.signal&&timeoutMs?new AbortController():null,timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
  try{
    const response=await nativeFetch(input,controller?{...init,signal:controller.signal}:init);
    const firstResponseMs=Date.now()-started;
    const body=await response.text();
    const totalMs=Date.now()-started;
    const headers=new Headers(response.headers);headers.set('x-ai-first-response-ms',String(firstResponseMs));headers.set('x-ai-total-ms',String(totalMs));
    return new Response(body,{status:response.status,statusText:response.statusText,headers});
  }catch(err){if(err?.name==='AbortError'){const e=new Error('UPSTREAM_TIMEOUT');e.status=504;throw e;}throw err;}finally{if(timer)clearTimeout(timer);}
}
function withMetricHeaders(response,meta={},extra={}){const headers=new Headers(response.headers);for(const [k,v] of Object.entries({...extra,'x-ai-evidence-count':meta?.retrievedEvidenceCount??0,'x-ai-prompt-bytes-before':meta?.promptBytesBefore??0,'x-ai-prompt-bytes-after':meta?.promptBytesAfter??0}))headers.set(k,String(v));return new Response(response.body,{status:response.status,statusText:response.statusText,headers});}
function logConsultationMetrics(response,meta={},extra={}){if(!meta)return;console.info('gemini_consultation_metrics',JSON.stringify({geminiFirstResponseMs:Number(response.headers.get('x-ai-first-response-ms'))||null,geminiTotalMs:Number(response.headers.get('x-ai-total-ms'))||null,geminiTimeout:Boolean(extra.geminiTimeout),fallbackUsed:Boolean(extra.fallbackUsed),retrievedEvidenceCount:meta.retrievedEvidenceCount,promptBytesBefore:meta.promptBytesBefore,promptBytesAfter:meta.promptBytesAfter,adaptive:Boolean(meta.adaptive)}));}
function localKnowledgeResponse(init,reason,elapsedMs,meta){const payload=requestPayload(init),prompt=promptFromPayload(payload),wantsJson=String(payload?.generationConfig?.responseMimeType||'').toLowerCase()==='application/json',text=wantsJson?localJsonFallback():localClinicalFallback(prompt),timeout=reason==='UPSTREAM_TIMEOUT';let response=new Response(JSON.stringify({candidates:[{content:{role:'model',parts:[{text}]},finishReason:'STOP'}],localFallback:{active:true,reason,model:GEMINI_MODEL,elapsedMs}}),{status:200,headers:{'content-type':'application/json','x-ai-fallback':'local-knowledge','x-ai-upstream-ms':String(elapsedMs||0),'x-ai-first-response-ms':String(elapsedMs||0),'x-ai-total-ms':String(elapsedMs||0),'x-ai-timeout':timeout?'1':'0'}});response=withMetricHeaders(response,meta);logConsultationMetrics(response,meta,{geminiTimeout:timeout,fallbackUsed:true});return response;}
function unavailableVisionResponse(reason,status=503,elapsedMs=0){return new Response(JSON.stringify({error:{code:status,status:'UNAVAILABLE',message:'VISION_ANALYSIS_TEMPORARILY_UNAVAILABLE'},visionStatus:'unavailable',reason,elapsedMs}),{status,headers:{'content-type':'application/json','x-ai-vision-status':'unavailable','x-ai-upstream-ms':String(elapsedMs||0)}});}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function geminiResilientFetch(input,init,url){
  const startedAt=Date.now(),candidate=replaceGeminiModel(url,GEMINI_MODEL),original=requestPayload(init),vision=hasInlineMedia(original),compacted=vision?{init,meta:null}:compactChatInit(init),effectiveInit=compacted.init,meta=compacted.meta,timeoutMs=vision?GEMINI_VISION_TIMEOUT_MS:GEMINI_TEXT_TIMEOUT_MS,maxAttempts=vision?GEMINI_VISION_MAX_ATTEMPTS:GEMINI_TEXT_MAX_ATTEMPTS;
  let lastResponse=null,lastError=null;
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    try{
      let response=await timedBufferedFetch(candidate,effectiveInit,timeoutMs);
      if(response.ok){if(meta){response=withMetricHeaders(response,meta,{'x-ai-timeout':'0','x-ai-fallback':'0'});logConsultationMetrics(response,meta,{geminiTimeout:false,fallbackUsed:false});}console.info('gemini_attempt_complete',JSON.stringify({model:GEMINI_MODEL,attempt,vision,status:response.status,firstResponseMs:Number(response.headers.get('x-ai-first-response-ms'))||null,totalMs:Number(response.headers.get('x-ai-total-ms'))||null}));return response;}
      if(!(await isTransientGeminiFailure(response)))return response;
      lastResponse=response;
    }catch(err){lastError=err;if(vision&&err?.message==='UPSTREAM_TIMEOUT')break;}
    if(attempt<maxAttempts)await sleep(300*attempt);
  }
  const elapsedMs=Date.now()-startedAt;
  if(vision){if(lastResponse)return unavailableVisionResponse(`HTTP_${lastResponse.status}`,lastResponse.status===429?503:lastResponse.status,elapsedMs);return unavailableVisionResponse(lastError?.message||'TRANSPORT_ERROR',lastError?.status===504?504:503,elapsedMs);}
  return localKnowledgeResponse(effectiveInit,lastResponse?`HTTP_${lastResponse.status}`:(lastError?.message||'TRANSPORT_ERROR'),elapsedMs,meta);
}

if(nativeFetch){globalThis.fetch=async(input,init={})=>{const url=requestUrl(input);if(isGeminiGenerate(url))return geminiResilientFetch(input,init,url);const timeoutMs=url.includes('.supabase.co')?15_000:0;if(!timeoutMs||init?.signal)return nativeFetch(input,init);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{return await nativeFetch(input,{...init,signal:controller.signal});}finally{clearTimeout(timer);}};}
