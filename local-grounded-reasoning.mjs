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
    unknownMustRemainUnknown:true
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
  if(text(sulcus.status)&&sulcus.status!=='unknown')out.push(`rãnh giữa: ${sulcus.status}`);
  if(text(fissure.status)&&fissure.status!=='unknown')out.push(`nứt: ${fissure.status}`);
  else if(fissure.legacyDarkLineSignal===true)out.push('có tín hiệu đường tối/rãnh nhưng chưa đủ căn cứ gọi là nứt');
  else out.push('nứt: chưa đủ căn cứ');
  return out.join('; ');
}
function topObservation(top={}){
  return [
    `chất lưỡi ${text(top.tongueColor)||UNKNOWN}`,
    `rêu ${text(top.coatingColor)||UNKNOWN} / ${text(top.coatingThickness)||UNKNOWN}`,
    `hình thể ${text(top.shape)||UNKNOWN}`,
    morphologyText(top),
    `dấu răng ${text(top.toothmarks)||UNKNOWN}`,
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
function sourceEvidence(assessment={},knowledgeText='',limit=4){
  const out=[];
  const fusion=assessment?.combined?.academicFusion||{};
  for(const e of list(fusion.evidence)){
    const source=text(e?.source),page=Number(e?.page),body=text(e?.text);
    if(!source||!body)continue;
    out.push(`[${source}${Number.isFinite(page)?`, tr. ${page}`:''}] ${body}`);
    if(out.length>=limit)return out;
  }
  for(const line of text(knowledgeText).split(/\r?\n/)){
    if(!/^\s*-\s*\[[^\]]+\]/.test(line))continue;
    out.push(line.replace(/^\s*-\s*/,'').trim());
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
  const sources=sourceEvidence(assessment,knowledgeText,4);
  const reply=[];

  if(/nut|ranh|fissure|crack/.test(q)){
    reply.push('Về rãnh/nứt: '+morphologyText(top)+'.');
    reply.push('Quy tắc hiện hành tách rãnh giữa khỏi nứt; tín hiệu đường tối đơn độc không được chuyển thành kết luận nứt.');
  }else if(/mat duoi|tinh mach|mach duoi luoi|sublingual|vein/.test(q)&&bottom){
    reply.push('Quan sát mặt dưới: '+bottomObservation(bottom)+'.');
  }else{
    reply.push('Quan sát cục bộ: '+topObservation(top)+'.');
    if(bottom)reply.push('Mặt dưới: '+bottomObservation(bottom)+'.');
  }

  if(signals.length){
    reply.push('Đối chiếu học thuật có căn cứ: '+signals.map(signalText).filter(Boolean).join(' | ')+'.');
  }else{
    reply.push('Đối chiếu học thuật hiện chưa đủ đồng thuận để nâng thành nhận định thể YHCT.');
  }

  if(text(combined.summary))reply.push('Tổng hợp: '+text(combined.summary));
  const cs=caseSummary(caseRetrieval);if(cs)reply.push(cs);
  if(limits.length)reply.push('Giới hạn: '+limits.join(' '));
  if(/nguon|tai lieu|tham khao|citation/.test(q)&&sources.length)reply.push('Nguồn đối chiếu: '+sources.join(' | '));

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

export function localGroundedReport({assessment,mode='normal',topQc={},bottomQc={}}={}){
  if(!assessment||typeof assessment!=='object')throw new Error('ANALYSIS_REQUIRED');
  const top=assessment.top||{},bottom=assessment.bottom||null,combined=assessment.combined||{};
  const signals=acceptedSignals(assessment);
  const limits=limitations(assessment);
  const lines=[
    'BÁO CÁO THIỆT CHẨN — PHÂN TÍCH CỤC BỘ',
    `1. Chất lượng ảnh mặt trên: ${text(top.quality)||text(topQc.grade)||'chưa xác định'}.`,
    '2. Quan sát mặt trên: '+topObservation(top)+'.'
  ];
  if(mode==='general'||bottom){
    lines.push(`3. Chất lượng ảnh mặt dưới: ${text(bottom?.quality)||text(bottomQc.grade)||'chưa xác định'}.`);
    lines.push('4. Quan sát mặt dưới: '+(bottom?bottomObservation(bottom):'chưa đủ dữ liệu')+'.');
    lines.push('5. Nhận định kết hợp: '+(text(combined.summary)||'Chưa đủ căn cứ để nâng mức kết luận.')+(signals.length?' '+signals.map(signalText).filter(Boolean).join(' | '):''));
    lines.push('6. Giới hạn: '+(limits.length?limits.join(' '):'Kết quả chỉ dùng cho học tập/tham khảo; không thay thế tứ chẩn và khám trực tiếp.'));
  }else{
    lines.push('3. Nhận định kết hợp: '+(text(combined.summary)||'Chưa đủ căn cứ để nâng mức kết luận.')+(signals.length?' '+signals.map(signalText).filter(Boolean).join(' | '):''));
    lines.push('4. Giới hạn: '+(limits.length?limits.join(' '):'Kết quả chỉ dùng cho học tập/tham khảo; không thay thế tứ chẩn và khám trực tiếp.'));
  }
  return Object.freeze({ok:true,report:lines.join('\n'),engine:LOCAL_REASONING_HEALTH.engine,grounding:'local-grounded',acceptedSignalCount:signals.length});
}
