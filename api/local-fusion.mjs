import {applyAcademicFusion} from '../academic-server.mjs';

const MAX_CONFIDENCE=.62;
function capNumber(v){const n=Number(v);return Number.isFinite(n)?Math.min(MAX_CONFIDENCE,Math.max(0,n)):v;}
function capSignals(list){if(!Array.isArray(list))return;for(const item of list)if(item&&typeof item==='object'&&'confidence'in item)item.confidence=capNumber(item.confidence);}
function capFallbackConfidence(assessment){
  if(!assessment||typeof assessment!=='object')return assessment;
  if(assessment.top){assessment.top.confidence=capNumber(assessment.top.confidence);capSignals(assessment.top?.theoryAssessment?.generalSignals);capSignals(assessment.top?.theoryAssessment?.stomachPatternSignals);}
  if(assessment.bottom){assessment.bottom.confidence=capNumber(assessment.bottom.confidence);}
  if(assessment.combined){assessment.combined.confidence=capNumber(assessment.combined.confidence);capSignals(assessment.combined.generalSignals);capSignals(assessment.combined.stomachPatternSignals);}
  assessment.ml=assessment.ml||{};
  assessment.ml.fallback={active:true,source:'local-open-source-vision-v1',confidenceCap:MAX_CONFIDENCE,policy:'model-observation-not-ground-truth'};
  return assessment;
}

export default function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    const assessment=req.body?.assessment;
    const body=req.body?.body||{};
    if(!assessment||typeof assessment!=='object')return res.status(400).json({error:'ASSESSMENT_REQUIRED'});
    if(!body?.academicSignature||typeof body.academicSignature!=='object')return res.status(200).json({ok:true,assessment:capFallbackConfidence(structuredClone(assessment)),academicFusion:false});
    let fused=applyAcademicFusion(structuredClone(assessment),body);
    fused=capFallbackConfidence(fused);
    return res.status(200).json({ok:true,assessment:fused,academicFusion:true});
  }catch(err){
    console.error('local_fusion_error',err?.message||err);
    return res.status(200).json({ok:true,assessment:capFallbackConfidence(structuredClone(req.body?.assessment||{})),academicFusion:false,error:'LOCAL_FUSION_DEGRADED'});
  }
}
