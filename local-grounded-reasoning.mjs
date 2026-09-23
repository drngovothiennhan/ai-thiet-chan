export const LOCAL_REASONING_HEALTH=Object.freeze({
  engine:'aitc-local-grounded-reasoning-v1',
  provider:'local',
  requiresExternalProvider:false,
  visionAuthority:false,
  inputs:Object.freeze(['structured-local-vision','academic-fusion','knowledge-retrieval','case-retrieval']),
  policy:Object.freeze({
    noImageObservation:true,
    noSyntheticSymptoms:true,
    noDiseaseDiagnosis:true,
    noPrescription:true,
    unknownMustRemainUnknown:true,
    presentationProfile:'yhct-source-grounded-v1'
  })
});

const UNKNOWN='Không xác định';
function text(v){return String(v??'').trim();}
function list(v){return Array.isArray(v)?v.filter(Boolean):[];}
function uniq(values,limit=8){const out=[];const seen=new Set();for(const value of values){const t=text(value);if(!t)continue;const key=t.toLocaleLowerCase('vi-VN');if(seen.has(key))continue;seen.add(key);out.push(t);if(out.length>=limit)break;}return out;}
function normalize(v){return text(v).toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();}
function signalText(signal){
  if(!signal||typeof signal!=='object')return '';
  const label=text(signal.label);
  const evidence=text(signal.evidence||signal.directEvidence);
  const confidence=Number(signal.confidence??signal.score);
  const pct=Number.isFinite(confidence)?` (${Math.round(Math.max(0,Math.min(1,confidence))*100)}%)`:'';
  return label?(evidence?`${label}${pct}: ${evidence}`:`${label}${pct}`):'';
}
function morphologyText(top={}){
  const morphology=top.morphology&&typeof top.morphology==='object'?top.morphology:{};
  const fissure=morphology.fissure&&typeof morphology.fissure==='object'?morphology.fissure:{};
  const sulcus=morphology.medianSulcus&&typeof morphology.medianSulcus==='object'?morphology.medianSulcus:{};
  const out=[];
  if(sulcus.status==='visible-signal')out.push('rãnh giữa: có tín hiệu rãnh dọc giữa');
  else if(text(sulcus.status)&&sulcus.status!=='unknown')out.push(`rãnh giữa: ${sulcus.status}`);
  if(text(fissure.status)&&fissure.status!=='unknown')out.push(`nứt: ${fissure.status}`);
  else if(sulcus.status==='visible-signal')out.push('nứt: chưa đủ căn cứ; không đồng nhất rãnh giữa với nứt bệnh lý');
  else if(fissure.legacyDarkLineSignal===true)out.push('có tín hiệu đường tối/rãnh nhưng chưa đủ căn cứ gọi là nứt');
  else out.push('nứt: chưa đủ căn cứ');
  return out.join('; ');
}
function morphologyReferenceText(top={}){
  const ref=top.morphologyReference&&typeof top.morphologyReference==='object'?top.morphologyReference:null;
  if(!ref?.active)return '';
  const shape=ref.shape&&typeof ref.shape==='object'?ref.shape:{};
  const tooth=ref.toothmarks&&typeof ref.toothmarks==='object'?ref.toothmarks:{};
  const cmp=ref.comparison&&typeof ref.comparison==='object'?ref.comparison:{};
  const parts=[];
  if(text(shape.label)&&shape.label!=='Không xác định')parts.push('chuẩn hình thể '+shape.label);
  if(text(tooth.label)&&tooth.label!=='Không xác định')parts.push('chuẩn dấu răng '+tooth.label);
  if(text(cmp.shapeAgreement))parts.push('khớp hình thể='+cmp.shapeAgreement);
  if(text(cmp.toothmarkAgreement))parts.push('khớp dấu răng='+cmp.toothmarkAgreement);
  return parts.length?'đối chiếu shadow: '+parts.join(', ')+'; không ghi đè quan sát hiện hành':'';
}
function moistureText(top={}){
  const obs=top.moistureObservation&&typeof top.moistureObservation==='object'?top.moistureObservation:{};
  const surface=obs.surface&&typeof obs.surface==='object'?obs.surface:{};
  const body=obs.body&&typeof obs.body==='object'?obs.body:{};
  const coating=obs.coating&&typeof obs.coating==='object'?obs.coating:{};
  const qc=obs.qc&&typeof obs.qc==='object'?obs.qc:{};
  const label=node=>text(node.label)||UNKNOWN;
  const confidence=node=>Number.isFinite(Number(node.confidence))?' ('+Math.round(Math.max(0,Math.min(1,Number(node.confidence)))*100)+'%)':'';
  if(!obs.active||surface.status==='unknown'){
    return 'độ ẩm '+(text(top.moisture)||UNKNOWN)+'; thân '+label(body)+'; rêu '+label(coating)+'; QC '+(text(qc.quality)||'không đủ');
  }
  return 'độ ẩm bề mặt '+label(surface)+confidence(surface)+'; thân '+label(body)+confidence(body)+'; rêu '+label(coating)+confidence(coating)+'; QC reliability '+(Number.isFinite(Number(qc.reliability))?Math.round(Number(qc.reliability)*100)+'%':'không xác định');
}
function topObservation(top={}){
  return [
    `chất lưỡi ${text(top.tongueColor)||UNKNOWN}`,
    `rêu ${text(top.coatingColor)||UNKNOWN} / ${text(top.coatingThickness)||UNKNOWN}${text(top.coatingDistribution)?` / phân bố ${text(top.coatingDistribution)}`:''}`,
    `hình thể ${text(top.shape)||UNKNOWN}`,
    moistureText(top),
    morphologyText(top),
    `dấu răng ${text(top.toothmarks)||UNKNOWN}`,
    morphologyReferenceText(top),
    `điểm/gai ${text(top.pricklesSpots)||UNKNOWN}`,
    `dấu ứ ${text(top.stasisMarks)||UNKNOWN}`
  ].join('; ');
}
function bottomObservation(bottom={}){
  const vessels=bottom.vessels&&typeof bottom.vessels==='object'?bottom.vessels:{};
  return [
    `màu mặt dưới ${text(bottom.undersideColor)||UNKNOWN}`,
    `mạch nhìn thấy: ${vessels.visible===true?'có':vessels.visible===false?'chưa xác nhận':'chưa xác định'}`,
    `màu mạch ${text(vessels.color)||UNKNOWN}`,
    `mức nổi ${text(vessels.prominence)||UNKNOWN}`,
    `giãn ${text(vessels.dilation)||UNKNOWN}`,
    `uốn lượn ${text(vessels.tortuosity)||UNKNOWN}`
  ].join('; ');
}
function acceptedSignals(assessment={}){
  const fusion=assessment?.combined?.academicFusion||{};
  const fromFusion=list(fusion.acceptedPatterns).map(p=>({label:p.label,score:p.score,evidence:p.directEvidence||p.academicEvidence||''}));
  const fromCombined=list(assessment?.combined?.generalSignals);
  const fromTop=list(assessment?.top?.theoryAssessment?.generalSignals);
  const all=[...fromFusion,...fromCombined,...fromTop];
  const out=[];const seen=new Set();
  for(const item of all){const label=text(item?.label);if(!label)continue;const key=label.toLocaleLowerCase('vi-VN');if(seen.has(key))continue;seen.add(key);out.push(item);if(out.length>=5)break;}
  return out;
}
function limitations(assessment={}){
  return uniq([
    ...list(assessment?.top?.limitations),
    ...list(assessment?.bottom?.limitations),
    ...list(assessment?.combined?.cannotConclude),
    ...list(assessment?.top?.theoryAssessment?.cannotConclude)
  ],6);
}
function sourceEvidence(assessment={},knowledgeText='',limit=4,question=''){
  const out=[];
  const q=normalize(question);
  const ventralQuestion=/(mat duoi|tinh mach|mach duoi luoi|sublingual|vein)/.test(q);
  const knowledgeLines=text(knowledgeText).split(/\r?\n/)
    .filter(line=>/^\s*-\s*\[[^\]]+\]/.test(line))
    .map(line=>line.replace(/^\s*-\s*/,'').trim());
  if(ventralQuestion){
    for(const line of knowledgeLines){
      if(!/(mặt dưới|tĩnh mạch dưới lưỡi|mạch dưới lưỡi|sublingual)/iu.test(line))continue;
      out.push(line);if(out.length>=limit)return uniq(out,limit);
    }
  }
  const fusion=assessment?.combined?.academicFusion||{};
  for(const e of list(fusion.evidence)){
    const source=text(e?.source),page=Number(e?.page),body=text(e?.text);
    if(!source||!body)continue;
    if(ventralQuestion&&!/(mặt dưới|tĩnh mạch dưới lưỡi|mạch dưới lưỡi|sublingual)/iu.test(body))continue;
    out.push(`[${source}${Number.isFinite(page)?`, tr. ${page}`:''}] ${body}`);
    if(out.length>=limit)return uniq(out,limit);
  }
  for(const line of knowledgeLines){
    out.push(line);
    if(out.length>=limit)break;
  }
  return uniq(out,limit);
}
function caseSummary(caseRetrieval){
  const returned=Number(caseRetrieval?.returned||0);
  if(!returned)return '';
  const sources=uniq(list(caseRetrieval?.cases).map(x=>x?.sourceId),4);
  return `Đã đối chiếu ${returned} ca tương tự từ corpus${sources.length?` (${sources.join(', ')})`:''}; các ca này chỉ hỗ trợ so sánh lập luận, không phải gold và không được dùng để tự tạo triệu chứng.`;
}

