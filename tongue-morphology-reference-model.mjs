export const MORPHOLOGY_REFERENCE_MODEL_VERSION='aitc-morphology-reference-v1';

const UNKNOWN='Không xác định';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
const unit=v=>clamp(v,0,1);
const q=(v,n=3)=>Number(Number(v||0).toFixed(n));
const qcGrade=qc=>['good','fair','poor'].includes(qc?.grade)?qc.grade:'poor';

export const MORPHOLOGY_REFERENCE_MODEL=Object.freeze({
  version:MORPHOLOGY_REFERENCE_MODEL_VERSION,
  role:'independent reference/comparator for size-shape-toothmark signals',
  productionAuthority:false,
  clinicalGold:false,
  modelWeightTraining:false,
  evidenceBasis:Object.freeze({
    internal:['TC1-022','DY1-019','DY1-020','DY1-026','DY1-047','DY1-048'],
    external:[
      'ISO 23961-1:2021 vocabulary for enlarged/thin tongue',
      'PMID 40025207 shape segmentation/classification',
      'PMID 35492602 tooth-mark weakly supervised recognition',
      'PMID 32368332 tooth-mark CNN recognition',
      'PMID 38452007 feature-level object detection',
      'PMID 36212950 expert-annotated multi-label tongue features'
    ]
  }),
  principles:Object.freeze([
    'Segment/validate the tongue ROI before shape interpretation.',
    'Do not infer absolute tongue size or thickness from an uncalibrated top-view 2D image.',
    'Use multiple geometry descriptors rather than aspect ratio alone.',
    'Tooth marks require repeated lateral contour indentation; bilateral support raises confidence.',
    'Localized darker edge color can support a suspicious tooth-mark region but cannot replace contour evidence by itself.',
    'Occluded edges, lip interference, poor QC or incomplete root/tip exposure must produce uncertainty rather than a forced label.',
    'Reference labels describe visible morphology only; they do not diagnose a syndrome or disease.'
  ]),
  thresholdStatus:'engineering reference gates derived from the current feature scale; not published clinical cutoffs'
});

function usableShape(spatial,qc){
  const s=spatial?.shapeMetrics||{};
  const edge=unit(s.edgeRowCoverage),roiH=unit(s.roiHeightRatio),roiW=unit(s.roiWidthRatio);
  const margins=unit(s.topMargin)>.012&&unit(s.bottomMargin)>.012;
  const enough=edge>=.60&&roiH>=.28&&roiW>=.18&&margins;
  return {enough,edge,roiH,roiW,margins};
}
function scoreAbove(v,soft,hard){
  if(!Number.isFinite(Number(v)))return 0;
  const n=Number(v);
  if(n<=soft)return 0;
  return clamp((n-soft)/Math.max(.001,hard-soft));
}
function scoreBelow(v,soft,hard){
  if(!Number.isFinite(Number(v))||Number(v)<=0)return 0;
  const n=Number(v);
  if(n>=soft)return 0;
  return clamp((soft-n)/Math.max(.001,soft-hard));
}
function normalizeCurrentShape(value){
  const t=String(value||'').toLocaleLowerCase('vi-VN');
  if(/rộng|mập|bệu|to tương đối/.test(t))return 'broad';
  if(/hẹp|gầy|thon|teo/.test(t))return 'narrow';
  if(/trung bình|bình thường|không thấy mập-gầy/.test(t))return 'typical';
  return 'unknown';
}
function normalizeCurrentToothmark(value){
  const t=String(value||'').toLocaleLowerCase('vi-VN');
  if(/có tín hiệu dấu răng|hằn răng|dấu răng rõ/.test(t)&&!/nghi/.test(t))return 'present';
  if(/nghi dấu răng/.test(t))return 'suspected';
  if(/không thấy dấu răng/.test(t))return 'absent';
  return 'unknown';
}
function compare(current,reference){
  if(current==='unknown'||reference==='unknown')return 'insufficient';
  if(current===reference)return 'aligned';
  if((current==='present'&&reference==='suspected')||(current==='suspected'&&reference==='present'))return 'partial';
  if((current==='broad'&&reference==='typical')||(current==='narrow'&&reference==='typical')||(current==='typical'&&['broad','narrow'].includes(reference)))return 'partial';
  return 'conflict';
}

