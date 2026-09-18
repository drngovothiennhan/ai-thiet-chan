import {coarse,matchAtlas} from './public/academic-signature.js';
import {verifyClientVisualPayload} from './academic-server.mjs';

export const LOCAL_VISION_HEALTH=Object.freeze({
  engine:'local-vision-engine-v1',
  authority:'image-observation',
  geminiVision:false,
  inputContract:'verified-device-or-service-worker-visual-payload',
  semanticMode:'conservative-feature-mapping',
  modelRuntime:'planned-onnx-web-adapter',
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
  const darkLineSignal=Boolean(c.fissure);
  return {
    schemaVersion:'tongue-morphology-observation-v2',
    medianSulcus:{
      status:'unknown',
      prominence:'unknown',
      orientation:'unknown',
      source:'no-validated-spatial-classifier'
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
      interpretationPolicy:'Không được gọi là nứt lưỡi chỉ từ legacyDarkLineSignal; rãnh giữa rõ phải được tách riêng khỏi nứt bệnh lý.'
    },
    toothmarks:{status:'unknown',source:'no-validated-dedicated-classifier'},
    swellingOrThinness:{status:'unknown',source:'no-validated-dedicated-classifier'},
    qcGrade:grade(qc)
  };
}
function fissureCompatibilityText(morphology){
  const fissure=morphology?.fissure||{};
  if(fissure.status==='confirmed') return 'Có nứt lưỡi đã được tầng thị giác xác nhận.';
  if(fissure.status==='likely') return 'Nghi nứt lưỡi; cần đối chiếu cấu trúc rãnh và ảnh rõ hơn.';
  if(fissure.legacyDarkLineSignal) return 'Có tín hiệu đường tối/rãnh; chưa đủ căn cứ gọi là nứt lưỡi.';
  return 'Chưa đủ căn cứ đánh giá nứt lưỡi.';
}
function spotText(value){return value?'Có tín hiệu điểm đỏ/gai cần đối chiếu':'Không thấy tín hiệu điểm đỏ/gai nổi bật';}
function topObservation(signature,qc,matches){
  const c=coarse(signature);
  const confidence=reliability(qc,signature);
  const best=Array.isArray(matches)&&matches.length?matches[0]:null;
  const morphology=buildTongueMorphology(signature,qc);
  const limitations=[
    'Tầng thị giác hiện tại chỉ khẳng định các đặc trưng đã được trích xuất trực tiếp; các trường chưa có mô hình chuyên biệt được để Không xác định.',
    'Độ tương đồng atlas là đối chiếu hình ảnh, không phải chẩn đoán.',
    'Tín hiệu điểm tối thô không được phép tự chuyển thành kết luận nứt lưỡi; rãnh giữa và nứt phải được tách riêng.'
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
    tongueColor:c.tongue||UNKNOWN,
    shape:UNKNOWN,
    coatingColor:c.coat||UNKNOWN,
    coatingThickness:c.thick||UNKNOWN,
    coatingTexture:UNKNOWN,
    moisture:UNKNOWN,
    morphology,
    fissures:fissureCompatibilityText(morphology),
    toothmarks:UNKNOWN,
    pricklesSpots:spotText(Boolean(c.spots)),
    stasisMarks:UNKNOWN,
    otherVisibleFeatures:best?['Đối chiếu atlas gần nhất '+Math.round(Number(best.similarity||0)*100)+'% (chỉ tham khảo hình ảnh).']:[],
    theoryAssessment:{generalSignals:[],stomachPatternSignals:[],cannotConclude:['Tầng thị giác không tự suy luận thể bệnh YHCT.']},
    confidence,
    summary:'Thị giác cục bộ ghi nhận chất lưỡi '+(c.tongue||UNKNOWN)+', rêu '+(c.coat||UNKNOWN)+' '+(c.thick||UNKNOWN)+'; hình thái rãnh/nứt chưa được kết luận nếu chưa có bộ phân loại không gian chuyên biệt.',
    limitations
  };
}
function bottomObservation(verification,qc){
  const f=verification?.deviceCompute?.bottomFeatures||null;
  const verified=Boolean(verification?.deviceCompute?.bottomVerified);
  const confidence=verified?Number(Math.min(.45,grade(qc)==='good'?.42:grade(qc)==='fair'?.30:.16).toFixed(3)):.12;
  const notes=[];
  if(f)notes.push('Đặc trưng định lượng mặt dưới: vesselCandidateRatio='+f.vesselCandidateRatio+', darkPurpleRatio='+f.darkPurpleRatio+', meanCentralLuminance='+f.meanCentralLuminance+'.');
  return {
    quality:grade(qc),
    visualValidity:{
      undersideVisible:verified?null:false,
      vesselsVisible:null,
      framing:framing(qc),
      occlusion:'unknown',
      colorReliability:colorReliability(qc)
    },
    undersideColor:UNKNOWN,
    vessels:{visible:false,color:UNKNOWN,prominence:UNKNOWN,dilation:UNKNOWN,tortuosity:UNKNOWN,stasisSigns:UNKNOWN,measurement:'Chỉ mô tả định tính khi có mô hình quan sát đã được kiểm định và chuẩn kích thước phù hợp.'},
    otherVisibleFeatures:notes,
    confidence,
    summary:verified?'Đã xác minh ảnh mặt dưới và trích xuất đặc trưng định lượng; chưa ánh xạ sang kết luận hình thái khi chưa có mô hình chuyên biệt.':'Chưa xác minh được đầy đủ payload mặt dưới.',
    limitations:['Không suy diễn đặc điểm mạch dưới lưỡi từ đặc trưng số khi chưa có bộ phân loại đã được kiểm định.']
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
