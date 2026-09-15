import {matchAtlas,ACADEMIC_PAGE_CORPUS,corpusContext,searchTextCorpus} from './knowledge-corpus.mjs';
import {directPatterns,evidenceFor,fuse} from './public/academic-fusion-core.js';
import {FUSION_VERSION,SOURCE,WEIGHTS} from './public/academic-source.js';

const LEARNING_POLICY_VERSION='novelty-priority-v1';
const EVIDENCE_PROFILE_VERSION='evidence-readiness-v1';
const NOVEL_SIMILARITY_THRESHOLD=0.55;
const REVIEW_SIMILARITY_THRESHOLD=0.72;
const SIGNATURE_KEYS=['r','g','b','s','v','purple','white','yellow','dark','spot','aspect','coverage'];
export function validAcademicSignature(sig){
  return Boolean(sig&&typeof sig==='object'&&!Array.isArray(sig)&&SIGNATURE_KEYS.every(k=>
    typeof sig[k]==='number'&&Number.isFinite(sig[k])&&sig[k]>=0&&sig[k]<=(k==='aspect'?10:1))&&sig.aspect>0&&sig.coverage>0);
}


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

export function learningPriorityFromSimilarity(similarity,{quality='good',signaturePresent=true}={}){
  const q=String(quality||'poor').toLowerCase();
  if(!signaturePresent) return {policyVersion:LEARNING_POLICY_VERSION,status:'unscored',priority:'review',learningCandidate:false,reason:'academic-signature-missing',maxAtlasSimilarity:null,noveltyScore:null};
  const sim=Math.max(0,Math.min(1,Number(similarity)||0));
  const noveltyScore=Number((1-sim).toFixed(3));
  if(!['good','fair'].includes(q)) return {policyVersion:LEARNING_POLICY_VERSION,status:'excluded-qc',priority:'reject-qc',learningCandidate:false,reason:'poor-image-quality',maxAtlasSimilarity:Number(sim.toFixed(3)),noveltyScore};
  if(sim<NOVEL_SIMILARITY_THRESHOLD) return {policyVersion:LEARNING_POLICY_VERSION,status:'novel',priority:'high',learningCandidate:true,reason:'low-similarity-to-existing-visual-corpus',maxAtlasSimilarity:Number(sim.toFixed(3)),noveltyScore};
  if(sim<REVIEW_SIMILARITY_THRESHOLD) return {policyVersion:LEARNING_POLICY_VERSION,status:'uncommon',priority:'medium',learningCandidate:true,reason:'partial-match-requires-review',maxAtlasSimilarity:Number(sim.toFixed(3)),noveltyScore};
  return {policyVersion:LEARNING_POLICY_VERSION,status:'covered',priority:'low',learningCandidate:false,reason:'well-covered-by-existing-visual-corpus',maxAtlasSimilarity:Number(sim.toFixed(3)),noveltyScore};
}

export function evidenceReadiness(assessment,{direct=[],matches=[]}={}){
  const directCount=Array.isArray(direct)?direct.filter(p=>Number(p.score)>=.55).length:0;
  const atlasCount=Array.isArray(matches)?matches.filter(m=>Number.isFinite(m.similarity)&&m.similarity>=.60).length:0;
  const geminiCount=collectSignals(assessment).filter(s=>scoreOf(s)>=.55&&String(s.evidence||'').trim()).length;
  const layers={directImage:directCount>0,atlasSimilarity:atlasCount>0,geminiAcademic:geminiCount>0};
  const activeLayers=Object.values(layers).filter(Boolean).length;
  return {
    profileVersion:EVIDENCE_PROFILE_VERSION,
    layers,
    activeLayers,
    totalLayers:3,
    minimumRequired:2,
    minimumMet:activeLayers>=2,
    directPatternCount:directCount,
    atlasMatchCount:atlasCount,
    geminiSignalCount:geminiCount,
    topAtlasSimilarity:atlasCount?Number((Number(matches[0]?.similarity)||0).toFixed(3)):null,
    imageQuality:String(assessment?.top?.quality||'poor').toLowerCase()
  };
}
function refineLearningProfile(profile,evidenceProfile,quality){
  const q=String(quality||'poor').toLowerCase();
  let out={...profile,evidenceReadiness:{profileVersion:evidenceProfile.profileVersion,activeLayers:evidenceProfile.activeLayers,minimumRequired:evidenceProfile.minimumRequired,minimumMet:evidenceProfile.minimumMet}};
  if(out.learningCandidate&&!evidenceProfile.minimumMet){
    out={...out,status:'review-insufficient-evidence',priority:'review',learningCandidate:false,reason:'minimum-evidence-layers-not-met'};
  }else if(out.status==='novel'&&q==='fair'){
    out={...out,priority:'medium',reason:'novel-but-fair-image-quality'};
  }
  return out;
}
function attachLearningPolicy(assessment,profile,evidenceProfile=null){
  assessment.ml=assessment.ml||{};
  assessment.ml.featureVector=assessment.ml.featureVector||{};
  assessment.ml.learning=profile;
  assessment.ml.featureVector.learning=profile;
  if(evidenceProfile){assessment.ml.evidence=evidenceProfile;assessment.ml.featureVector.evidence=evidenceProfile;}
  return assessment;
}

