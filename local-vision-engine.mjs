import {coarse,matchAtlas} from './public/academic-signature.js';
import {verifyClientVisualPayload} from './academic-server.mjs';
import {interpretSpatialObservation,SPATIAL_OBSERVATION_POLICY_VERSION} from './spatial-observation-policy.mjs';
import {interpretVentralObservation,VENTRAL_OBSERVATION_POLICY_VERSION} from './ventral-observation-policy.mjs';
import {interpretMoistureObservation,MOISTURE_OBSERVATION_POLICY_VERSION} from './moisture-observation-policy.mjs';

export const LOCAL_VISION_HEALTH=Object.freeze({
  engine:'local-vision-engine-v1',
  authority:'image-observation',
  geminiVision:false,
  inputContract:'verified-device-or-service-worker-visual-payload',
  semanticMode:'conservative-feature-mapping',
  modelRuntime:'planned-onnx-web-adapter',
  moistureObservationPolicy:MOISTURE_OBSERVATION_POLICY_VERSION,
  unsupportedClaims:['disease-diagnosis','pulse-inference','treatment','prescription']
});

const UNKNOWN='Không xác định';
function grade(qc){return ['good','fair','poor'].includes(qc?.grade)?qc.grade:'poor';}
function reliability(qc,signature){
  const q=grade(qc);
  const coverage=Math.max(0,Math.min(1,Number(signature?.coverage)||0));
  const base=q==='good'?.48:q==='fair'?.34:.18;
  const coverageTerm=Math.min(.12,coverage*.35);
  return Number(Math.min(.60,base+coverageTerm).toFixed(3));
}
function colorReliability(qc){return grade(qc);}
function framing(qc){return grade(qc);}
function buildTongueMorphology(signature,qc){
  const c=coarse(signature);
  const spatial=interpretSpatialObservation(signature?.spatial||{},qc);
  const sulcusVisible=spatial?.medianSulcus?.status==='visible-signal';
  const darkLineSignal=Boolean(c.fissure);
  return {
    schemaVersion:'tongue-morphology-observation-v3',
    medianSulcus:{
      status:sulcusVisible?'visible-signal':'unknown',
      prominence:sulcusVisible?'visible':'unknown',
      orientation:sulcusVisible?'longitudinal':'unknown',
      confidence:sulcusVisible?spatial.medianSulcus.confidence:null,
      source:spatial?.medianSulcus?.source||'no-validated-spatial-signal',
      policyVersion:SPATIAL_OBSERVATION_POLICY_VERSION
    },
    fissure:{
      status:'unknown',
      branching:'unknown',
      pattern:'unknown',
      location:'unknown',
      width:'unknown',
      depth:'not-assessable-from-2d-image',
      legacyDarkLineSignal:darkLineSignal,
      source:'legacy-dark-pixel-coarse-signal-only',
      interpretationPolicy:sulcusVisible?
        'Đã tách được tín hiệu rãnh dọc giữa; tín hiệu này không được tự chuyển thành nứt lưỡi bệnh lý.':
        'Không được gọi là nứt lưỡi chỉ từ legacyDarkLineSignal; rãnh giữa rõ phải được tách riêng khỏi nứt bệnh lý.'
    },
    toothmarks:{status:'unknown',source:'no-validated-dedicated-classifier'},
    swellingOrThinness:{status:'unknown',source:'no-validated-dedicated-classifier'},
    qcGrade:grade(qc)
  };
}
function fissureCompatibilityText(morphology){
  const fissure=morphology?.fissure||{};
  const sulcus=morphology?.medianSulcus||{};
  if(fissure.status==='confirmed') return 'Có nứt lưỡi đã được tầng thị giác xác nhận.';
  if(fissure.status==='likely') return 'Nghi nứt lưỡi; cần đối chiếu cấu trúc rãnh và ảnh rõ hơn.';
  if(sulcus.status==='visible-signal') return 'Có tín hiệu rãnh dọc giữa; chưa đủ căn cứ gọi là nứt lưỡi bệnh lý.';
  if(fissure.legacyDarkLineSignal) return 'Có tín hiệu đường tối/rãnh; chưa đủ căn cứ gọi là nứt lưỡi.';
  return 'Chưa đủ căn cứ đánh giá nứt lưỡi.';
}
function spotText(value){return value?'Có tín hiệu điểm đỏ/gai cần đối chiếu':'Không thấy tín hiệu điểm đỏ/gai nổi bật';}
function topObservation(signature,qc,matches){
  const c=coarse(signature);
  const confidence=reliability(qc,signature);
  const best=Array.isArray(matches)&&matches.length?matches[0]:null;
  const morphology=buildTongueMorphology(signature,qc);
  const spatialPolicy=interpretSpatialObservation(signature?.spatial||{},qc);
  const tongueColor=spatialPolicy?.active&&spatialPolicy?.bodyColorCandidate?String(spatialPolicy.bodyColorCandidate):(c.tongue||UNKNOWN);
  const coatingColor=spatialPolicy?.active&&spatialPolicy?.coatingColorCandidate?String(spatialPolicy.coatingColorCandidate):(c.coat||UNKNOWN);
  const coatingThickness=spatialPolicy?.active&&spatialPolicy?.coatingThicknessCandidate?String(spatialPolicy.coatingThicknessCandidate):(c.thick||UNKNOWN);
  const coatingDistribution=String(spatialPolicy?.coatingDistribution||UNKNOWN);
  const moistureObservation=interpretMoistureObservation(signature?.spatial?.moisture||{},qc);
  const moisture=String(moistureObservation?.surface?.label||UNKNOWN);
  const limitations=[
    'Tầng thị giác hiện tại chỉ khẳng định các đặc trưng đã được trích xuất trực tiếp; các trường chưa có mô hình chuyên biệt được để Không xác định.',
    'Độ tương đồng atlas là đối chiếu hình ảnh, không phải chẩn đoán.',
    'Tín hiệu điểm tối thô không được phép tự chuyển thành kết luận nứt lưỡi; rãnh giữa và nứt phải được tách riêng.',
    'Độ ẩm được đọc từ tín hiệu gloss + microtexture sau QC; flash/cháy sáng không được đồng nhất với lưỡi ướt và nứt đơn độc không được đồng nhất với lưỡi khô.'
  ];
  if(grade(qc)!=='good')limitations.push('Chất lượng ảnh chưa đạt mức tốt nên độ tin cậy quan sát bị giới hạn.');
  return {
    quality:grade(qc),
    visualValidity:{
      tongueVisible:true,
      wholeTongueVisible:null,
      rootVisible:null,
      framing:framing(qc),
      occlusion:'unknown',
      colorReliability:colorReliability(qc)
    },
    tongueColor,
    shape:UNKNOWN,
    coatingColor,
    coatingThickness,
    coatingDistribution,
    coatingTexture:UNKNOWN,
    moisture,
    moistureObservation,
    morphology,
    fissures:fissureCompatibilityText(morphology),
    toothmarks:UNKNOWN,
    pricklesSpots:spotText(Boolean(c.spots)),
    stasisMarks:UNKNOWN,
    otherVisibleFeatures:[
      ...(morphology?.medianSulcus?.status==='visible-signal'?['Có tín hiệu rãnh dọc giữa theo trục đối xứng của lưỡi; không đồng nhất với nứt bệnh lý.']:[]),
      ...(coatingDistribution&&coatingDistribution!==UNKNOWN&&coatingDistribution!=='không rõ'?['Phân bố rêu: '+coatingDistribution+'.']:[]),
      ...(moistureObservation?.surface?.status&&moistureObservation.surface.status!=='unknown'?['Độ ẩm bề mặt: '+moisture+'; thân lưỡi '+String(moistureObservation?.body?.label||UNKNOWN)+'; rêu '+String(moistureObservation?.coating?.label||UNKNOWN)+'.']:[]),
      ...(best?['Đối chiếu atlas gần nhất '+Math.round(Number(best.similarity||0)*100)+'% (chỉ tham khảo hình ảnh).']:[])
    ],
    theoryAssessment:{generalSignals:[],stomachPatternSignals:[],cannotConclude:['Tầng thị giác không tự suy luận thể bệnh YHCT.']},
    confidence,
    summary:'Thị giác cục bộ ghi nhận chất lưỡi '+tongueColor+', rêu '+coatingColor+' '+coatingThickness+(coatingDistribution&&coatingDistribution!==UNKNOWN&&coatingDistribution!=='không rõ'?', phân bố '+coatingDistribution:'')+'; độ ẩm '+moisture+'; '+(morphology?.medianSulcus?.status==='visible-signal'?'có tín hiệu rãnh dọc giữa nhưng chưa đủ căn cứ gọi là nứt bệnh lý.':'hình thái rãnh/nứt chưa đủ căn cứ kết luận.'),
    limitations
  };
}
function bottomObservation(verification,qc){
  const f=verification?.deviceCompute?.bottomFeatures||null;
  const verified=Boolean(verification?.deviceCompute?.bottomVerified);
  const ventral=interpretVentralObservation(f||{},qc);
  const bilateral=Boolean(verified&&ventral.bilateralStructureVisible===true);
  const confidence=verified?Number(Math.min(.45,grade(qc)==='good'?.42:grade(qc)==='fair'?.30:.16).toFixed(3)):.12;
  const notes=[];
  if(bilateral)notes.push('Ghi nhận tín hiệu cấu trúc mạch dưới lưỡi hai bên theo tương phản cục bộ; đây là quan sát hình ảnh, không phải kết luận ứ trệ hay giãn mạch.');
  if(f)notes.push('Đặc trưng định lượng mặt dưới: vesselCandidateRatio='+f.vesselCandidateRatio+', darkPurpleRatio='+f.darkPurpleRatio+', bilateralBalance='+(f.bilateralBalance??'n/a')+'.');
  return {
    quality:grade(qc),
    visualValidity:{
      undersideVisible:bilateral?true:(verified?null:false),
      vesselsVisible:bilateral?true:null,
      framing:framing(qc),
      occlusion:'unknown',
      colorReliability:colorReliability(qc)
    },
    undersideColor:UNKNOWN,
    vessels:{
      visible:bilateral,
      color:UNKNOWN,
      prominence:UNKNOWN,
      dilation:UNKNOWN,
      tortuosity:UNKNOWN,
      stasisSigns:UNKNOWN,
      bilateralSignal:bilateral,
      policyVersion:VENTRAL_OBSERVATION_POLICY_VERSION,
      measurement:'Chỉ mô tả cấu trúc nhìn thấy; không suy diễn kích thước, giãn, ngoằn ngoèo hoặc ứ trệ khi chưa có mô hình/chuẩn đo phù hợp.'
    },
    otherVisibleFeatures:notes,
    confidence,
    summary:bilateral?'Ảnh mặt dưới đã xác minh; ghi nhận tín hiệu cấu trúc mạch hai bên, chưa suy diễn dấu bệnh lý.':verified?'Đã xác minh ảnh mặt dưới và trích xuất đặc trưng định lượng; chưa đủ tín hiệu chuyên biệt để mô tả mạch.':'Chưa xác minh được đầy đủ payload mặt dưới.',
    limitations:['Quan sát mặt dưới chỉ dùng cho đặc trưng nhìn thấy; không quy đổi trực tiếp thành chẩn đoán YHCT, giãn mạch hay ứ trệ.']
  };
}
export function analyzeLocalVision(body={},options={}){
  const mode=options.mode==='general'?'general':'normal';
  const topQc=options.topQc||{};
  const bottomQc=options.bottomQc||{};
  const verification=verifyClientVisualPayload(body);
  if(!verification?.verified){
    const error=new Error('LOCAL_VISION_INPUT_UNVERIFIED:'+(verification?.reason||'unknown'));
    error.status=422;
    error.code='LOCAL_VISION_INPUT_UNVERIFIED';
    throw error;
  }
  const signature=verification.signature;
  const matches=matchAtlas(signature);
  const top=topObservation(signature,topQc,matches);
  const bottom=mode==='general'?bottomObservation(verification,bottomQc):null;
  const confidence=mode==='general'?Math.min(top.confidence,bottom?.confidence||top.confidence):top.confidence;
  const rawAssessment={
    mode,
    top,
    bottom,
    combined:{
      confidence:Number(confidence.toFixed(3)),
      summary:mode==='general'?(top.summary+' '+(bottom?.summary||'')).trim():top.summary,
      generalSignals:[],
      stomachPatternSignals:[],
      cannotConclude:['Gemini/LLM không được phép tạo quan sát hình ảnh; chỉ được phân tích kết quả cấu trúc sau khi tầng thị giác hoàn tất.']
    }
  };
  return {
    assessment:rawAssessment,
    provenance:{
      ...LOCAL_VISION_HEALTH,
      verificationMode:verification.mode,
      topSignature:signature,
      atlasMatches:matches.map(m=>({sourceId:m.sourceId,page:m.page,kind:m.kind,similarity:Number(m.similarity||0)})),
      deviceCompute:verification.deviceCompute||null
    }
  };
}