export function localGroundedChat({assessment,message,knowledgeText='',caseRetrieval=null}={}){
  const question=text(message);
  if(!assessment||typeof assessment!=='object'){
    return Object.freeze({
      ok:true,
      reply:'Chưa có kết quả phân tích ảnh lưỡi để làm nền. Hãy phân tích ảnh trước; sau đó hệ thống sẽ đối chiếu kết quả cấu trúc với tài liệu học thuật đã nạp.',
      engine:LOCAL_REASONING_HEALTH.engine,
      grounding:'local-grounded',
      evidenceCount:0
    });
  }
  const top=assessment.top||{},bottom=assessment.bottom||null,combined=assessment.combined||{};
  const q=normalize(question);
  const signals=acceptedSignals(assessment);
  const limits=limitations(assessment);
  const sources=sourceEvidence(assessment,knowledgeText,4,question);
  const reply=[];

  if(/\b(?:do am|kho|uot|nhuan|moisture|wet|dry|gloss)\b/.test(q)){
    reply.push('Thiệt tượng về tân dịch/độ ẩm quan sát được: '+moistureText(top)+'.');
    reply.push('Tầng suy luận chỉ diễn giải tín hiệu gloss/texture đã qua QC của Local Vision; flash/cháy sáng không được đồng nhất với ướt và nứt đơn độc không được đồng nhất với khô.');
    if(top?.moistureObservation?.surface?.status==='unknown')reply.push('Ảnh hiện chưa đủ tín hiệu để gán nhãn khô/ướt; giữ Không xác định thay vì suy đoán.');
  }else if(/nut|ranh|fissure|crack/.test(q)){
    reply.push('Thiệt tượng về rãnh và nứt quan sát được: '+morphologyText(top)+'.');
    reply.push('Quy tắc hiện hành tách rãnh giữa khỏi nứt; tín hiệu đường tối đơn độc không được chuyển thành kết luận nứt.');
  }else if(/mat duoi|tinh mach|mach duoi luoi|sublingual|vein/.test(q)&&bottom){
    reply.push('Thiệt tượng mặt dưới quan sát được: '+bottomObservation(bottom)+'.');
  }else{
    reply.push('Thiệt tượng mặt trên quan sát được: '+topObservation(top)+'.');
    if(bottom)reply.push('Thiệt tượng mặt dưới: '+bottomObservation(bottom)+'.');
  }

  if(signals.length){
    reply.push('Đối chiếu y văn YHCT theo dữ kiện hiện có: '+signals.map(signalText).filter(Boolean).join(' | ')+'.');
  }else{
    reply.push('Đối chiếu y văn hiện chưa đủ căn cứ để biện chứng thành thể/chứng YHCT cụ thể; cần phối hợp thêm vọng, văn, vấn, thiết.');
  }

  if(text(combined.summary))reply.push('Tổng hợp theo dữ kiện hiện có: '+text(combined.summary));
  const cs=caseSummary(caseRetrieval);if(cs)reply.push(cs);
  if(limits.length)reply.push('Giới hạn: '+limits.join(' '));
  if(sources.length)reply.push('Căn cứ tài liệu đã truy hồi: '+sources.join(' | ')+'.');
  reply.push('Cách đọc kết quả: “chất lưỡi/thân lưỡi” là phần thân lưỡi; “rêu lưỡi” là lớp phủ bề mặt. Các thuật ngữ biện chứng YHCT chỉ là nhận định tham khảo khi được dữ kiện hỗ trợ; kết quả này không xác lập bệnh danh hiện đại.');

  return Object.freeze({
    ok:true,
    reply:reply.join('\n'),
    engine:LOCAL_REASONING_HEALTH.engine,
    grounding:'local-grounded',
    evidenceCount:sources.length,
    acceptedSignalCount:signals.length,
    caseCount:Number(caseRetrieval?.returned||0)
  });
}