export function applyAcademicFusion(assessment,body={}){
  const qc=body?.topQc?.grade||body?.qc?.grade;
  if(qc==='poor'||(qc==='fair'&&assessment?.top?.quality==='good'))assessment.top.quality=qc;
  const signature=validAcademicSignature(body?.academicSignature)?body.academicSignature:null;
  if(assessment?.top?.visualValidity?.tongueVisible===false||assessment?.top?.quality==='poor'){
    assessment.combined.generalSignals=[];assessment.combined.stomachPatternSignals=[];
    assessment.combined.confidence=0;
    assessment.combined.summary='Chưa đủ dữ kiện ảnh lưỡi hợp lệ để biện luận; cần chụp lại ảnh rõ hơn.';
    if(assessment.top.theoryAssessment){assessment.top.theoryAssessment.generalSignals=[];assessment.top.theoryAssessment.stomachPatternSignals=[];}
    const profile=evidenceReadiness(assessment);
    const learning=learningPriorityFromSimilarity(0,{quality:'poor',signaturePresent:true});
    attachLearningPolicy(assessment,learning,profile);
    assessment.ml.featureVector.combined={...assessment.combined};
    return assessment;
  }
  if(!signature){
    const evidenceProfile=evidenceReadiness(assessment,{direct:[],matches:[]});
    const learningProfile=refineLearningProfile(learningPriorityFromSimilarity(0,{quality:assessment?.top?.quality||'poor',signaturePresent:false}),evidenceProfile,assessment?.top?.quality||'poor');
    assessment.combined.generalSignals=[];assessment.combined.stomachPatternSignals=[];
    assessment.combined.diagnosticStatus='insufficient-evidence';
    assessment.combined.confidence=Math.min(.25,Number(assessment.combined.confidence)||0);
    assessment.combined.summary='Đã ghi nhận mô tả ảnh; chưa có chữ ký ảnh hợp lệ để hoàn tất đối chiếu học liệu đa tầng.';
    attachLearningPolicy(assessment,learningProfile,evidenceProfile);
    assessment.ml.featureVector.combined={...assessment.combined};
    return assessment;
  }
  const matches=matchAtlas(signature);
  const direct=directPatterns(assessment);
  const evidence=evidenceFor(direct);
  const query=[assessment?.combined?.summary,...direct.map(x=>x.label),...(assessment?.combined?.generalSignals||[]).map(x=>x?.label||'')].filter(Boolean).join(' ');
  const textMatches=searchTextCorpus(query,6);
  const visualContext=corpusContext(signature);
  // Measure original provider evidence before fusion can append derived signals.
  const evidenceProfile=evidenceReadiness(assessment,{direct,matches});
  const fused=fuse(assessment,signature,matches,geminiLayer(assessment),evidence);
  const maxAtlasSimilarity=Number(matches?.[0]?.similarity||0);
  const baseLearningProfile=learningPriorityFromSimilarity(maxAtlasSimilarity,{quality:fused?.top?.quality||assessment?.top?.quality||'poor',signaturePresent:true});
  const learningProfile=refineLearningProfile(baseLearningProfile,evidenceProfile,fused?.top?.quality||assessment?.top?.quality||'poor');
  attachLearningPolicy(fused,learningProfile,evidenceProfile);
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
    textMatches,
    evidenceReadiness:evidenceProfile,
    learningPriority:learningProfile
  };
  if(fused.combined?.academicFusion){
    fused.combined.academicFusion.corpusTextMatches=textMatches.map(x=>({sourceId:x.sourceId,page:x.page,score:x.score}));
    fused.combined.academicFusion.visualContext=visualContext;
    fused.combined.academicFusion.evidenceReadiness=evidenceProfile;
    fused.combined.academicFusion.learningPriority=learningProfile;
  }
  fused.ml.featureVector.combined={confidence:fused.combined.confidence,generalSignals:fused.combined.generalSignals,stomachPatternSignals:fused.combined.stomachPatternSignals};
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
  totalLayers:3,
  evidenceProfileVersion:EVIDENCE_PROFILE_VERSION,
  learningCollection:{
    policyVersion:LEARNING_POLICY_VERSION,
    focus:'novel-cases-first',
    novelBelowSimilarity:NOVEL_SIMILARITY_THRESHOLD,
    reviewBelowSimilarity:REVIEW_SIMILARITY_THRESHOLD,
    poorQcExcludedFromLearning:true,
    fairNovelPriority:'medium',
    minimumEvidenceLayersForLearning:2,
    autoPromoteToKnowledge:false
  }
});
