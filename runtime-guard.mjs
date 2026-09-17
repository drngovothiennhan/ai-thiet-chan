const nativeFetch=globalThis.fetch?.bind(globalThis);

const GEMINI_MODEL='gemini-3.8-flash';
const GEMINI_TEXT_FALLBACK_MODEL='gemini-3.6-flash';
const GEMINI_VISION_TIMEOUT_MS=8_000;
const GEMINI_TEXT_TIMEOUT_MS=12_000;
const GEMINI_TEXT_MAX_ATTEMPTS=2;
const GEMINI_VISION_MAX_ATTEMPTS=2;
process.env.GEMINI_MODEL=GEMINI_MODEL;
process.env.GEMINI_TEXT_FALLBACK_MODEL=GEMINI_TEXT_FALLBACK_MODEL;

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
    if(response.status===404&&/model|not found|not available|unsupported/i.test(text)) return true;
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
  return String(match[1]||'').split('\n').map(x=>x.trim()).filter(x=>x.startsWith('- ')).slice(0,18);
}
function cleanText(v){return String(v||'').trim();}
function compactUnique(items,limit=5){return [...new Set(items.map(cleanText).filter(Boolean))].slice(0,limit);}
function signalText(item){
  if(!item||typeof item!=='object') return '';
  return [cleanText(item.label),cleanText(item.evidence)].filter(Boolean).join(': ');
}
function normalizeSearchText(value){
  return String(value||'').toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}