function reportTopItems(top={}){
  const out=[];
  const push=(label,value)=>{const v=text(value);if(v&&!/không xác định|unknown/i.test(v))out.push(`${label}: ${v}`);};
  push('Màu thân lưỡi',top.tongueColor);push('Hình thể',top.shape);
  const coat=[text(top.coatingColor),text(top.coatingThickness),text(top.coatingDistribution),text(top.coatingTexture)].filter(v=>v&&!/không xác định|unknown/i.test(v));
  if(coat.length)out.push('Rêu lưỡi: '+coat.join(' · '));
  push('Độ ẩm',top.moisture);push('Dấu răng',top.toothmarks);push('Gai/điểm',top.pricklesSpots);push('Ban/điểm ứ',top.stasisMarks);
  const morph=morphologyText(top);if(morph)out.push('Rãnh/nứt: '+morph);
  return uniq(out,10);
}
function reportBottomItems(bottom={}){
  const v=bottom.vessels&&typeof bottom.vessels==='object'?bottom.vessels:{},out=[];
  const push=(label,value)=>{const x=text(value);if(x&&!/không xác định|unknown/i.test(x))out.push(`${label}: ${x}`);};
  push('Màu mặt dưới',bottom.undersideColor);
  if(v.visible===true)out.push('Mạch dưới lưỡi: thấy cấu trúc hai bên');
  push('Màu mạch',v.color);push('Mức nổi',v.prominence);
  if(text(v.dilation)&&!/không xác định|chưa đánh giá/i.test(text(v.dilation)))push('Giãn',v.dilation);
  if(text(v.tortuosity)&&!/không xác định|chưa đủ/i.test(text(v.tortuosity)))push('Uốn lượn',v.tortuosity);
  return uniq(out,8);
}
function reportSignalItems(signals=[]){
  return uniq(signals.map(signalText).filter(Boolean),6);
}
function discussionItems(summary=''){
  return uniq(text(summary).split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(Boolean),5);
}
export function localGroundedReport({assessment,mode='normal',topQc={},bottomQc={}}={}){
  if(!assessment||typeof assessment!=='object')throw new Error('ANALYSIS_REQUIRED');
  const top=assessment.top||{},bottom=assessment.bottom||null,combined=assessment.combined||{};
  const signals=acceptedSignals(assessment),limits=limitations(assessment);
  const general=mode==='general'||Boolean(bottom);
  const sections=[
    {title:'1. Chất lượng dữ liệu',items:uniq([
      `Mặt trên: ${text(top.quality)||text(topQc.grade)||'chưa xác định'}`,
      general?`Mặt dưới: ${text(bottom?.quality)||text(bottomQc.grade)||'chưa xác định'}`:''
    ],4)},
    {title:'2. Quan sát mặt trên lưỡi',items:reportTopItems(top)}
  ];
  if(general)sections.push({title:'3. Quan sát mặt dưới lưỡi',items:bottom?reportBottomItems(bottom):['Chưa đủ dữ liệu mặt dưới.']});
  const baseNo=general?4:3;
  const signalItems=reportSignalItems(signals);
  sections.push({title:`${baseNo}. Đối chiếu kiến thức YHCT`,items:signalItems.length?signalItems:['Chưa có tín hiệu y văn đủ mạnh để nâng mức quy nạp.']});
  const discussion=discussionItems(combined.summary);
  sections.push({title:`${baseNo+1}. Bàn luận`,items:discussion.length?discussion:['Chưa đủ căn cứ để nâng mức kết luận.']});
  sections.push({title:`${baseNo+2}. Giới hạn`,items:limits.length?uniq(limits,6):['Kết quả chỉ hỗ trợ học tập/tham khảo; không thay thế Tứ chẩn và khám trực tiếp.']});
  const lines=['BÁO CÁO THIỆT CHẨN — QUAN SÁT VÀ ĐỐI CHIẾU Y VĂN'];
  for(const section of sections){lines.push('',section.title);for(const item of section.items)lines.push('• '+item);}
  return Object.freeze({
    ok:true,report:lines.join('\n'),sections:Object.freeze(sections.map(s=>Object.freeze({title:s.title,items:Object.freeze([...s.items])}))),
    modeLabel:general?'Tổng quát · mặt trên + mặt dưới':'Bình thường · mặt trên',
    engine:LOCAL_REASONING_HEALTH.engine,grounding:'local-grounded',acceptedSignalCount:signals.length
  });
}
