const nativeFetch=globalThis.fetch?.bind(globalThis);

const GEMINI_MODEL='gemini-3.8-flash';
const GEMINI_TIMEOUT_MS=8_000;
process.env.GEMINI_MODEL=GEMINI_MODEL;
process.env.AI_RATE_LIMIT_MAX=String(Math.max(Number(process.env.AI_RATE_LIMIT_MAX||0),1_000_000));

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
  const evidenceText=evidence.length?evidence.join(' | '):'Đối chiếu nguyên tắc thiệt chẩn trong kho dữ liệu nội bộ đã nạp.';
  const top={
    quality:'poor',
    visualValidity:{tongueVisible:null,wholeTongueVisible:null,rootVisible:null,framing:'unknown',occlusion:'unknown',colorReliability:'unknown'},
    tongueColor:'Không tự gán khi chưa có xác nhận thị giác',shape:'Không tự gán khi chưa có xác nhận thị giác',coatingColor:'Không tự gán khi chưa có xác nhận thị giác',coatingThickness:'Không tự gán khi chưa có xác nhận thị giác',coatingTexture:'Không tự gán khi chưa có xác nhận thị giác',moisture:'Không tự gán khi chưa có xác nhận thị giác',fissures:'Không tự gán khi chưa có xác nhận thị giác',toothmarks:'Không tự gán khi chưa có xác nhận thị giác',pricklesSpots:'Không tự gán khi chưa có xác nhận thị giác',stasisMarks:'Không tự gán khi chưa có xác nhận thị giác',
    theoryAssessment:{generalSignals:[],stomachPatternSignals:[],cannotConclude:[]},
    otherVisibleFeatures:[],confidence:0.2,
    summary:`Chế độ suy luận nội bộ đang duy trì phiên. ${evidenceText}`,
    limitations:['Không tự tạo đặc điểm hình ảnh khi phản hồi thị giác từ Gemini vượt ngưỡng thời gian.']
  };
  return JSON.stringify({
    top,
    bottom:null,
    combined:{
      confidence:0.2,
      summary:`Tiếp tục biện luận từ kho dữ liệu nội bộ: ${evidenceText}`,
      generalSignals:[],stomachPatternSignals:[],
      cannotConclude:['Kết quả dự phòng chỉ dùng dữ liệu đã nạp và dữ kiện có sẵn; không tự gán dấu hiệu hình ảnh chưa được xác nhận.']
    }
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
async function timedFetch(input,init,url){
  const timeoutMs=url.includes('generativelanguage.googleapis.com')?GEMINI_TIMEOUT_MS:url.includes('.supabase.co')?15_000:0;
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
  const candidate=replaceGeminiModel(url,GEMINI_MODEL);
  try{
    const response=await timedFetch(candidate,init,candidate);
    if(response.ok) return response;
    if(!(await isTransientGeminiFailure(response))) return response;
    console.warn('gemini_transient_failure',JSON.stringify({status:response.status,model:GEMINI_MODEL}));
    return localKnowledgeResponse(init,`HTTP_${response.status}`);
  }catch(err){
    console.warn('gemini_transport_failure',JSON.stringify({model:GEMINI_MODEL,error:err?.message||String(err)}));
    return localKnowledgeResponse(init,err?.message||'TRANSPORT_ERROR');
  }
}

if(nativeFetch){
  globalThis.fetch=async(input,init={})=>{
    const url=requestUrl(input);
    if(isGeminiGenerate(url)) return geminiResilientFetch(input,init,url);
    return timedFetch(input,init,url);
  };
}
