import {coarse,matchAtlas} from './public/academic-signature.js';
import {verifyClientVisualPayload} from './academic-server.mjs';
import {interpretSpatialObservation,SPATIAL_OBSERVATION_POLICY_VERSION} from './spatial-observation-policy.mjs';
import {interpretVentralObservation,VENTRAL_OBSERVATION_POLICY_VERSION} from './ventral-observation-policy.mjs';
import {interpretMoistureObservation,MOISTURE_OBSERVATION_POLICY_VERSION} from './moisture-observation-policy.mjs';
import {interpretTongueFeatureKnowledge,TONGUE_FEATURE_KNOWLEDGE_VERSION} from './tongue-feature-knowledge.mjs';
import {calibrateRealTongueFeatures,REAL_TONGUE_FEATURE_CALIBRATION_VERSION} from './real-tongue-feature-calibration.mjs';
import {evaluateMorphologyReference,MORPHOLOGY_REFERENCE_MODEL_VERSION} from './tongue-morphology-reference-model.mjs';

export const LOCAL_VISION_HEALTH=Object.freeze({
  engine:'local-vision-engine-v1',
  authority:'image-observation',
  geminiVision:false,
  inputContract:'verified-device-or-service-worker-visual-payload',
  semanticMode:'conservative-feature-mapping',
  modelRuntime:'planned-onnx-web-adapter',
  moistureObservationPolicy:MOISTURE_OBSERVATION_POLICY_VERSION,
  featureKnowledgePolicy:TONGUE_FEATURE_KNOWLEDGE_VERSION,
  featureRuleCalibration:REAL_TONGUE_FEATURE_CALIBRATION_VERSION,
  morphologyReferenceModel:MORPHOLOGY_REFERENCE_MODEL_VERSION,
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
function topObservation(signature,qc,matches,body={}){
  const c=coarse(signature);
  const confidence=reliability(qc,signature);
  const best=Array.isArray(matches)&&matches.length?matches[0]:null;
  const morphology=buildTongueMorphology(signature,qc);
  const spatialPolicy=interpretSpatialObservation(signature?.spatial||{},qc);
  const featureKnowledge=interpretTongueFeatureKnowledge(signature?.spatial||{},qc);
  const moistureObservation=interpretMoistureObservation(signature?.spatial?.moisture||{},qc);
  const featureCalibration=calibrateRealTongueFeatures({
    signature,
    spatial:signature?.spatial||{},
    qc,
    base:{
      bodyColor:featureKnowledge?.active&&featureKnowledge?.bodyColor?.label&&featureKnowledge.bodyColor.label!==UNKNOWN?String(featureKnowledge.bodyColor.label):(spatialPolicy?.active&&spatialPolicy?.bodyColorCandidate?String(spatialPolicy.bodyColorCandidate):(c.tongue||UNKNOWN)),
      coatingColor:spatialPolicy?.active&&spatialPolicy?.coatingColorCandidate?String(spatialPolicy.coatingColorCandidate):(c.coat||UNKNOWN),
      coatingThickness:featureKnowledge?.active&&featureKnowledge?.coatingThickness?.label&&featureKnowledge.coatingThickness.label!==UNKNOWN?String(featureKnowledge.coatingThickness.label):(spatialPolicy?.active&&spatialPolicy?.coatingThicknessCandidate?String(spatialPolicy.coatingThicknessCandidate):(c.thick||UNKNOWN)),
      coatingTexture:featureKnowledge?.active?String(featureKnowledge?.coatingTexture?.label||UNKNOWN):UNKNOWN,
      shape:featureKnowledge?.active?String(featureKnowledge?.shape?.label||UNKNOWN):UNKNOWN,
      toothmarks:featureKnowledge?.active?String(featureKnowledge?.toothmarks?.label||UNKNOWN):UNKNOWN
    }
  });
  const calibrated=featureCalibration?.active===true;
  const tongueColor=calibrated?String(featureCalibration.bodyColor?.label||UNKNOWN):(featureKnowledge?.active&&featureKnowledge?.bodyColor?.label&&featureKnowledge.bodyColor.label!==UNKNOWN?String(featureKnowledge.bodyColor.label):(spatialPolicy?.active&&spatialPolicy?.bodyColorCandidate?String(spatialPolicy.bodyColorCandidate):(c.tongue||UNKNOWN)));
  const coatingColor=calibrated?String(featureCalibration.coatingColor?.label||UNKNOWN):(spatialPolicy?.active&&spatialPolicy?.coatingColorCandidate?String(spatialPolicy.coatingColorCandidate):(c.coat||UNKNOWN));
  const coatingThickness=calibrated?String(featureCalibration.coatingThickness?.label||UNKNOWN):(featureKnowledge?.active&&featureKnowledge?.coatingThickness?.label&&featureKnowledge.coatingThickness.label!==UNKNOWN?String(featureKnowledge.coatingThickness.label):(spatialPolicy?.active&&spatialPolicy?.coatingThicknessCandidate?String(spatialPolicy.coatingThicknessCandidate):(c.thick||UNKNOWN)));
  const coatingDistribution=String(spatialPolicy?.coatingDistribution||UNKNOWN);
  const coatingTexture=calibrated?String(featureCalibration.coatingTexture?.label||UNKNOWN):(featureKnowledge?.active?String(featureKnowledge?.coatingTexture?.label||UNKNOWN):UNKNOWN);
  const shape=calibrated?String(featureCalibration.shape?.label||UNKNOWN):(featureKnowledge?.active?String(featureKnowledge?.shape?.label||UNKNOWN):UNKNOWN);
  const toothmarks=calibrated?String(featureCalibration.toothmarks?.label||UNKNOWN):(featureKnowledge?.active?String(featureKnowledge?.toothmarks?.label||UNKNOWN):UNKNOWN);
  if(featureKnowledge?.active||calibrated){
    morphology.toothmarks={status:toothmarks,confidence:calibrated?featureCalibration.toothmarks?.confidence:featureKnowledge?.toothmarks?.confidence,source:calibrated?REAL_TONGUE_FEATURE_CALIBRATION_VERSION:TONGUE_FEATURE_KNOWLEDGE_VERSION};
    morphology.swellingOrThinness={status:shape,confidence:calibrated?featureCalibration.shape?.confidence:featureKnowledge?.shape?.confidence,source:calibrated?REAL_TONGUE_FEATURE_CALIBRATION_VERSION:TONGUE_FEATURE_KNOWLEDGE_VERSION};
  }
  const morphologyReference=evaluateMorphologyReference({
    spatial:signature?.spatial||{},
    qc,
    current:{shape,toothmarks},
    capture:{
      knownScale:Boolean(body?.morphologyCalibration?.knownScale||body?.captureCalibration?.knownScale),
      mouthReferenceVisible:Boolean(body?.morphologyCalibration?.mouthReferenceVisible)
    }
  });
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
      wholeTongueVisible:featureKnowledge?.visibility?.wholeTongueVisible??null,
      rootVisible:featureKnowledge?.visibility?.rootVisible??null,
      framing:framing(qc),
      occlusion:'unknown',
      colorReliability:colorReliability(qc)
    },
    tongueColor,
    shape,
    coatingColor,
    coatingThickness,
    coatingDistribution,
    coatingTexture,
    moisture,
    moistureObservation,
    morphology,
    fissures:fissureCompatibilityText(morphology),
    toothmarks,
    pricklesSpots:calibrated?String(featureCalibration.pricklesSpots?.label||UNKNOWN):spotText(Boolean(c.spots)),
    stasisMarks:UNKNOWN,
    otherVisibleFeatures:[
      ...(morphology?.medianSulcus?.status==='visible-signal'?['Có tín hiệu rãnh dọc giữa theo trục đối xứng của lưỡi; không đồng nhất với nứt bệnh lý.']:[]),
      ...(coatingDistribution&&coatingDistribution!==UNKNOWN&&coatingDistribution!=='không rõ'?['Phân bố rêu: '+coatingDistribution+'.']:[]),
      ...(moistureObservation?.surface?.status&&moistureObservation.surface.status!=='unknown'?['Độ ẩm bề mặt: '+moisture+'; thân lưỡi '+String(moistureObservation?.body?.label||UNKNOWN)+'; rêu '+String(moistureObservation?.coating?.label||UNKNOWN)+'.']:[]),
      ...((featureKnowledge?.active||calibrated)?['Hình thể: '+shape+'; dấu răng: '+toothmarks+'; kết cấu rêu: '+coatingTexture+'.']:[]),
      ...(calibrated&&featureCalibration?.candidates?.patchyOrPeeling?['Phân bố rêu không đồng đều rõ; chỉ ghi nhận nghi bong/tróc, chưa xác định bong rêu.']:[]),
      ...(calibrated&&featureCalibration?.candidates?.lowCoating?['Rêu rất ít/không rõ trên ảnh đạt QC; không tự đồng nhất với lưỡi gương.']:[]),
      ...(best?['Đối chiếu atlas gần nhất '+Math.round(Number(best.similarity||0)*100)+'% (chỉ tham khảo hình ảnh).']:[])
    ],
    theoryAssessment:{generalSignals:[],stomachPatternSignals:[],cannotConclude:['Tầng thị giác không tự suy luận thể bệnh YHCT.']},
    featureCalibration,
    morphologyReference,
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
  const confidence=verified?Number(Math.min(.58,grade(qc)==='good'?.54:grade(qc)==='fair'?.42:.20).toFixed(3)):.12;
  const notes=[];
  const vesselRatio=Math.max(0,Math.min(1,Number(f?.vesselCandidateRatio)||0));
  const darkPurple=Math.max(0,Math.min(1,Number(f?.darkPurpleRatio)||0));
  const rb=Math.max(-1,Math.min(1,Number(f?.redBlueMinusGreen)||0));
  const color=bilateral?(darkPurple>=.035||rb>=.025?'Tím/xanh tím':'Tím nhạt'):UNKNOWN;
  const prominence=bilateral?(vesselRatio>=.075?'Nổi rõ':vesselRatio>=.025?'Thấy mức vừa':'Ít nổi'):UNKNOWN;
  let undersideColor=UNKNOWN;
  const mr=Number(f?.mucosaMeanR),mg=Number(f?.mucosaMeanG),mb=Number(f?.mucosaMeanB);
  if(verified&&Number.isFinite(mr)&&Number.isFinite(mg)&&Number.isFinite(mb)&&mr>0){
    undersideColor=mr>mg*1.08&&mr>mb*1.03?'hồng/đỏ nhạt':'hồng nhạt';
  }
  if(bilateral)notes.push('Ghi nhận cấu trúc mạch dưới lưỡi hai bên; màu '+color.toLowerCase()+', '+prominence.toLowerCase()+'. Đây là mô tả hình ảnh, không phải kết luận ứ trệ hay giãn mạch.');
  if(f)notes.push('Đặc trưng định lượng mặt dưới: vesselCandidateRatio='+f.vesselCandidateRatio+', darkPurpleRatio='+f.darkPurpleRatio+', bilateralBalance='+(f.bilateralBalance??'n/a')+'.');
  return {
    quality:grade(qc),
    visualValidity:{
      undersideVisible:bilateral?true:(verified?true:false),
      vesselsVisible:bilateral?true:(verified?false:null),
      framing:framing(qc),
      occlusion:'unknown',
      colorReliability:colorReliability(qc)
    },
    undersideColor,
    vessels:{
      visible:bilateral,
      color,
      prominence,
      dilation:bilateral?'Chưa đánh giá định lượng vì ảnh không có chuẩn kích thước tuyệt đối':UNKNOWN,
      tortuosity:bilateral?'Chưa đủ chuẩn hình học để kết luận ngoằn ngoèo':UNKNOWN,
      stasisSigns:bilateral?'Chỉ ghi nhận màu/cấu trúc; không tự suy ứ trệ':UNKNOWN,
      bilateralSignal:bilateral,
      policyVersion:VENTRAL_OBSERVATION_POLICY_VERSION,
      measurement:'Màu và mức nổi được mô tả định tính; kích thước/giãn cần chuẩn đo phù hợp.'
    },
    otherVisibleFeatures:notes,
    confidence,
    summary:bilateral?'Ảnh mặt dưới đã xác minh; thấy cấu trúc mạch hai bên màu '+color.toLowerCase()+', '+prominence.toLowerCase()+'.':verified?'Ảnh mặt dưới đã xác minh; chưa đạt gate cấu trúc mạch hai bên rõ.':'Chưa xác minh được đầy đủ payload mặt dưới.',
    limitations:['Không suy bệnh mạch máu, huyết ứ hoặc giãn tuyệt đối từ ảnh không có chuẩn kích thước.']
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
  const top=topObservation(signature,topQc,matches,body);
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
