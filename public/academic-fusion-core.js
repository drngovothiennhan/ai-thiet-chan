import {MODERN_EVIDENCE,WEIGHTS,FUSION_VERSION,KNOWLEDGE_VERSION,SOURCE} from './academic-source.js';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
export function directPatterns(assessment){
  const t=assessment?.top||{};
  const bottom=assessment?.bottom||{};
  const value=v=>String(v??'').trim().toLocaleLowerCase('vi-VN');
  const unknown=v=>{
    const x=value(v);
    return !x||/(không xác định|chưa đủ căn cứ|chưa xác nhận|chưa thấy rõ|không thấy|không có|unknown|not assessable|chưa thể)/u.test(x);
  };
  const positive=(v,re)=>!unknown(v)&&re.test(value(v));
  const tongueColor=value(t.tongueColor);
  const coatingColor=value(t.coatingColor);
  const coatingThickness=value(t.coatingThickness);
  const coatingTexture=value(t.coatingTexture);
  const moisture=value(t.moisture);
  const shape=value(t.shape);
  const fissures=value(t?.morphology?.fissure?.status||t.fissures);
  const toothmarks=value(t.toothmarks);
  const stasisMarks=value(t.stasisMarks);
  const prickles=value(t.pricklesSpots);
  const vessels=bottom?.vessels||{};

  const out=[];
  const add=(label,ev,score,{warningEligible=true,missing=''}={})=>out.push({
    label,directEvidence:ev,score:clamp(score),warningEligible,missing
  });

  // "đỏ nhạt" is the normal light-red tongue-body descriptor in the KB and must
  // never be collapsed into "nhợt/nhạt" deficiency by substring matching.
  const lightRed=/đỏ nhạt|hồng nhạt/u.test(tongueColor);
  const pale=!lightRed&&positive(tongueColor,/(^|\s)(nhợt|trắng nhợt|trắng nhạt|nhạt trắng|trắng bệch)(\s|$)/u);
  const strongRed=positive(tongueColor,/đỏ/u)&&!lightRed&&!pale;
  const whiteCoat=positive(coatingColor,/trắng/u);
  const yellowCoat=positive(coatingColor,/vàng/u);
  const thinCoat=positive(coatingThickness,/mỏng/u);
  const thickCoat=positive(coatingThickness,/dày/u);
  const greasy=positive(coatingTexture,/nhầy|dính|bẩn|nhớt/u);
  const purpleTongue=positive(tongueColor,/tím|ám tím|xanh tím/u);
  const visibleStasis=positive(stasisMarks,/ứ|ban|điểm/u);
  const confirmedFissure=positive(fissures,/nứt|confirmed|visible/u);
  const dry=positive(moisture,/khô|thiên khô|táo/u);
  const moist=positive(moisture,/nhuận|ướt|ẩm/u);
  const explicitToothmarks=positive(toothmarks,/hằn răng|dấu răng/u);
  const puffy=positive(shape,/mập|bệu|phì|to/u);
  const thinBody=positive(shape,/gầy|mỏng/u);
  const redSpots=positive(prickles,/điểm đỏ|gai/u);
  const ventralPurple=positive(`${bottom?.undersideColor||''} ${vessels.color||''}`,/tím|xanh tím|ám tím/u);
  const ventralDilated=positive(vessels.dilation,/giãn|phình|căng/u);

  if(lightRed&&whiteCoat&&thinCoat){
    const score=.76+(moist?.06:0);
    add('Thiệt tượng gần bình thường / chưa nghiêng rõ thể bệnh','Chất lưỡi đỏ nhạt phối hợp rêu trắng mỏng'+(moist?' và độ ẩm còn nhuận.':'.'),score,{warningEligible:false});
  }
  if(whiteCoat&&thinCoat&&!strongRed){
    add('Tín hiệu biểu / hàn nhẹ cần đối chiếu thêm','Rêu trắng mỏng là dấu hỗ trợ yếu cho biểu/hàn; ảnh lưỡi đơn độc chưa đủ xác định thể.',lightRed?.50:pale?.58:.46,{warningEligible:false,missing:'Cần triệu chứng hàn/nhiệt, mạch và toàn bộ Tứ chẩn.'});
  }
  if(moist&&thinCoat&&!dry){
    add('Tín hiệu tân dịch bề mặt còn tương đối bảo tồn','Rêu mỏng và bề mặt còn nhuận/ẩm; chưa thấy dấu khô rõ từ trường quan sát hiện tại.',.60,{warningEligible:false});
  }

  if(pale&&whiteCoat){
    let score=.66+(moist?.06:0)+(explicitToothmarks?.08:0)+(puffy?.06:0);
    add('Tín hiệu hư hàn','Chất lưỡi nhợt/trắng nhợt phối hợp rêu trắng'+(moist?' và thiên nhuận.':'.'),score,{missing:'Cần đối chiếu sợ lạnh, tay chân lạnh, mệt, ăn kém, đại tiện và mạch.'});
  }
  if(pale&&thinBody){
    add('Tín hiệu khí huyết bất túc','Chất lưỡi nhợt phối hợp hình thể gầy/mỏng.',.70,{missing:'Cần triệu chứng toàn thân và mạch để củng cố.'});
  }
  if((explicitToothmarks||puffy)&&pale){
    add('Tín hiệu Tỳ khí/Tỳ dương hư kèm thấp','Nhợt phối hợp dấu răng/hình thể bệu; mức phù hợp tăng khi có rêu ướt hoặc dày.',.66+(moist?.06:0)+(thickCoat?.06:0),{missing:'Cần ăn uống, đại tiện, mệt/nặng người và mạch.'});
  }
  if(thickCoat||greasy){
    let score=.58+(thickCoat&&greasy?.10:0)+(yellowCoat?.07:0);
    add(yellowCoat?'Tín hiệu thấp nhiệt / đàm nhiệt cần đối chiếu':'Tín hiệu thấp trọc / đàm hoặc tích trệ',yellowCoat?'Rêu vàng phối hợp dày/nhầy/nhớt.':'Rêu dày/nhầy/dính cần đối chiếu thấp trọc, đàm hoặc tích trệ.',score,{missing:'Cần triệu chứng tiêu hóa, miệng, đại tiểu tiện và mạch.'});
  }
  if(strongRed&&yellowCoat){
    let score=.70+(dry?.07:0)+(redSpots?.05:0)+(thickCoat?.04:0);
    add('Tín hiệu nhiệt / thực nhiệt','Chất lưỡi đỏ phối hợp rêu vàng'+(dry?' và thiên khô.':'.'),score,{missing:'Cần triệu chứng nhiệt, khát, đại tiểu tiện và mạch.'});
  }
  if(strongRed&&confirmedFissure&&dry){
    add('Tín hiệu âm dịch hao tổn / nhiệt thương tân','Đỏ phối hợp nứt đã xác nhận và thiên khô.',.74+(thinCoat?.04:0),{missing:'Cần triệu chứng khô, hao tân dịch và mạch.'});
  }
  if(purpleTongue||visibleStasis){
    add('Tín hiệu khí huyết ứ trệ','Màu tím/ám tím hoặc dấu ứ nhìn thấy ở mặt trên.',.68+(purpleTongue&&visibleStasis?.08:0),{missing:'Cần vị trí đau, tính chất đau, sắc diện và mạch.'});
  }
  if(ventralPurple&&ventralDilated){
    add('Tín hiệu mạch dưới lưỡi ứ trệ cần đối chiếu','Mạch dưới lưỡi có màu tím/xanh tím kèm giãn thấy được.',.74,{missing:'Chỉ là tín hiệu đối chiếu YHCT; không suy bệnh mạch máu từ ảnh.'});
  }

  return out.sort((a,b)=>b.score-a.score).slice(0,8);
}
export function evidenceFor(patterns){
  const hay=patterns.map(p=>String(p?.label||'').toLowerCase()).filter(Boolean).join(' ');
  if(!hay)return [];
  const scored=MODERN_EVIDENCE.map(e=>{let s=0;for(const t of e.topics)if(hay.includes(t.toLowerCase()))s++;return{...e,s};}).sort((a,b)=>b.s-a.s||String(a.source).localeCompare(String(b.source))||a.page-b.page);
  return scored.filter(e=>e.s>0).slice(0,10);
}
export function extractJson(text){const s=String(text||'').replace(/^```json\s*/i,'').replace(/^```\s*/i,'').trim(),first=s.indexOf('{'),last=s.lastIndexOf('}');if(first<0||last<=first)return null;try{return JSON.parse(s.slice(first,last+1));}catch{return null;}}
export function fuse(assessment,sig,matches,reasoning,evidence){
  const direct=clamp(assessment?.combined?.confidence||assessment?.top?.confidence||0),atlas=clamp(matches[0]?.similarity||0);
  const reasoningPatterns=Array.isArray(reasoning?.patternCandidates)?reasoning.patternCandidates:[],directP=directPatterns(assessment),byLabel=new Map();
  for(const p of [...directP,...reasoningPatterns]){const key=String(p.label||'').trim();if(!key)continue;const prev=byLabel.get(key)||{label:key};byLabel.set(key,{...prev,...p});}
  const candidates=[...byLabel.values()].map(p=>{
    const gp=clamp(p.score||0),local=directP.find(x=>x.label===p.label),directScore=clamp(local?.score||0);
    const atlasSupport=atlas>=.72?.82:atlas>=.60?.64:atlas>=.50?.48:.25;
    const layers=[directScore>=.50,atlasSupport>=.55,gp>=.55].filter(Boolean).length;
    const weighted=clamp(.70*directScore+.20*gp+.10*atlasSupport);
    // Atlas similarity is supportive only; it may not raise a pattern by more than 8 points
    // above the structured observation score.
    const score=directScore?Math.min(directScore+.08,weighted):weighted;
    const accepted=(directScore>=.72)||(directScore>=.50&&layers>=2);
    return {...p,
      directEvidence:p.directEvidence||local?.directEvidence||'',
      atlasEvidence:atlas?(`Đối chiếu atlas hình ảnh ${Math.round(atlas*100)}% (chỉ hỗ trợ, không phải xác suất chẩn đoán)`):'',
      academicEvidence:p.academicEvidence||'',
      warningEligible:local?.warningEligible!==false&&p.warningEligible!==false,
      missing:p.missing||local?.missing||'',
      score:Number(score.toFixed(3)),accepted,layers
    };
  }).filter(p=>p.accepted).sort((a,b)=>b.score-a.score).slice(0,6);
  const academic=candidates.length?candidates.reduce((s,p)=>s+p.score,0)/candidates.length:clamp(reasoningPatterns[0]?.score||.35);
  const weighted=WEIGHTS.directImage*direct+WEIGHTS.atlasSimilarity*atlas+WEIGHTS.academicReasoning*academic,q=assessment?.top?.quality,cap=q==='good'?.88:q==='fair'?.62:.25;
  const finalConfidence=Math.max(0,Math.min(cap,direct+.08,weighted));
  const agreement=(direct>=.60&&atlas>=.68&&academic>=.60)?'strong':([direct>=.52,atlas>=.58,academic>=.52].filter(Boolean).length>=2?'moderate':'weak');
  const existing=Array.isArray(assessment?.combined?.generalSignals)?assessment.combined.generalSignals:[];
  const directReview=directP.map(p=>({
    label:p.label,
    evidence:p.directEvidence,
    rule:p.missing||'Mức phù hợp dấu hiệu nội bộ; không phải xác suất chẩn đoán.',
    confidence:Number(clamp(p.score).toFixed(3)),
    warningEligible:p.warningEligible!==false,
    evidenceLayers:['structured-observation']
  }));
  const candidateReview=candidates.map(p=>({
    label:p.label,
    evidence:[p.directEvidence,p.academicEvidence].filter(Boolean).join(' | '),
    rule:p.missing||'Đã đối chiếu quan sát cấu trúc với tri thức/atlas; không dùng độ giống atlas làm xác suất chẩn đoán.',
    confidence:p.score,
    warningEligible:p.warningEligible!==false,
    evidenceLayers:['structured-observation','knowledge',...(p.layers>=2?['atlas-support']:[])]
  }));
  const additions=[...directReview,...candidateReview].sort((a,b)=>(Number(b.confidence)||0)-(Number(a.confidence)||0));
  const merged=[...existing,...additions];
  const bySignal=new Map();
  for(const item of merged){
    const key=String(item?.label||'').trim().toLowerCase();if(!key)continue;
    const prev=bySignal.get(key);
    if(!prev||Number(item?.confidence||0)>Number(prev?.confidence||0))bySignal.set(key,item);
  }
  assessment.combined.generalSignals=[...bySignal.values()].sort((a,b)=>(Number(b.confidence)||0)-(Number(a.confidence)||0)).slice(0,8);
  assessment.combined.confidence=Number(finalConfidence.toFixed(3));
  const base=String(assessment.combined.summary||assessment?.top?.summary||'').trim();
  const tail=agreement==='strong'?'Đối chiếu học thuật đa lớp có độ đồng thuận cao.':agreement==='moderate'?'Đối chiếu học thuật đa lớp có độ đồng thuận trung bình; vẫn cần Vấn chẩn/Tứ chẩn để củng cố.':'Đối chiếu học thuật đa lớp còn yếu hoặc không đồng nhất; không nâng mức kết luận.';
  assessment.combined.summary=[base,tail].filter(Boolean).join(' ');
  assessment.combined.academicFusion={version:FUSION_VERSION,knowledgeVersion:KNOWLEDGE_VERSION,weights:WEIGHTS,agreement,finalConfidence:Number(finalConfidence.toFixed(3)),sourceDocument:SOURCE,atlasMatches:matches.map(m=>({id:m.id,sourceId:m.sourceId,page:m.page,kind:m.kind,similarity:m.similarity,hash:m.hash,usage:'visual-similarity-only'})),evidence:evidence.map(e=>({source:e.source,page:e.page,text:e.text})),academicReasoning:reasoning||null,acceptedPatterns:candidates.map(p=>({label:p.label,score:p.score,layers:p.layers,warningEligible:p.warningEligible!==false,missing:p.missing||''})),reviewPatterns:directP.map(p=>({label:p.label,score:p.score,warningEligible:p.warningEligible!==false,missing:p.missing||''})),rule:'Không chuyển bệnh danh ca atlas thành chẩn đoán; chỉ nhận định khi ít nhất 2/3 lớp bằng chứng đồng thuận.'};
  assessment.ml=assessment.ml||{};assessment.ml.academicFusion=assessment.combined.academicFusion;
  if(assessment.ml.featureVector)assessment.ml.featureVector.academic={source:'KNOWLEDGE-5DOC',signature:sig,atlasMatches:assessment.combined.academicFusion.atlasMatches,acceptedPatterns:assessment.combined.academicFusion.acceptedPatterns};
  return assessment;
}