export function evaluateMorphologyReference({spatial={},qc={},current={},capture={}}={}){
  const grade=qcGrade(qc);
  const valid=spatial&&typeof spatial==='object'&&['tongue-spatial-observation-v2','tongue-spatial-observation-v3','tongue-spatial-observation-v4'].includes(spatial.schemaVersion);
  if(!valid||grade==='poor'){
    return Object.freeze({
      version:MORPHOLOGY_REFERENCE_MODEL_VERSION,
      active:false,
      reason:valid?'qc-poor':'spatial-unavailable',
      productionAuthority:false,
      clinicalGold:false
    });
  }

  const shape=spatial.shapeMetrics||{},tm=spatial.toothmarkMetrics||{};
  const visibility=usableShape(spatial,qc);
  const aspect=Number(shape.aspect)||0,fill=unit(shape.areaFill),root=unit(shape.rootWidthRatio),mid=unit(shape.midWidthRatio),tip=unit(shape.tipWidthRatio);
  const meanWidth=unit(shape.meanWidthRatio),smoothness=unit(shape.contourSmoothness),centerDev=unit(shape.centerlineDeviation);
  const tipTaper=mid>0?clamp(tip/mid,0,1.5):0;
  const rootMid=mid>0?clamp(root/mid,0,1.5):0;

  const broadComponents=[
    scoreAbove(aspect,.64,.78),
    scoreAbove(mid,.72,.84),
    scoreAbove(fill,.48,.62),
    scoreAbove(root,.58,.76),
    scoreAbove(meanWidth,.54,.72)
  ];
  const narrowComponents=[
    scoreBelow(aspect,.64,.50),
    scoreBelow(mid,.74,.60),
    scoreBelow(fill,.50,.38),
    scoreBelow(root,.64,.48),
    scoreBelow(meanWidth,.58,.44)
  ];
  const broadScore=q(broadComponents.reduce((a,b)=>a+b,0)/broadComponents.length);
  const narrowScore=q(narrowComponents.reduce((a,b)=>a+b,0)/narrowComponents.length);
  const geometryStable=visibility.enough&&centerDev<=.14&&smoothness<=.22;

  let shapeClass='unknown',shapeLabel=UNKNOWN,shapeConfidence=null;
  if(geometryStable){
    if(broadScore>=.58&&broadScore>=narrowScore+.18){
      shapeClass='broad';shapeLabel='Bản lưỡi rộng/đầy tương đối theo ảnh 2D';
      shapeConfidence=q((grade==='good'?.88:.68)*(.70+.30*broadScore));
    }else if(narrowScore>=.58&&narrowScore>=broadScore+.18){
      shapeClass='narrow';shapeLabel='Bản lưỡi hẹp/gầy tương đối theo ảnh 2D';
      shapeConfidence=q((grade==='good'?.88:.68)*(.70+.30*narrowScore));
    }else{
      shapeClass='typical';shapeLabel='Hình thể tương đối trung gian, chưa thấy rộng/mập hoặc hẹp/gầy rõ';
      shapeConfidence=q((grade==='good'?.82:.64)*(1-Math.min(.35,Math.abs(broadScore-narrowScore))));
    }
  }

  const knownScale=Boolean(capture?.knownScale);
  const mouthReference=Boolean(capture?.mouthReferenceVisible);
  const physicalSize=Object.freeze({
    label:knownScale&&mouthReference?'có tham chiếu kích thước nhưng ảnh mặt trên vẫn không đo trực tiếp độ dày':'không đánh giá kích thước tuyệt đối/độ dày từ ảnh mặt trên 2D',
    enlargedConfirmed:false,
    thinConfirmed:false,
    reason:'Khái niệm enlarged/thin bao gồm kích thước và/hoặc độ dày; ảnh 2D không chuẩn tỷ lệ chỉ cho phép mô tả tương đối.'
  });

  const tScore=unit(tm.score),bilateral=unit(tm.bilateralScore),left=unit(tm.leftScore),right=unit(tm.rightScore);
  const leftEvents=Math.max(0,Number(tm.leftEvents)||0),rightEvents=Math.max(0,Number(tm.rightEvents)||0);
  const eventTotal=leftEvents+rightEvents;
  const color=tm.edgeColorSupport&&typeof tm.edgeColorSupport==='object'?tm.edgeColorSupport:{};
  const colorBilateral=unit(color.bilateralScore),leftColor=unit(color.leftScore),rightColor=unit(color.rightScore);
  const colorSupport=Math.max(colorBilateral,Math.min(leftColor,rightColor)*.9);
  const strongContour=visibility.edge>=.62&&tScore>=.62&&bilateral>=.34&&leftEvents>=2&&rightEvents>=2;
  const moderateContour=visibility.edge>=.58&&tScore>=.46&&eventTotal>=3&&(leftEvents>=1||rightEvents>=1);
  const colorAssisted=visibility.edge>=.58&&moderateContour&&colorSupport>=.24;
  const negativeContour=grade==='good'&&visibility.edge>=.68&&tScore<.28&&eventTotal<=1&&colorSupport<.18;

  let toothClass='unknown',toothLabel=UNKNOWN,toothConfidence=null;
  if(strongContour){
    toothClass='present';toothLabel='Có tín hiệu dấu răng theo chuẩn đối chiếu';
    toothConfidence=q(.90*(.72+.18*tScore+.10*Math.max(bilateral,colorSupport)));
  }else if(colorAssisted||moderateContour){
    toothClass='suspected';toothLabel='Nghi dấu răng; cần đối chiếu bờ lưỡi/ảnh rõ hơn';
    toothConfidence=q((grade==='good'?.74:.60)*(.72+.18*tScore+.10*colorSupport));
  }else if(negativeContour){
    toothClass='absent';toothLabel='Không thấy tín hiệu dấu răng rõ theo chuẩn đối chiếu';
    toothConfidence=.72;
  }

  const currentShape=normalizeCurrentShape(current?.shape);
  const currentToothmarks=normalizeCurrentToothmark(current?.toothmarks);
  const shapeAgreement=compare(currentShape,shapeClass);
  const toothmarkAgreement=compare(currentToothmarks,toothClass);
  const conflicts=[];
  if(shapeAgreement==='conflict')conflicts.push('shape');
  if(toothmarkAgreement==='conflict')conflicts.push('toothmarks');

  return Object.freeze({
    version:MORPHOLOGY_REFERENCE_MODEL_VERSION,
    active:true,
    productionAuthority:false,
    clinicalGold:false,
    thresholdStatus:MORPHOLOGY_REFERENCE_MODEL.thresholdStatus,
    shape:Object.freeze({
      class:shapeClass,label:shapeLabel,confidence:shapeConfidence,
      scores:Object.freeze({broad:broadScore,narrow:narrowScore}),
      geometry:Object.freeze({aspect:q(aspect),areaFill:q(fill),rootWidthRatio:q(root),midWidthRatio:q(mid),tipWidthRatio:q(tip),meanWidthRatio:q(meanWidth),tipTaperRatio:q(tipTaper),rootToMidRatio:q(rootMid),contourSmoothness:q(smoothness),centerlineDeviation:q(centerDev)}),
      visibility:Object.freeze(visibility),
      evidenceRule:'multi-feature geometry after ROI/edge visibility gate; aspect ratio alone is insufficient'
    }),
    physicalSize,
    toothmarks:Object.freeze({
      class:toothClass,label:toothLabel,confidence:toothConfidence,
      geometry:Object.freeze({score:q(tScore),bilateralScore:q(bilateral),leftScore:q(left),rightScore:q(right),leftEvents,rightEvents,eventTotal}),
      colorSupport:Object.freeze({bilateralScore:q(colorBilateral),leftScore:q(leftColor),rightScore:q(rightColor)}),
      evidenceRule:'repeated lateral concavity is primary; bilateral support strengthens; localized darker edge color is secondary support only'
    }),
    comparison:Object.freeze({
      current:Object.freeze({shape:currentShape,toothmarks:currentToothmarks}),
      reference:Object.freeze({shape:shapeClass,toothmarks:toothClass}),
      shapeAgreement,toothmarkAgreement,conflicts:Object.freeze(conflicts),
      use:'shadow/reference comparison only; do not overwrite production observation until reviewed'
    }),
    limitations:Object.freeze([
      'Không suy kích thước tuyệt đối hoặc độ dày thân lưỡi nếu không có chuẩn tỷ lệ/đo 3D.',
      'Môi che, tư thế thè lưỡi quá mạnh, méo phối cảnh và bờ lưỡi không đủ thấy làm giảm giá trị hình thể.',
      'Dấu răng là đặc trưng bờ bên; màu tối khu trú chỉ là tín hiệu hỗ trợ, không thay thế biến dạng đường bờ.',
      'Ngưỡng số trong mô hình là ngưỡng kỹ thuật nội bộ để shadow-test, không phải ngưỡng chẩn đoán lâm sàng đã được xác nhận.'
    ])
  });
}