function questionTokens(value){return [...new Set(normalizeSearchText(value).split(' ').filter(x=>x.length>=3))];}
function relevantKnowledge(lines,question,limit=3){
  const q=questionTokens(question);
  const ranked=(Array.isArray(lines)?lines:[]).map((line,index)=>{
    const hay=normalizeSearchText(line);let score=0;
    for(const token of q){if(hay.includes(token))score+=3;else if(hay.split(' ').some(x=>x.includes(token)||token.includes(x)))score+=1;}
    return {line,index,score};
  }).sort((a,b)=>b.score-a.score||a.index-b.index);
  const positive=ranked.filter(x=>x.score>0).slice(0,limit).map(x=>x.line);
  return positive.length?positive:ranked.slice(0,Math.min(2,limit)).map(x=>x.line);
}
function questionIntent(question){
  const q=normalizeSearchText(question);
  if(/reu|coating|lop phu|nhay|vua|troc|ban do|mat guong/.test(q)) return 'coating';
  if(/mau luoi|chat luoi|do nhat|do sam|trang nhot|xanh tim|tim/.test(q)) return 'tongue-color';
  if(/hinh dang|hinh the|map|gay|nut|han rang|dau rang|gai|diem do|ban u|le luoi/.test(q)) return 'shape';
  if(/mat duoi|tinh mach|mach duoi luoi|mach mau|gian mach|uon luon/.test(q)) return 'underside';
  if(/tin cay|confidence|chat luong|qc|anh mo|anh toi|anh sang|do net/.test(q)) return 'quality';
  if(/nguon|tai lieu|hoc lieu|doi chieu|tham khao/.test(q)) return 'sources';
  if(/the yhct|bien chung|han|nhiet|hu |thuc |thap|dam|u huyet|ty |vi |can khi/.test(` ${q} `)) return 'pattern';
  if(/tom tat|ket luan|nhan dinh|ket qua|giai thich|tong hop/.test(q)) return 'summary';
  return 'focused';
}
function localClinicalFallback(prompt){
  const assessment=extractAssessment(prompt);
  const question=extractedQuestion(prompt);
  const groundedKnowledge=extractGroundedKnowledge(prompt);
  const knowledgeMatches=relevantKnowledge(groundedKnowledge,question,3);
  const groundingProtocol=/\[CHAT_GROUNDING_PROTOCOL\]/.test(prompt);
  if(!assessment){
    const out=['Tham Vấn từ kho tri thức:'];
    if(knowledgeMatches.length) out.push(...knowledgeMatches);
    out.push('Chưa có đủ kết quả quan sát của ca hiện tại để gắn các quy tắc trên vào hình lưỡi cụ thể. Hãy hoàn tất phân tích ảnh; hệ thống sẽ đối chiếu tiếp mà không tự tạo đặc điểm hình ảnh.');
    const text=out.join('\n');
    return groundingProtocol?`GROUNDING=IN\n${text}`:text;
  }

  const top=assessment?.top||{};
  const bottom=assessment?.bottom||null;
  const combined=assessment?.combined||{};
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
  const intent=questionIntent(question);
  const out=[];

  if(intent==='tongue-color'){
    out.push('Về màu/chất lưỡi của ca hiện tại:');
    out.push(`• Màu chất lưỡi: ${cleanText(top.tongueColor)||'chưa xác định rõ từ kết quả ảnh'}.`);
    if(top.stasisMarks) out.push(`• Dấu ứ/trệ nhìn thấy: ${top.stasisMarks}.`);
  }else if(intent==='coating'){
    out.push('Về rêu lưỡi của ca hiện tại:');
    out.push(`• Màu rêu: ${cleanText(top.coatingColor)||'chưa xác định'}.`);
    out.push(`• Độ dày: ${cleanText(top.coatingThickness)||'chưa xác định'}; tính chất: ${cleanText(top.coatingTexture)||'chưa xác định'}; độ ẩm: ${cleanText(top.moisture)||'chưa xác định'}.`);
  }else if(intent==='shape'){
    out.push('Về hình thể lưỡi của ca hiện tại:');
    out.push(`• Hình thể: ${cleanText(top.shape)||'chưa xác định'}.`);
    if(top.fissures) out.push(`• Nứt: ${top.fissures}.`);
    if(top.toothmarks) out.push(`• Dấu răng: ${top.toothmarks}.`);
    if(top.pricklesSpots) out.push(`• Gai/điểm: ${top.pricklesSpots}.`);
  }else if(intent==='underside'){
    out.push('Về mặt dưới và mạch dưới lưỡi:');
    if(!bottom){
      out.push('• Ca hiện tại chưa có dữ liệu mặt dưới lưỡi, nên không kết luận đặc điểm tĩnh mạch dưới lưỡi.');
    }else{
      const vessels=bottom?.vessels||{};
      out.push(`• Màu mặt dưới: ${cleanText(bottom.undersideColor)||'chưa xác định'}.`);
      out.push(`• Mạch: màu ${cleanText(vessels.color)||'chưa xác định'}, mức nổi ${cleanText(vessels.prominence)||'chưa xác định'}, giãn ${cleanText(vessels.dilation)||'chưa xác định'}, uốn lượn ${cleanText(vessels.tortuosity)||'chưa xác định'}.`);
    }
  }else if(intent==='quality'){
    const confidence=Number(combined.confidence);
    out.push('Về chất lượng và độ tin cậy của ca hiện tại:');
    out.push(`• QC mặt trên: ${cleanText(top.quality)||'chưa xác định'}.`);
    if(Number.isFinite(confidence)) out.push(`• Độ tự tin nội bộ của A.I: ${Math.round(Math.max(0,Math.min(1,confidence))*100)}%; đây không phải độ chính xác chẩn đoán lâm sàng.`);
    if(limits.length) out.push(`• Giới hạn: ${limits.join(' | ')}.`);
  }else if(intent==='sources'){
    out.push('Nguồn/học liệu liên quan trực tiếp đến câu hỏi:');
    if(knowledgeMatches.length) out.push(...knowledgeMatches); else out.push('• Chưa truy xuất được dòng học liệu đủ liên quan để trích dẫn cho câu hỏi này.');
  }else if(intent==='pattern'){
    out.push('Về biện chứng YHCT từ dữ kiện hiện có:');
    if(signals.length) out.push(`• Tín hiệu phù hợp: ${signals.join(' | ')}.`); else out.push('• Chưa có đủ tín hiệu trong kết quả hiện tại để nêu một thể YHCT cụ thể.');
    if(limits.length) out.push(`• Còn thiếu/không thể kết luận: ${limits.join(' | ')}.`);
  }else if(intent==='summary'){
    out.push('Tóm tắt đúng ca hiện tại:');
    if(summary) out.push(`• ${summary}`);
    const key=[top.tongueColor&&`chất lưỡi ${top.tongueColor}`,top.coatingColor&&`rêu ${top.coatingColor}`,top.shape&&`hình thể ${top.shape}`].filter(Boolean);
    if(key.length) out.push(`• Dấu chính: ${key.join('; ')}.`);
  }else{
    out.push(`Trả lời theo câu hỏi hiện tại: ${question||'chưa xác định câu hỏi'}`);
    if(knowledgeMatches.length) out.push(...knowledgeMatches);
    if(summary) out.push(`• Liên hệ với ca đang phân tích: ${summary}`);
  }

  if(intent!=='sources'&&knowledgeMatches.length) out.push(`• Đối chiếu học liệu liên quan: ${knowledgeMatches.slice(0,2).join(' | ')}`);
  if(!['quality','pattern'].includes(intent)&&limits.length) out.push(`• Giới hạn cần giữ: ${limits.slice(0,2).join(' | ')}.`);
  if(skipped) out.push('• Do chưa bổ sung Thập vấn, mức biện chứng chỉ dựa trên thiệt tượng hiện có và cần xem là nhận định tham khảo.');
  if(wantsDetail&&signals.length&&intent!=='pattern') out.push(`• Đối chiếu YHCT mở rộng: ${signals.join(' | ')}.`);
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
function unavailableVisionResponse(reason,status=503,elapsedMs=0){
  console.warn('gemini_vision_unavailable',JSON.stringify({reason,model:GEMINI_MODEL,status,elapsedMs}));
  return new Response(JSON.stringify({error:{code:status,status:'UNAVAILABLE',message:'VISION_ANALYSIS_TEMPORARILY_UNAVAILABLE'},visionStatus:'unavailable',reason,elapsedMs}),{
    status,headers:{'content-type':'application/json','x-ai-vision-status':'unavailable','x-ai-upstream-ms':String(elapsedMs||0)}
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
  const startedAt=Date.now();
  const payload=requestPayload(init);
  const vision=hasInlineMedia(payload);
  const externalGeminiRequired=!vision&&requiresExternalGemini(payload);
  const timeoutMs=vision?GEMINI_VISION_TIMEOUT_MS:GEMINI_TEXT_TIMEOUT_MS;
  const models=vision?Array(GEMINI_VISION_MAX_ATTEMPTS).fill(GEMINI_MODEL):[GEMINI_MODEL,GEMINI_TEXT_FALLBACK_MODEL].slice(0,GEMINI_TEXT_MAX_ATTEMPTS);
  let lastResponse=null;
  let lastError=null;
  for(let index=0;index<models.length;index++){
    const attempt=index+1;
    const model=models[index];
    const candidate=replaceGeminiModel(url,model);
    const attemptStarted=Date.now();
    try{
      const response=await timedFetch(candidate,init,candidate,timeoutMs);
      const attemptMs=Date.now()-attemptStarted;
      if(response.ok){
        console.info('gemini_attempt_complete',JSON.stringify({model,attempt,vision,status:response.status,attemptMs,totalMs:Date.now()-startedAt}));
        if(!vision&&model!==GEMINI_MODEL) console.info('gemini_text_model_fallback',JSON.stringify({primaryModel:GEMINI_MODEL,model,attempt,totalMs:Date.now()-startedAt}));
        return response;
      }
      if(!(await isTransientGeminiFailure(response))){
        console.warn('gemini_nontransient_failure',JSON.stringify({status:response.status,model,attempt,vision,attemptMs,totalMs:Date.now()-startedAt}));
        return response;
      }
      lastResponse=response;
      console.warn('gemini_transient_failure',JSON.stringify({status:response.status,model,attempt,vision,attemptMs,totalMs:Date.now()-startedAt}));
    }catch(err){
      lastError=err;
      console.warn('gemini_transport_failure',JSON.stringify({model,error:err?.message||String(err),attempt,vision,attemptMs:Date.now()-attemptStarted,totalMs:Date.now()-startedAt}));
      if(vision&&err?.message==='UPSTREAM_TIMEOUT') break;
    }
    if(index<models.length-1) await sleep(300*attempt);
  }
  const elapsedMs=Date.now()-startedAt;
  if(vision){
    if(lastResponse) return unavailableVisionResponse(`HTTP_${lastResponse.status}`,lastResponse.status===429?503:lastResponse.status,elapsedMs);
    return unavailableVisionResponse(lastError?.message||'TRANSPORT_ERROR',lastError?.status===504?504:503,elapsedMs);
  }
  if(externalGeminiRequired){
    if(lastResponse)return unavailableTextResponse(`HTTP_${lastResponse.status}`,lastResponse.status===429?503:lastResponse.status,elapsedMs);
    return unavailableTextResponse(lastError?.message||'TRANSPORT_ERROR',lastError?.status===504?504:503,elapsedMs);
  }
  return localKnowledgeResponse(init,lastResponse?`HTTP_${lastResponse.status}`:(lastError?.message||'TRANSPORT_ERROR'),elapsedMs);
}

if(nativeFetch){
  globalThis.fetch=async(input,init={})=>{
    const url=requestUrl(input);
    if(isGeminiGenerate(url)) return geminiResilientFetch(input,init,url);
    const timeoutMs=url.includes('.supabase.co')?15_000:0;
    return timedFetch(input,init,url,timeoutMs);
  };
}
