import {matchAtlas,ACADEMIC_PAGE_CORPUS,corpusContext,searchTextCorpus} from './knowledge-corpus.mjs';
import {directPatterns,evidenceFor,fuse} from './public/academic-fusion-core.js';
import {FUSION_VERSION,SOURCE,WEIGHTS} from './public/academic-source.js';

function scoreOf(signal){const n=Number(signal?.confidence);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;}
function collectSignals(assessment){
  const arrays=[assessment?.combined?.generalSignals,assessment?.combined?.stomachPatternSignals,assessment?.top?.theoryAssessment?.generalSignals,assessment?.top?.theoryAssessment?.stomachPatternSignals].filter(Array.isArray);
  const byLabel=new Map();
  for(const list of arrays)for(const signal of list){if(!signal||typeof signal!=='object')continue;const label=String(signal.label||'').trim();if(!label)continue;const key=label.toLowerCase(),prev=byLabel.get(key);if(!prev||scoreOf(signal)>scoreOf(prev))byLabel.set(key,signal);}
  return [...byLabel.values()];
}
function geminiLayer(assessment){
  const patternCandidates=collectSignals(assessment).map(signal=>({label:String(signal.label||'').trim(),directEvidence:String(signal.evidence||''),academicEvidence:String(signal.rule||signal.missingForConclusion||'Đối chiếu học thuật từ tầng Gemini trong phân tích hiện tại.'),missing:String(signal.missingForConclusion||''),score:scoreOf(signal)}));
  const cannotConclude=[...(Array.isArray(assessment?.combined?.cannotConclude)?assessment.combined.cannotConclude:[]),...(Array.isArray(assessment?.top?.theoryAssessment?.cannotConclude)?assessment.top.theoryAssessment.cannotConclude:[])].map(String).filter(Boolean);
  return {academicSummary:String(assessment?.combined?.summary||''),patternCandidates,cannotConclude:[...new Set(cannotConclude)]};
}
export function applyAcademicFusion(assessment,body={}){
  const signature=body?.academicSignature&&typeof body.academicSignature==='object'?body.academicSignature:null;
  if(!signature)return assessment;
  const matches=matchAtlas(signature);
  const direct=directPatterns(assessment);
  const evidence=evidenceFor(direct);
  const query=[assessment?.combined?.summary,...direct.map(x=>x.label),...(assessment?.combined?.generalSignals||[]).map(x=>x?.label||'')].filter(Boolean).join(' ');
  const textMatches=searchTextCorpus(query,6);
  const visualContext=corpusContext(signature);
  const fused=fuse(assessment,signature,matches,geminiLayer(assessment),evidence);
  fused.ml=fused.ml||{};
  fused.ml.featureVector=fused.ml.featureVector||{};
  fused.ml.featureVector.academic=fused.ml.featureVector.academic||{};
  fused.ml.featureVector.academic.corpus={
    id:ACADEMIC_PAGE_CORPUS.id,
    folder:ACADEMIC_PAGE_CORPUS.folder,
    sourceCount:ACADEMIC_PAGE_CORPUS.sourceCount,
    sources:ACADEMIC_PAGE_CORPUS.sources.map(s=>({id:s.id,sha256:s.sha256,pages:s.pages,indexedPages:s.indexedPages,embeddedImageOccurrences:s.embeddedImageOccurrences,indexedImageOccurrences:s.indexedImageOccurrences,diagnosticVisualEligible:Boolean(s.diagnosticVisualEligible),negativeVisualContext:Boolean(s.negativeVisualContext)})),
    totals:ACADEMIC_PAGE_CORPUS.totals,
    policies:ACADEMIC_PAGE_CORPUS.policies,
    sourceDocument:SOURCE,
    clientSource:body?.academicSource||null,
    fusionVersion:FUSION_VERSION,
    weights:WEIGHTS,
    matchedAtlas:matches.map(m=>({sourceId:m.sourceId,page:m.page,kind:m.kind,hash:m.hash,similarity:m.similarity})),
    visualContext,
    textMatches
  };
  if(fused.combined?.academicFusion){fused.combined.academicFusion.corpusTextMatches=textMatches.map(x=>({sourceId:x.sourceId,page:x.page,score:x.score}));fused.combined.academicFusion.visualContext=visualContext;}
  return fused;
}
export const ACADEMIC_HEALTH=Object.freeze({
  enabled:true,
  source:'KNOWLEDGE-5DOC',
  fusionVersion:FUSION_VERSION,
  sourceCount:ACADEMIC_PAGE_CORPUS.sourceCount,
  indexedPages:ACADEMIC_PAGE_CORPUS.totals.indexedPages,
  indexedImageOccurrences:ACADEMIC_PAGE_CORPUS.totals.indexedImageOccurrences,
  pageVisualSignatures:ACADEMIC_PAGE_CORPUS.totals.pageVisualSignatures,
  imageVisualSignatures:ACADEMIC_PAGE_CORPUS.totals.imageVisualSignatures,
  extractableTextChars:ACADEMIC_PAGE_CORPUS.totals.extractableTextChars,
  noSilentOmission:ACADEMIC_PAGE_CORPUS.policies.noSilentOmission,
  allPagesIndexed:ACADEMIC_PAGE_CORPUS.policies.allPagesIndexed,
  allEmbeddedImageOccurrencesIndexed:ACADEMIC_PAGE_CORPUS.policies.allEmbeddedImageOccurrencesIndexed,
  weights:WEIGHTS,
  minimumLayers:2,
  totalLayers:3
});
