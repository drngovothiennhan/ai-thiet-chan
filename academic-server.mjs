import {createHash} from 'node:crypto';
import {matchAtlas,ACADEMIC_PAGE_CORPUS,corpusContext,searchTextCorpus,TEXT_CORPUS} from './knowledge-corpus.mjs';
import {directPatterns,evidenceFor,fuse} from './public/academic-fusion-core.js';
import {FUSION_VERSION,SOURCE,WEIGHTS} from './public/academic-source.js';
import {groundTongueMorphology,MORPHOLOGY_POLICY_VERSION} from './morphology-reference.mjs';

const ATLAS_LANGUAGE_THRESHOLD=.85;
const ATLAS_LANGUAGE_MAX_MATCHES=3;
const ATLAS_LANGUAGE_MAX_SNIPPETS=3;
const DEVICE_VERIFY_VERSION='device-payload-verify-v1';
const DEVICE_RUNTIME_VERSION='device-runtime-v2';
const DEVICE_SCHEMA='device-analysis-payload-v2';
const DEVICE_WORKER_VERSION='device-analysis-worker-v3';
const SIG_KEYS=['r','g','b','s','v','purple','white','yellow','dark','spot','aspect','coverage'];
function scoreOf(signal){const n=Number(signal?.confidence);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;}
function collectSignals(assessment){
  const arrays=[assessment?.combined?.generalSignals,assessment?.combined?.stomachPatternSignals,assessment?.top?.theoryAssessment?.generalSignals,assessment?.top?.theoryAssessment?.stomachPatternSignals].filter(Array.isArray);
  const byLabel=new Map();
  for(const list of arrays)for(const signal of list){if(!signal||typeof signal!=='object')continue;const label=String(signal.label||'').trim();if(!label)continue;const key=label.toLowerCase(),prev=byLabel.get(key);if(!prev||scoreOf(signal)>scoreOf(prev))byLabel.set(key,signal);}
  return [...byLabel.values()];
}
function reasoningLayer(assessment){
  const patternCandidates=collectSignals(assessment).map(signal=>({label:String(signal.label||'').trim(),directEvidence:String(signal.evidence||''),academicEvidence:String(signal.rule||signal.missingForConclusion||'Đối chiếu học thuật từ tầng phân tích hiện tại.'),missing:String(signal.missingForConclusion||''),score:scoreOf(signal)}));
  const cannotConclude=[...(Array.isArray(assessment?.combined?.cannotConclude)?assessment.combined.cannotConclude:[]),...(Array.isArray(assessment?.top?.theoryAssessment?.cannotConclude)?assessment.top.theoryAssessment.cannotConclude:[])].map(String).filter(Boolean);
  return {academicSummary:String(assessment?.combined?.summary||''),patternCandidates,cannotConclude:[...new Set(cannotConclude)]};
}
function norm(v){return String(v||'').toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();}
function tokens(v){return [...new Set(norm(v).split(' ').filter(x=>x.length>=3))];}
function wordingQuery(assessment){
  const t=assessment?.top||{},v=assessment?.bottom?.vessels||{};
  return [t.tongueColor,t.shape,t.coatingColor,t.coatingThickness,t.coatingTexture,t.moisture,t.fissures,t.toothmarks,t.pricklesSpots,t.stasisMarks,assessment?.bottom?.undersideColor,v.color,v.prominence,v.dilation,v.tortuosity,v.stasisSigns,...directPatterns(assessment).map(x=>x.label)].filter(Boolean).join(' ');
}
function sentenceCandidates(text){return String(text||'').split(/\n+|(?<=[.!?;:])\s+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(x=>x.length>=18&&x.length<=520);}
function documentWordingForMatches(matches,assessment,body={}){
  if(body?.topQc?.grade==='poor'||body?.qc?.grade==='poor')return {wording:'',snippets:[],matches:[]};
  const q=tokens(wordingQuery(assessment));if(!q.length)return {wording:'',snippets:[],matches:[]};
  const strong=(Array.isArray(matches)?matches:[]).filter(m=>Number(m.similarity)>=ATLAS_LANGUAGE_THRESHOLD).slice(0,ATLAS_LANGUAGE_MAX_MATCHES);
  const ranked=[];
  for(const match of strong){
    const row=TEXT_CORPUS.find(x=>x.sourceId===match.sourceId&&Number(x.page)===Number(match.page));if(!row?.text)continue;
    for(const sentence of sentenceCandidates(row.text)){
      const hay=norm(sentence);let score=0;for(const token of q)if(hay.includes(token))score++;
      if(score>0)ranked.push({sourceId:match.sourceId,page:match.page,similarity:Number(match.similarity),score,text:sentence});
    }
  }
  ranked.sort((a,b)=>b.score-a.score||b.similarity-a.similarity||a.page-b.page);
  const snippets=[],seen=new Set();
  for(const item of ranked){const key=norm(item.text);if(seen.has(key))continue;seen.add(key);snippets.push(item);if(snippets.length>=ATLAS_LANGUAGE_MAX_SNIPPETS)break;}
  const wording=snippets.map(x=>x.text).join(' ').slice(0,980);
  return {wording,snippets,matches:strong.map(m=>({sourceId:m.sourceId,page:m.page,kind:m.kind,similarity:Number(m.similarity)}))};
}
function base64Payload(dataUrl){const text=String(dataUrl||'');return text.includes(',')?text.slice(text.indexOf(',')+1):text;}
function imageDigest(dataUrl){return createHash('sha256').update(base64Payload(dataUrl)).digest('hex');}
function saneSpatialObservation(raw){
  if(!raw||typeof raw!=='object'||!['tongue-spatial-observation-v1','tongue-spatial-observation-v2','tongue-spatial-observation-v3'].includes(raw.schemaVersion))return null;
  const unitKeys=['roiCoverage','bodyLuma','bodySaturation','coatingCandidateRatio'];
  const out={schemaVersion:String(raw.schemaVersion)};
  for(const key of unitKeys){
    const n=Number(raw[key]);if(!Number.isFinite(n)||n<0||n>1.05)return null;out[key]=n;
  }
  for(const key of ['strictCoatingCandidateRatio','coatingWhiteLikeRatio','coatingYellowLikeRatio']){
    if(raw[key]===undefined)continue;
    const n=Number(raw[key]);if(!Number.isFinite(n)||n<0||n>1.05)return null;out[key]=n;
  }
  const zones=raw.coatingZones&&typeof raw.coatingZones==='object'?raw.coatingZones:null;
  if(!zones)return null;
  out.coatingZones={};
  for(const key of ['central','middle','posterior','anterior']){
    const n=Number(zones[key]);if(!Number.isFinite(n)||n<0||n>1.05)return null;out.coatingZones[key]=n;
  }
  const sulcus=raw.medianSulcus&&typeof raw.medianSulcus==='object'?raw.medianSulcus:null;
  if(!sulcus)return null;
  out.medianSulcus={visibleSignal:Boolean(sulcus.visibleSignal)};
  for(const key of ['score','continuity','centrality','meanDarkContrast']){
    const n=Number(sulcus[key]);if(!Number.isFinite(n)||n<0||n>1.05)return null;out.medianSulcus[key]=n;
  }
  if(raw.shapeMetrics&&typeof raw.shapeMetrics==='object'){
    const m=raw.shapeMetrics,outShape={};
    for(const key of ['aspect','areaFill','rootWidthRatio','midWidthRatio','tipWidthRatio','roiWidthRatio','roiHeightRatio','topMargin','bottomMargin','edgeRowCoverage']){
      const n=Number(m[key]);if(!Number.isFinite(n)||n<0||n>5)return null;outShape[key]=n;
    }
    out.shapeMetrics=outShape;
  }
  if(raw.toothmarkMetrics&&typeof raw.toothmarkMetrics==='object'){
    const m=raw.toothmarkMetrics,outTooth={method:String(m.method||'').slice(0,80)};
    for(const key of ['score','leftScore','rightScore','bilateralScore']){
      const n=Number(m[key]);if(!Number.isFinite(n)||n<0||n>1.05)return null;outTooth[key]=n;
    }
    outTooth.leftEvents=Math.max(0,Math.min(20,Math.round(Number(m.leftEvents)||0)));
    outTooth.rightEvents=Math.max(0,Math.min(20,Math.round(Number(m.rightEvents)||0)));
    out.toothmarkMetrics=outTooth;
  }
  const bodyColor=String(raw.bodyColorCandidate||''),coatColor=String(raw.coatingColorCandidate||'');
  const thickness=String(raw.coatingThicknessCandidate||''),distribution=String(raw.coatingDistributionCandidate||'');
  out.bodyColorCandidate=['đỏ nhạt','đỏ','nhợt'].includes(bodyColor)?bodyColor:'';
  out.coatingColorCandidate=['trắng','vàng'].includes(coatColor)?coatColor:'';
  out.coatingThicknessCandidate=['rất mỏng','mỏng','dày'].includes(thickness)?thickness:'';
  out.coatingDistributionCandidate=['trung tâm–sau','lan tỏa','không rõ'].includes(distribution)?distribution:'';
  if(raw.moisture&&typeof raw.moisture==='object'){
    const m=raw.moisture;
    if(m.schemaVersion!=='tongue-moisture-features-v1')return null;
    const saneRegion=region=>{
      if(!region||typeof region!=='object')return null;
      const outRegion={sampledPixels:Math.max(0,Math.min(1000000,Math.round(Number(region.sampledPixels)||0)))};
      for(const key of ['glossRatio','strictGlossRatio','largestGlossComponentRatio','distributedGlossRatio','roughness','meanValue','overexposedRatio','underexposedRatio']){
        const n=Number(region[key]);if(!Number.isFinite(n)||n<0||n>1.05)return null;outRegion[key]=n;
      }
      return outRegion;
    };
    const surface=saneRegion(m.surface),bodyRegion=saneRegion(m.body),coatingRegion=saneRegion(m.coating);
    if(!surface||!bodyRegion||!coatingRegion)return null;
    const mq=m.qc&&typeof m.qc==='object'?m.qc:null;if(!mq)return null;
    const moistureQc={};
    for(const key of ['roiCoverage','overexposedRatio','underexposedRatio','largestGlossComponentRatio']){
      const n=Number(mq[key]);if(!Number.isFinite(n)||n<0||n>1.05)return null;moistureQc[key]=n;
    }
    moistureQc.neutralReferencePixels=Math.max(0,Math.min(1000000,Math.round(Number(mq.neutralReferencePixels)||0)));
    moistureQc.colorNormalizationApplied=Boolean(mq.colorNormalizationApplied);
    out.moisture={
      schemaVersion:'tongue-moisture-features-v1',
      surface,body:bodyRegion,coating:coatingRegion,qc:moistureQc,
      method:String(m.method||'').slice(0,100),
      calibration:String(m.calibration||'').slice(0,120)
    };
  }
  if(raw.colorNormalization&&typeof raw.colorNormalization==='object'){
    const n=raw.colorNormalization;
    out.colorNormalization={
      applied:Boolean(n.applied),
      neutralPixels:Math.max(0,Math.min(1000000,Number(n.neutralPixels)||0)),
      gainR:Math.max(.8,Math.min(1.2,Number(n.gainR)||1)),
      gainG:Math.max(.8,Math.min(1.2,Number(n.gainG)||1)),
      gainB:Math.max(.8,Math.min(1.2,Number(n.gainB)||1)),
      bounded:true
    };
  }
  out.fissurePolicy='median-sulcus-is-not-pathological-fissure';
  out.authority='direct-image-observation-only';
  return out;
}
function saneSignature(raw){
  if(!raw||typeof raw!=='object')return null;
  const out={};
  for(const key of SIG_KEYS){const n=Number(raw[key]);if(!Number.isFinite(n))return null;out[key]=n;}
  for(const key of ['r','g','b','s','v','purple','white','yellow','dark','spot','coverage'])if(out[key]<0||out[key]>1.05)return null;
  if(out.aspect<=0||out.aspect>5)return null;
  if(raw.segmentationMode)out.segmentationMode=String(raw.segmentationMode).slice(0,60);
  const spatial=saneSpatialObservation(raw.spatial);
  if(spatial)out.spatial=spatial;
  return out;
}
function saneBottomFeatures(raw){
  if(!raw||typeof raw!=='object'||!['bottom-device-feature-v1','bottom-device-feature-v2'].includes(raw.schemaVersion))return null;
  const keys=['vesselCandidateRatio','darkPurpleRatio','meanCentralLuminance','redBlueMinusGreen'];
  const out={schemaVersion:String(raw.schemaVersion)};
  for(const key of keys){const n=Number(raw[key]);if(!Number.isFinite(n))return null;out[key]=n;}
  if(out.vesselCandidateRatio<0||out.vesselCandidateRatio>1||out.darkPurpleRatio<0||out.darkPurpleRatio>1||out.meanCentralLuminance<0||out.meanCentralLuminance>1||Math.abs(out.redBlueMinusGreen)>1)return null;
  for(const key of ['leftDarkLineRatio','rightDarkLineRatio','bilateralBalance','leftRowContinuity','rightRowContinuity']){
    if(raw[key]===undefined)continue;
    const n=Number(raw[key]);if(!Number.isFinite(n)||n<0||n>1.05)return null;out[key]=n;
  }
  for(const key of ['mucosaMeanR','mucosaMeanG','mucosaMeanB']){
    if(raw[key]===undefined)continue;
    const n=Number(raw[key]);if(!Number.isFinite(n)||n<0||n>1.05)return null;out[key]=n;
  }
  out.bilateralSignal=Boolean(raw.bilateralSignal===true);
  out.sampledPixels=Math.max(0,Math.min(1000000,Number(raw.sampledPixels)||0));
  return out;
}
function validSha256(value){return /^[0-9a-f]{64}$/.test(String(value||''));}
function storagePathForDigest(digest){return `sha256/${digest}.jpg`;}
export function verifyClientVisualPayload(body={}){
  const signature=saneSignature(body?.academicSignature);if(!signature)return {verified:false,reason:'signature-missing-or-invalid'};
  const source=body?.academicSource&&typeof body.academicSource==='object'?body.academicSource:{};
  const mode=body?.mode==='general'?'general':'normal';
  if(source.execution==='storage-direct-service-worker'){
    const claimedTop=String(source.topImageDigest||'');
    const topHash=String(body?.topImageHash||'');
    const topPath=String(body?.topStoragePath||'');
    if(!validSha256(topHash)||claimedTop!==topHash)return {verified:false,reason:'top-storage-digest-invalid'};
    if(topPath!==storagePathForDigest(topHash))return {verified:false,reason:'top-storage-path-mismatch'};
    if(String(body?.storageTransport?.bucket||'')!=='aitc-case-images')return {verified:false,reason:'storage-bucket-invalid'};
    let bottomVerified=false,bottomFeatures=null;
    if(mode==='general'){
      const claimedBottom=String(source.bottomImageDigest||'');
      const bottomHash=String(body?.bottomImageHash||'');
      const bottomPath=String(body?.bottomStoragePath||'');
      if(!validSha256(bottomHash)||claimedBottom!==bottomHash)return {verified:false,reason:'bottom-storage-digest-invalid'};
      if(bottomPath!==storagePathForDigest(bottomHash))return {verified:false,reason:'bottom-storage-path-mismatch'};
      bottomVerified=true;
      bottomFeatures=saneBottomFeatures(source.bottomFeatures);
    }
    return {
      verified:true,mode:'storage-direct-service-worker',signature,
      clientSource:{
        execution:'storage-direct-service-worker',
        runtimeVersion:String(source.runtimeVersion||'storage-direct-sw-v1'),
        schemaVersion:String(source.schemaVersion||'storage-direct-payload-v1'),
        topImageDigest:topHash,
        bottomImageDigest:bottomVerified?String(body.bottomImageHash):'',
        topStoragePath:topPath,
        bottomStoragePath:bottomVerified?String(body.bottomStoragePath):'',
        source:String(source.id||source.source||SOURCE.id),
        bottomFeatureSchema:bottomFeatures?.schemaVersion||null
      },
      deviceCompute:{
        verifyVersion:DEVICE_VERIFY_VERSION,verified:true,tier:'storage-direct',
        activeBackend:'device-preprocessed-storage-direct',trainingVectorCoverage:1,
        diagnosticSignatureCoverage:Number((298/1027).toFixed(6)),
        groundTruthContext:{available:false},bottomVerified,bottomFeatures
      }
    };
  }
  const topImage=body?.topImage||body?.image||'';if(!topImage)return {verified:false,reason:'top-image-missing'};
  const expectedTop=imageDigest(topImage),claimedTop=String(source.topImageDigest||'');
  if(!claimedTop||claimedTop!==expectedTop)return {verified:false,reason:'top-image-digest-mismatch'};
  if(source.execution==='service-worker-fallback'){
    return {verified:true,mode:'service-worker-fallback',signature,clientSource:{execution:'service-worker-fallback',runtimeVersion:String(source.runtimeVersion||''),schemaVersion:String(source.schemaVersion||''),topImageDigest:claimedTop,source:String(source.id||source.source||SOURCE.id)},deviceCompute:null};
  }
  const runtime=body?.deviceRuntime||{},analysis=body?.deviceAnalysis||{},top=analysis?.top||{};
  if(source.execution!=='device-worker')return {verified:false,reason:'execution-not-device-worker'};
  if(runtime.status!=='complete'||runtime.version!==DEVICE_RUNTIME_VERSION||runtime.schemaVersion!==DEVICE_SCHEMA)return {verified:false,reason:'runtime-version-or-status-invalid'};
  if(analysis.runtimeVersion!==DEVICE_RUNTIME_VERSION||analysis.schemaVersion!==DEVICE_SCHEMA)return {verified:false,reason:'analysis-schema-invalid'};
  if(top.workerVersion!==DEVICE_WORKER_VERSION||String(top.imageDigest||'')!==expectedTop)return {verified:false,reason:'worker-version-or-top-digest-invalid'};
  const gt=analysis.groundTruth||source;
  if(Number(gt.ownerDesignatedTrainingSamples)!==1027||Number(gt.globalVisualVectors)!==1027||Number(gt.diagnosticTongueSignatures)!==298||Number(gt.contextOrNegativeSamples)!==729)return {verified:false,reason:'ground-truth-profile-invalid'};
  let bottomVerified=false,bottomFeatures=null;
  if(body?.mode==='general'&&body?.bottomImage){
    const expectedBottom=imageDigest(body.bottomImage),claimedBottom=String(source.bottomImageDigest||'');
    bottomVerified=Boolean(claimedBottom&&claimedBottom===expectedBottom&&String(analysis?.bottom?.imageDigest||'')===expectedBottom);
    if(bottomVerified)bottomFeatures=saneBottomFeatures(analysis?.bottom?.bottomFeatures);
  }
  const context=top?.groundTruthContext&&typeof top.groundTruthContext==='object'?top.groundTruthContext:null;
  const safeContext=context&&context.available===true?{
    available:true,profileVersion:String(context.profileVersion||'').slice(0,80),trainingSamples:Number(context.trainingSamples)||0,diagnosticSamples:Number(context.diagnosticSamples)||0,contextSamples:Number(context.contextSamples)||0,
    diagnosticDistance:Number(context.diagnosticDistance)||0,contextDistance:Number(context.contextDistance)||0,margin:Number(context.margin)||0,referenceRegion:String(context.referenceRegion||'').slice(0,60)
  }:{available:false};
  return {
    verified:true,mode:'device-worker',signature,
    clientSource:{execution:'device-worker',runtimeVersion:runtime.version,schemaVersion:runtime.schemaVersion,workerVersion:top.workerVersion,topImageDigest:expectedTop,bottomImageDigest:bottomVerified?String(source.bottomImageDigest||''):''},
    deviceCompute:{verifyVersion:DEVICE_VERIFY_VERSION,verified:true,tier:String(analysis?.profile?.tier||runtime?.profile?.tier||'unknown').slice(0,30),activeBackend:String(analysis?.profile?.plan?.activeBackend||runtime?.profile?.plan?.activeBackend||'').slice(0,60),trainingVectorCoverage:1,diagnosticSignatureCoverage:Number((298/1027).toFixed(6)),groundTruthContext:safeContext,bottomVerified,bottomFeatures}
  };
}
export function applyAcademicFusion(assessment,body={}){
  assessment=groundTongueMorphology(assessment,body);
  const verification=verifyClientVisualPayload(body);
  if(!verification.verified)return assessment;
  const signature=verification.signature;
  const matches=matchAtlas(signature);
  const direct=directPatterns(assessment);
  const evidence=evidenceFor(direct);
  const query=[assessment?.combined?.summary,...direct.map(x=>x.label),...(assessment?.combined?.generalSignals||[]).map(x=>x?.label||'')].filter(Boolean).join(' ');
  const textMatches=searchTextCorpus(query,6);
  const visualContext=corpusContext(signature);
  const fused=fuse(assessment,signature,matches,reasoningLayer(assessment),evidence);
  const atlasLanguage=documentWordingForMatches(matches,fused,body);
  const strongAtlas=atlasLanguage.matches[0]||null;
  if(strongAtlas&&atlasLanguage.wording){
    // Keep atlas similarity as provenance/support metadata only. It is not a clinical
    // signal and must not appear as a pseudo-probability in the syndrome list.
    fused.combined=fused.combined||{};
    fused.combined.atlasSupport={
      similarity:Number(strongAtlas.similarity),
      wording:atlasLanguage.wording,
      usage:'support-only-not-diagnostic-probability'
    };
  }
  fused.ml=fused.ml||{};
  fused.ml.featureVector=fused.ml.featureVector||{};
  if(verification.deviceCompute)fused.ml.featureVector.deviceCompute=verification.deviceCompute;
  fused.ml.featureVector.academic=fused.ml.featureVector.academic||{};
  fused.ml.featureVector.academic.corpus={
    id:ACADEMIC_PAGE_CORPUS.id,
    folder:ACADEMIC_PAGE_CORPUS.folder,
    sourceCount:ACADEMIC_PAGE_CORPUS.sourceCount,
    sources:ACADEMIC_PAGE_CORPUS.sources.map(s=>({id:s.id,sha256:s.sha256,pages:s.pages,indexedPages:s.indexedPages,embeddedImageOccurrences:s.embeddedImageOccurrences,indexedImageOccurrences:s.indexedImageOccurrences,diagnosticVisualEligible:Boolean(s.diagnosticVisualEligible),negativeVisualContext:Boolean(s.negativeVisualContext)})),
    totals:ACADEMIC_PAGE_CORPUS.totals,
    policies:ACADEMIC_PAGE_CORPUS.policies,
    sourceDocument:SOURCE,
    clientSource:verification.clientSource,
    clientVerification:{version:DEVICE_VERIFY_VERSION,verified:true,mode:verification.mode},
    fusionVersion:FUSION_VERSION,
    weights:WEIGHTS,
    morphologyPolicyVersion:MORPHOLOGY_POLICY_VERSION,
    atlasLanguageThreshold:ATLAS_LANGUAGE_THRESHOLD,
    atlasLanguageMaxMatches:ATLAS_LANGUAGE_MAX_MATCHES,
    matchedAtlas:matches.map(m=>({sourceId:m.sourceId,page:m.page,kind:m.kind,hash:m.hash,similarity:m.similarity})),
    visualContext,
    textMatches
  };
  if(fused.combined?.academicFusion){
    fused.combined.academicFusion.corpusTextMatches=textMatches.map(x=>({sourceId:x.sourceId,page:x.page,score:x.score}));
    fused.combined.academicFusion.visualContext=visualContext;
    fused.combined.academicFusion.morphologyPolicyVersion=MORPHOLOGY_POLICY_VERSION;
    fused.combined.academicFusion.clientVerification={version:DEVICE_VERIFY_VERSION,verified:true,mode:verification.mode};
    fused.combined.academicFusion.atlasLanguage={
      applied:Boolean(strongAtlas&&atlasLanguage.wording),threshold:ATLAS_LANGUAGE_THRESHOLD,
      sourceId:strongAtlas?.sourceId||null,page:strongAtlas?.page||null,similarity:strongAtlas?.similarity||0,
      wording:atlasLanguage.wording||'',snippets:atlasLanguage.snippets,matches:atlasLanguage.matches,
      policy:'document-style wording only for QC-qualified atlas matches >= 0.85; never convert similarity into diagnosis'
    };
  }
  return fused;
}
export const ACADEMIC_HEALTH=Object.freeze({
  enabled:true,
  source:'KNOWLEDGE-5DOC',
  fusionVersion:FUSION_VERSION,
  morphologyPolicyVersion:MORPHOLOGY_POLICY_VERSION,
  devicePayloadVerificationVersion:DEVICE_VERIFY_VERSION,
  acceptedDeviceRuntime:DEVICE_RUNTIME_VERSION,
  acceptedDeviceSchema:DEVICE_SCHEMA,
  atlasLanguageThreshold:ATLAS_LANGUAGE_THRESHOLD,
  atlasLanguageMaxMatches:ATLAS_LANGUAGE_MAX_MATCHES,
  sourceCount:ACADEMIC_PAGE_CORPUS.sourceCount,
  indexedPages:ACADEMIC_PAGE_CORPUS.totals.indexedPages,
  indexedImageOccurrences:ACADEMIC_PAGE_CORPUS.totals.indexedImageOccurrences,
  ownerDesignatedGroundTruthSamples:1027,
  globalVisualVectors:1027,
  diagnosticTongueSignatures:298,
  contextOrNegativeSamples:729,
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
