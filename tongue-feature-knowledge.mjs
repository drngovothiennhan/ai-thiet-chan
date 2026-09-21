export const TONGUE_FEATURE_KNOWLEDGE_VERSION='tongue-feature-knowledge-v1';

const UNKNOWN='Không xác định';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
const unit=v=>clamp(v,0,1);
const q=(v,n=3)=>Number(Number(v||0).toFixed(n));

export const TONGUE_FEATURE_DEFINITIONS=Object.freeze({
  bodyColor:Object.freeze({
    normalLightRed:'Đỏ nhạt/hồng nhạt: màu nền thân lưỡi sinh lý thường gặp; không đồng nghĩa nhợt.',
    pale:'Nhợt/trắng nhợt: giảm sắc đỏ của thân lưỡi sau chuẩn hóa màu; chỉ là đặc điểm quan sát.',
    red:'Đỏ/đỏ sẫm: tăng sắc đỏ rõ so với nền đỏ nhạt; cần kiểm soát ánh sáng và cân bằng trắng.',
    sources:['TC1-007','TC1-009','DY1-018','OA07-E01']
  }),
  coatingThickness:Object.freeze({
    thin:'Rêu mỏng: còn thấy màu/chất lưỡi qua lớp rêu hoặc vùng phủ không che lấp đáng kể nền thân lưỡi.',
    thick:'Rêu dày: vùng phủ rêu chiếm diện tích/độ đục đủ lớn làm giảm thấy nền thân lưỡi, thường rõ ở trung tâm–sau.',
    sources:['TC1-008','DY1-024','DY1-027','OA09-E01']
  }),
  shape:Object.freeze({
    broad:'Bản rộng/mập theo hình chiếu 2D: thân lưỡi có bề ngang trung tâm lớn, bờ bên tương đối đầy; không đồng nghĩa phù/giãn thể tích thật.',
    thin:'Hẹp/gầy theo hình chiếu 2D: tỷ lệ bề ngang so với chiều dài thấp; không suy khối lượng hay bệnh danh.',
    sources:['DY1-019','DY1-026','OA10-E01']
  }),
  moisture:Object.freeze({
    moist:'Nhuận/ướt: có tín hiệu bóng phân bố phù hợp lớp nước bọt sau khi loại nguy cơ flash/cháy sáng.',
    dry:'Khô: giảm bóng kèm vi-kết cấu thô/lì; nứt đơn độc không đủ để gọi khô.',
    balanced:'Khô ướt vừa phải: mức bóng trung gian và kết cấu không quá thô.',
    sources:['TC1-008','DY1-024','OA17-E01','OA17-E04','OA18-E01','OA18-E02']
  }),
  toothmarks:Object.freeze({
    present:'Dấu răng: các lõm lặp lại dọc bờ bên, ưu tiên tín hiệu hai bên sau khi làm trơn đường biên; một lõm đơn độc không đủ.',
    absent:'Không thấy dấu răng rõ: bờ bên đủ thấy và không có mẫu lõm lặp lại vượt gate.',
    sources:['TC1-022','DY1-020','OA11-E01']
  }),
  coatingTexture:Object.freeze({
    even:'Khá đều: vùng rêu liên tục, độ thô thấp và không có tín hiệu mảng vụn/nhầy đủ mạnh.',
    rough:'Thô/không đều: vi-kết cấu biến thiên cao trong vùng rêu; chỉ là mô tả ảnh.',
    sources:['DY1-024','OA09-E01']
  })
});

