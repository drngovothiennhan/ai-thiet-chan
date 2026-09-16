(()=>{
'use strict';
const priorFetch=window.fetch.bind(window);
const MAX_CONFIDENCE=.62;
let evidenceModulePromise=null;

function evidenceModule(){
  evidenceModulePromise ||= import('/academic-source.js').catch(()=>null);
  return evidenceModulePromise;
}
function clean(v){return String(v||'').trim();}
function low(v){return clean(v).toLocaleLowerCase('vi-VN');}
function cap(v,max=MAX_CONFIDENCE){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(max,n)):0;}
function observedTop(a){
  const t=a?.top||{};
  return [t.tongueColor,t.shape,t.coatingColor,t.coatingThickness,t.coatingTexture,t.moisture,t.fissures,t.toothmarks,t.pricklesSpots,t.stasisMarks].map(clean).filter(Boolean).join(' · ');
}
function observedBottom(a){
  const b=a?.bottom||{},v=b?.vessels||{};
  return [b.undersideColor,v.color,v.prominence,v.dilation,v.tortuosity,v.stasisSigns].map(clean).filter(Boolean).join(' · ');
}
function findRule(evidence,topics){
  const wanted=topics.map(low);
  let best=null,bestScore=-1;
  for(const item of evidence){
    const itemTopics=Array.isArray(item?.topics)?item.topics.map(low):[];
    const hay=[...itemTopics,low(item?.text)].join(' ');
    const score=wanted.reduce((n,t)=>n+(hay.includes(t)?1:0),0);
    if(score>bestScore){best=item;bestScore=score;}
  }
  return bestScore>0?best:null;
}
function makeSignal(label,evidenceText,rule,confidence){
  return {label,evidence:evidenceText,rule:clean(rule),confidence:cap(confidence)};
}
function addUnique(list,signal){
  const key=low(signal?.label);
  if(!key||list.some(x=>low(x?.label)===key))return;
  list.push(signal);
}
function bookSignals(assessment,evidence){
  const top=assessment?.top||{},bottom=assessment?.bottom||{},v=bottom?.vessels||{};
  const t=low(observedTop(assessment)),b=low(observedBottom(assessment));
  const out=[];
  const hasRed=/đỏ|đỏ|đỏ sẫm/.test(t),hasPale=/nhợt|nhạt/.test(t),hasYellow=/vàng/.test(t),hasWhite=/trắng/.test(t);
  const hasDry=/khô/.test(t),hasLittleCoat=/rất mỏng|ít rêu|khó tách|tróc|mất rêu|không thấy màu rêu nổi bật/.test(t);
  const hasThick=/rêu[^·]*dày|dày|nhầy|dính|bẩn/.test(t),hasPurple=/tím|ám tím|ứ/.test(t),hasTooth=/dấu răng|hằn răng/.test(t);
  const hasBroad=/bệu|rộng/.test(t),bottomStasis=/tím|xanh tím|giãn|ứ/.test(b);
  let rule;

  if(hasRed&&hasDry&&hasLittleCoat){
    rule=findRule(evidence,['âm hư','khô','tróc rêu']);
    addUnique(out,makeSignal('Tài liệu đã nạp: âm dịch/hư nhiệt cần đối chiếu',`Ảnh hiện tại: ${observedTop(assessment)}.`,rule?.text||'',.56));
  }
  if(hasRed&&hasYellow){
    rule=findRule(evidence,['nhiệt','rêu vàng']);
    addUnique(out,makeSignal('Tài liệu đã nạp: tín hiệu nhiệt cần đối chiếu',`Ảnh hiện tại: ${observedTop(assessment)}.`,rule?.text||'',.58));
  }
  if(hasPale&&hasWhite){
    rule=findRule(evidence,['hàn','rêu trắng','nhợt']);
    addUnique(out,makeSignal('Tài liệu đã nạp: tín hiệu hư/hàn cần đối chiếu',`Ảnh hiện tại: ${observedTop(assessment)}.`,rule?.text||'',.55));
  }
  if(hasPale&&(hasTooth||hasBroad)){
    rule=findRule(evidence,['khí hư','dấu răng','bệu']);
    addUnique(out,makeSignal('Tài liệu đã nạp: Tỳ khí/Tỳ dương hư cần đối chiếu',`Ảnh hiện tại: ${observedTop(assessment)}.`,rule?.text||'',.54));
  }
  if(hasPurple){
    rule=findRule(evidence,['huyết ứ','tím']);
    addUnique(out,makeSignal('Tài liệu đã nạp: khí huyết ứ trệ cần đối chiếu',`Ảnh hiện tại: ${observedTop(assessment)}.`,rule?.text||'',.56));
  }
  if(hasThick){
    rule=findRule(evidence,['rêu dày','nhầy','thấp']);
    addUnique(out,makeSignal('Tài liệu đã nạp: thấp trọc/đàm hoặc tích trệ cần đối chiếu',`Ảnh hiện tại: ${observedTop(assessment)}.`,rule?.text||'',.53));
  }
  if(bottomStasis){
    rule=findRule(evidence,['tĩnh mạch dưới lưỡi','huyết ứ','giãn']);
    addUnique(out,makeSignal('Tài liệu đã nạp: mạch dưới lưỡi cần đối chiếu ứ trệ',`Mặt dưới hiện tại: ${observedBottom(assessment)}.`,rule?.text||'',.54));
  }
  if(!out.length){
    rule=findRule(evidence,['chất lưỡi','rêu','kết hợp']);
    addUnique(out,makeSignal('Tài liệu đã nạp: nguyên tắc đọc thiệt tượng','Chưa có tổ hợp dấu đủ mạnh; hệ thống vẫn đối chiếu đồng thời chất lưỡi, rêu, độ ẩm và hình thể.',rule?.text||'Chất lưỡi và rêu cần được đọc phối hợp, không tách một dấu riêng lẻ khỏi toàn cảnh.',.42));
  }
  return out.slice(0,4);
}
function enrichFallback(data,evidence){
  const assessment=data?.assessment||data?.analysis;
  if(!assessment||!(data?.fallback||data?.localVision||assessment?.ml?.fallback?.active))return data;
  assessment.combined=assessment.combined||{};
  const existing=Array.isArray(assessment.combined.generalSignals)?assessment.combined.generalSignals:[];
  const signals=[...existing];
  for(const signal of bookSignals(assessment,evidence))addUnique(signals,signal);
  assessment.combined.generalSignals=signals;
  const marker='Đã đối chiếu kho tài liệu đã nạp trong chế độ dự phòng không dùng Gemini.';
  const summary=clean(assessment.combined.summary||assessment?.top?.summary);
  if(!summary.includes(marker))assessment.combined.summary=[summary,marker].filter(Boolean).join(' ');
  assessment.combined.bookGrounding={active:true,knowledgeVersion:data?.knowledgeVersion||assessment?.knowledgeVersion||'thiet-chan-kb-2026-09-15.5doc',evidenceCount:signals.filter(x=>low(x?.label).startsWith('tài liệu đã nạp:')).length,policy:'supplied-knowledge-paraphrase-no-citation-in-result'};
  assessment.ml=assessment.ml||{};
  assessment.ml.bookGrounding={...assessment.combined.bookGrounding,sourceCount:5,noGeminiFallback:true};
  data.assessment=assessment;data.analysis=assessment;data.bookGroundedFallback=true;
  return data;
}

window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:input?.url||'';
  const response=await priorFetch(input,init);
  if(!url.includes('/api/analyze')||String(init?.method||'GET').toUpperCase()!=='POST'||!response.ok)return response;
  let data;try{data=await response.clone().json();}catch{return response;}
  if(!(data?.fallback||data?.localVision||data?.assessment?.ml?.fallback?.active))return response;
  const mod=await evidenceModule();
  const evidence=Array.isArray(mod?.MODERN_EVIDENCE)?mod.MODERN_EVIDENCE:[];
  if(!evidence.length)return response;
  data=enrichFallback(data,evidence);
  const headers=new Headers(response.headers);
  headers.delete('content-length');headers.delete('content-encoding');headers.delete('etag');
  headers.set('content-type','application/json; charset=utf-8');headers.set('x-aitc-book-grounding','supplied-knowledge');
  return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers});
};
})();
