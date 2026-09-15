import { matchAtlas, ACADEMIC_PAGE_CORPUS } from './public/academic-signature.js';
import { directPatterns, evidenceFor, fuse } from './public/academic-fusion-core.js';
import { FUSION_VERSION, SOURCE, WEIGHTS } from './public/academic-source.js';

function scoreOf(signal){
  const n=Number(signal?.confidence);
  return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
}
function collectSignals(assessment){
  const arrays=[
    assessment?.combined?.generalSignals,
    assessment?.combined?.stomachPatternSignals,
    assessment?.top?.theoryAssessment?.generalSignals,
    assessment?.top?.theoryAssessment?.stomachPatternSignals
  ].filter(Array.isArray);
  const byLabel=new Map();
  for(const list of arrays) for(const signal of list){
    if(!signal||typeof signal!=='object')continue;
    const label=String(signal.label||'').trim();if(!label)continue;
    const key=label.toLowerCase(),prev=byLabel.get(key);
    if(!prev||scoreOf(signal)>scoreOf(prev))byLabel.set(key,signal);
  }
  return [...byLabel.values()];
}
function geminiLayer(assessment){
  const patternCandidates=collectSignals(assessment).map(signal=>({
    label:String(signal.label||'').trim(),
    directEvidence:String(signal.evidence||''),
    academicEvidence:String(signal.rule||signal.missingForConclusion||'Đối chiếu học thuật từ tầng Gemini trong phân tích hiện tại.'),
    missing:String(signal.missingForConclusion||''),
    score:scoreOf(signal)
  }));
  const cannotConclude=[
    ...(Array.isArray(assessment?.combined?.cannotConclude)?assessment.combined.cannotConclude:[]),
    ...(Array.isArray(assessment?.top?.theoryAssessment?.cannotConclude)?assessment.top.theoryAssessment.cannotConclude:[])
  ].map(String).filter(Boolean);
  return {academicSummary:String(assessment?.combined?.summary||''),patternCandidates,cannotConclude:[...new Set(cannotConclude)]};
}
export function applyAcademicFusion(assessment,body={}){
  const signature=body?.academicSignature&&typeof body.academicSignature==='object'?body.academicSignature:null;
  if(!signature)return assessment;
  const matches=matchAtlas(signature);
  const direct=directPatterns(assessment);
  const evidence=evidenceFor(direct);
  const fused=fuse(assessment,signature,matches,geminiLayer(assessment),evidence);
  fused.ml=fused.ml||{};
  fused.ml.featureVector=fused.ml.featureVector||{};
  fused.ml.featureVector.academic=fused.ml.featureVector.academic||{};
  fused.ml.featureVector.academic.corpus={
    ...ACADEMIC_PAGE_CORPUS,
    sourceDocument:SOURCE,
    clientSource:body?.academicSource||null,
    fusionVersion:FUSION_VERSION,
    weights:WEIGHTS,
    matchedAtlasPages:matches.map(m=>m.page)
  };
  return fused;
}
export const ACADEMIC_HEALTH=Object.freeze({
  enabled:true,
  source:'HD1',
  fusionVersion:FUSION_VERSION,
  indexedPages:ACADEMIC_PAGE_CORPUS.indexedPages,
  visualSignaturePages:ACADEMIC_PAGE_CORPUS.visualSignaturePages,
  corpusSha256:ACADEMIC_PAGE_CORPUS.pdfSha256,
  weights:WEIGHTS,
  minimumLayers:2,
  totalLayers:3
});