function confidenceFromQc(qc){
  return qc?.grade==='good'?.88:qc?.grade==='fair'?.68:.32;
}
export function interpretTongueFeatureKnowledge(spatial={},qc={}){
  const valid=spatial&&typeof spatial==='object'&&['tongue-spatial-observation-v2','tongue-spatial-observation-v3'].includes(spatial.schemaVersion);
  const base=confidenceFromQc(qc);
  if(!valid||qc?.grade==='poor')return Object.freeze({
    version:TONGUE_FEATURE_KNOWLEDGE_VERSION,active:false,
    bodyColor:{label:UNKNOWN,confidence:null},coatingThickness:{label:UNKNOWN,confidence:null},
    shape:{label:UNKNOWN,confidence:null},toothmarks:{label:UNKNOWN,confidence:null},
    coatingTexture:{label:UNKNOWN,confidence:null},visibility:{wholeTongueVisible:null,rootVisible:null},
    reason:valid?'qc-poor':'spatial-unavailable'
  });
  const shape=spatial.shapeMetrics||{},tm=spatial.toothmarkMetrics||{};
  const aspect=Number(shape.aspect)||0,areaFill=unit(shape.areaFill),mid=unit(shape.midWidthRatio),root=unit(shape.rootWidthRatio),tip=unit(shape.tipWidthRatio),edgeCoverage=unit(shape.edgeRowCoverage);
  const coat=unit(spatial.coatingCandidateRatio),strict=unit(spatial.strictCoatingCandidateRatio);
  const coatThickness=String(spatial.coatingThicknessCandidate||'');
  const moisture=spatial.moisture||{},coatMoist=moisture.coating||{},surfaceMoist=moisture.surface||{};
  const rough=unit(coatMoist.roughness),gloss=unit(coatMoist.glossRatio);
  const bodyColor=['đỏ nhạt','đỏ','nhợt'].includes(spatial.bodyColorCandidate)?String(spatial.bodyColorCandidate):UNKNOWN;

  let shapeLabel='hình thể trung bình/không thấy mập-gầy rõ',shapeStrength=.56;
  if(aspect>=.70&&mid>=.78&&areaFill>=.54){shapeLabel='bản rộng/mập vừa (hình chiếu 2D)';shapeStrength=clamp(.62+(aspect-.70)*.55+(mid-.78)*.45);}
  else if(aspect>0&&aspect<=.56&&mid>0&&mid<=.68){shapeLabel='hẹp/gầy theo hình chiếu 2D';shapeStrength=clamp(.62+(.56-aspect)*.65+(.68-mid)*.45);}
  const shapeConfidence=q(base*(.72+.28*shapeStrength));

  const tScore=unit(tm.score),bilateral=unit(tm.bilateralScore);
  let toothLabel=UNKNOWN,toothStrength=0;
  if(edgeCoverage>=.58&&tScore>=.62&&bilateral>=.34){toothLabel='Có tín hiệu dấu răng';toothStrength=tScore;}
  else if(edgeCoverage>=.58&&tScore>=.46){toothLabel='Nghi dấu răng nhẹ';toothStrength=tScore*.88;}
  else if(edgeCoverage>=.66&&tScore<.30){toothLabel='Không thấy dấu răng rõ';toothStrength=.66;}
  const toothConfidence=toothLabel===UNKNOWN?null:q(base*(.64+.36*toothStrength));

  let thicknessLabel=coatThickness||UNKNOWN,thicknessStrength=.50;
  if(coat>=.40&&strict>=.18){thicknessLabel='dày';thicknessStrength=clamp(.68+(coat-.40)*.55);}
  else if(coat>=.10){thicknessLabel='mỏng';thicknessStrength=clamp(.62+(coat-.10)*.35);}
  else if(coat>=.05){thicknessLabel='rất mỏng';thicknessStrength=.58;}
  const thicknessConfidence=thicknessLabel===UNKNOWN?null:q(base*(.68+.32*thicknessStrength));

  let textureLabel=UNKNOWN,textureStrength=0;
  if(coat>=.10&&rough>0&&rough<=.052){textureLabel='khá đều';textureStrength=clamp(.64+(.052-rough)*3);}
  else if(coat>=.10&&rough>=.075){textureLabel='thô/không đều';textureStrength=clamp(.62+(rough-.075)*2.5);}
  const textureConfidence=textureLabel===UNKNOWN?null:q(base*(.65+.35*textureStrength));

  const roiH=unit(shape.roiHeightRatio),roiW=unit(shape.roiWidthRatio),topMargin=unit(shape.topMargin),bottomMargin=unit(shape.bottomMargin);
  const fullEnough=edgeCoverage>=.65&&roiH>=.30&&roiW>=.20&&topMargin>.015&&bottomMargin>.015;
  const rootLikely=fullEnough&&root>=.42;
  return Object.freeze({
    version:TONGUE_FEATURE_KNOWLEDGE_VERSION,active:true,
    bodyColor:Object.freeze({label:bodyColor,confidence:bodyColor===UNKNOWN?null:q(base*.86),source:'normalized-body-color-candidate'}),
    coatingThickness:Object.freeze({label:thicknessLabel,confidence:thicknessConfidence,coverage:q(coat),strictCoverage:q(strict)}),
    shape:Object.freeze({label:shapeLabel,confidence:shapeConfidence,metrics:Object.freeze({aspect:q(aspect),areaFill:q(areaFill),midWidthRatio:q(mid),rootWidthRatio:q(root),tipWidthRatio:q(tip)})}),
    toothmarks:Object.freeze({label:toothLabel,confidence:toothConfidence,score:q(tScore),bilateralScore:q(bilateral)}),
    coatingTexture:Object.freeze({label:textureLabel,confidence:textureConfidence,roughness:q(rough),glossRatio:q(gloss)}),
    visibility:Object.freeze({wholeTongueVisible:fullEnough?true:null,rootVisible:rootLikely?true:null}),
    calibration:'engineering-operational-definitions-from-internal-kb-not-clinical-gold',
    sources:Object.freeze(['TC1-007','TC1-008','TC1-009','TC1-022','DY1-018','DY1-019','DY1-020','DY1-024','OA07-E01','OA09-E01','OA10-E01','OA11-E01','OA17-E01','OA18-E01'])
  });
}
