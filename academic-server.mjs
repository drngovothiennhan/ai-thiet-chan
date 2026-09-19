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
const DEVICE_WORKER_VERSION='device-analysis-worker-v4';
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
  if(!raw||typeof raw!=='object'||!['tongue-spatial-observation-v1','tongue-spatial-observation-v2','tongue-spatial-observation-v3','tongue-spatial-observation-v4'].includes(raw.schemaVersion))return null;
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
  const bodyColor=String(raw.bodyColorCandidate||''),coatColor=String(raw.coatingColorCandidate||'');
  const thickness=String(raw.coatingThicknessCandidate||''),distribution=String(raw.coatingDistributionCandidate||'');
  out.bodyColorCandidate=['đỏ nhạt','đỏ','nhợt'].includes(bodyColor)?bodyColor:'';
  out.coatingColorCandidate=['trắng','vàng'].includes(coatColor)?coatColor:'';
  out.coatingThicknessCandidate=['rất mỏng','mỏng','dày'].includes(thickness)?thickness:'';
  out.coatingDistributionCandidate=['trung tâm–sau','lan tỏa','không rõ'].includes(distribution)?distribution:'';
  if(raw.surfacePhenotype&&typeof raw.surfacePhenotype==='object'){
    const p=raw.surfacePhenotype;
    if(p.schemaVersion!=='tongue-surface-phenotype-features-v1')return null;
    const t=p.toothmarks&&typeof p.toothmarks==='object'?p.toothmarks:null;
    const s=p.shape&&typeof p.shape==='object'?p.shape:null;
    const ct=p.coatingTexture&&typeof p.coatingTexture==='object'?p.coatingTexture:null;
    if(!t||!s||!ct)return null;
    const finiteRange=(value,min,max)=>{const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null;};
    const tooth={
      schemaVersion:String(t.schemaVersion||''),
      leftNotches:Math.max(0,Math.min(20,Math.round(Number(t.leftNotches)||0))),
      rightNotches:Math.max(0,Math.min(20,Math.round(Number(t.rightNotches)||0))),
      totalNotches:Math.max(0,Math.min(40,Math.round(Number(t.totalNotches)||0))),
      bilateralSignal:Boolean(t.bilateralSignal),
      edgeSampleRows:Math.max(0,Math.min(1000,Math.round(Number(t.edgeSampleRows)||0))),
      source:String(t.source||'').slice(0,100),
      calibration:String(t.calibration||'').slice(0,120)
    };
    for(const key of ['maxNotchDepthRatio','adaptiveNotchThreshold']){
      const n=finiteRange(t[key],0,1.05);if(n===null)return null;tooth[key]=n;
    }
    const shape={
      schemaVersion:String(s.schemaVersion||''),
      profileRows:Math.max(0,Math.min(1000,Math.round(Number(s.profileRows)||0))),
      source:String(s.source||'').slice(0,100),
      calibration:String(s.calibration||'').slice(0,120)
    };
    for(const key of ['boxAspect','midWidthToHeight']){
      const n=finiteRange(s[key],0,5);if(n===null)return null;shape[key]=n;
    }
    {const n=finiteRange(s.boxFillRatio,0,1.05);if(n===null)return null;shape.boxFillRatio=n;}
    const coatingTexture={
      schemaVersion:String(ct.schemaVersion||''),
      sampledPixels:Math.max(0,Math.min(1000000,Math.round(Number(ct.sampledPixels)||0))),
      source:String(ct.source||'').slice(0,100),
      calibration:String(ct.calibration||'').slice(0,120)
    };
    for(const key of ['coatingCandidateRatio','meanMicrotexture','microtextureStd','highFrequencyRatio','fineGranuleRatio','coarseGranuleRatio','largestCoatingComponentRatio','patchiness','edgeCoverage']){
      const n=finiteRange(ct[key],0,1.05);if(n===null)return null;coatingTexture[key]=n;
    }
    {const n=finiteRange(ct.centerMinusEdgeCoverage,-1.05,1.05);if(n===null)return null;coatingTexture.centerMinusEdgeCoverage=n;}
    if(tooth.schemaVersion!=='tongue-toothmark-geometry-v1'||shape.schemaVersion!=='tongue-shape-geometry-v1'||coatingTexture.schemaVersion!=='tongue-coating-texture-v1')return null;
    out.surfacePhenotype={schemaVersion:'tongue-surface-phenotype-features-v1',toothmarks:tooth,shape,coatingTexture};
  }
  if(raw.stasisSpot&&typeof raw.stasisSpot==='object'){
    const s=raw.stasisSpot;
    if(s.schemaVersion!=='tongue-stasis-spot-features-v1')return null;
    const finiteRange=(value,min,max)=>{const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null;};
    const stasis={
      schemaVersion:'tongue-stasis-spot-features-v1',
      componentCount:Math.max(0,Math.min(100,Math.round(Number(s.componentCount)||0))),
      smallSpotCount:Math.max(0,Math.min(100,Math.round(Number(s.smallSpotCount)||0))),
      patchCount:Math.max(0,Math.min(100,Math.round(Number(s.patchCount)||0))),
      regionModel:String(s.regionModel||'').slice(0,80),
      method:String(s.method||'').slice(0,120),
      calibration:String(s.calibration||'').slice(0,120)
    };
    for(const key of ['candidatePixelRatio','acceptedAreaRatio','meanPurpleDelta','meanDarkContrast','redSpotExcludedRatio']){
      const n=finiteRange(s[key],0,1.05);if(n===null)return null;stasis[key]=n;
    }
    const saneCounts=src=>{
      const outCounts={};for(const key of ['tip','margin','center','root'])outCounts[key]=Math.max(0,Math.min(100,Math.round(Number(src?.[key])||0)));return outCounts;
    };
    stasis.regionCounts=saneCounts(s.regionCounts);
    stasis.smallSpotRegionCounts=saneCounts(s.smallSpotRegionCounts);
    stasis.patchRegionCounts=saneCounts(s.patchRegionCounts);
    stasis.componentSummaries=Array.isArray(s.componentSummaries)?s.componentSummaries.slice(0,12).map(x=>({
      kind:['small-spot','patch'].includes(String(x?.kind||''))?String(x.kind):'unknown',
      region:['tip','margin','center','root'].includes(String(x?.region||''))?String(x.region):'unknown',
      areaRatio:Math.max(0,Math.min(1.05,Number(x?.areaRatio)||0)),
      aspect:Math.max(0,Math.min(10,Number(x?.aspect)||0)),
      nx:Math.max(0,Math.min(1,Number(x?.nx)||0)),
      ny:Math.max(0,Math.min(1,Number(x?.ny)||0))
    })):[];
    out.stasisSpot=stasis;
  }
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
  if(!raw||typeof raw!=='object'||!['bottom-device-feature-v1','bottom-device-feature-v2','bottom-device-feature-v3'].includes(raw.schemaVersion))return null;
  const keys=['vesselCandidateRatio','darkPurpleRatio','meanCentralLuminance','redBlueMinusGreen'];
  const out={schemaVersion:String(raw.schemaVersion)};
  for(const key of keys){const n=Number(raw[key]);if(!Number.isFinite(n))return null;out[key]=n;}
  if(out.vesselCandidateRatio<0||out.vesselCandidateRatio>1||out.darkPurpleRatio<0||out.darkPurpleRatio>1||out.meanCentralLuminance<0||out.meanCentralLuminance>1||Math.abs(out.redBlueMinusGreen)>1)return null;
  for(const key of ['leftDarkLineRatio','rightDarkLineRatio','bilateralBalance','leftRowContinuity','rightRowContinuity']){
    if(raw[key]===undefined)continue;
    const n=Number(raw[key]);if(!Number.isFinite(n)||n<0||n>1.05)return null;out[key]=n;
  }
  if(raw.schemaVersion==='bottom-device-feature-v3'){
    out.vesselColorSamplePixels=Math.max(0,Math.min(1000000,Math.round(Number(raw.vesselColorSamplePixels)||0)));
    for(const key of ['vesselMeanR','vesselMeanG','vesselMeanB','vesselMeanSaturation','vesselMeanValue','vesselBluePurpleRatio','vesselRedPurpleRatio','vesselDarkPurpleRatio','vesselVsMucosaChromaDelta']){
      const n=Number(raw[key]);if(!Number.isFinite(n)||n<0||n>1.05)return null;out[key]=n;
    }
  }
  out.bilateralSignal=Boolean(raw.bilateralSignal===true);
  out.sampledPixels=Math.max(0,Math.min(1000000,Number(raw.sampledPixels)||0));
  return out;
}
export function verifyClientVisualPayload(body={}){
  const signature=saneSignature(body?.academicSignature);if(!signature)return {verified:false,reason:'signature-missing-or-invalid'};
  const source=body?.academicSource&&typeof body.academicSource==='object'?body.academicSource:{};
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
function buildEducationalYhctSuggestions(assessment){
  const top=assessment?.top||{};
  const regions=Array.isArray(top.tongueTopography)?top.tongueTopography:[];
  const regionalHints=regions.slice(0,4).map(x=>({
    region:String(x?.region||'unknown'),
    regionLabel:String(x?.regionLabel||''),
    findingCount:Math.max(0,Math.min(100,Math.round(Number(x?.count)||0))),
    zangFu:Array.isArray(x?.zangFu)?x.zangFu.slice(0,4).map(String):[],
    label:'Đối chiếu đồ hình YHCT',
    wording:'Dấu quan sát nằm ở '+String(x?.regionLabel||'vùng lưỡi')+'; theo đồ hình YHCT vùng này thường đối chiếu '+(Array.isArray(x?.zangFu)&&x.zangFu.length?x.zangFu.join('–'):'không xác định')+'.',
    guardrail:'Đây là bản đồ lý luận YHCT, không phải ranh giới giải phẫu và không đồng nghĩa bệnh của tạng phủ.'
  }));
  const signals=Array.isArray(assessment?.combined?.generalSignals)?assessment.combined.generalSignals:[];
  const syndromeHints=signals.filter(x=>/^Tín hiệu\s/u.test(String(x?.label||''))).slice(0,4).map(x=>({
    label:String(x.label||''),
    evidence:String(x.evidence||''),
    confidence:Number.isFinite(Number(x.confidence))?Math.max(0,Math.min(1,Number(x.confidence))):null,
    interpretation:'Gợi ý thể/chứng YHCT để đối chiếu với tứ chẩn; không phải chẩn đoán xác định.'
  }));
  return {
    schemaVersion:'aitc-yhct-educational-suggestions-v1',
    label:'Gợi ý đối chiếu YHCT — không thay thế chẩn đoán lâm sàng',
    regionalHints,
    syndromeHints,
    modernDiseaseSuggestions:[],
    policy:'Chỉ sinh từ feature Local Vision đã QC + đối chiếu học thuật/fusion. Không suy bệnh hiện đại từ ảnh lưỡi; vùng tạng phủ là đồ hình lý luận YHCT.'
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
  fused.combined=fused.combined||{};
  fused.combined.educationalSuggestions=buildEducationalYhctSuggestions(fused);
  const edu=fused.combined.educationalSuggestions;
  const regionalSummary=edu.regionalHints.map(x=>x.regionLabel+' → '+x.zangFu.join('–')).join('; ');
  const syndromeSummary=edu.syndromeHints.map(x=>x.label).join('; ');
  if(regionalSummary)fused.combined.summary=[String(fused.combined.summary||'').trim(),'Đối chiếu đồ hình YHCT: '+regionalSummary+'.'].filter(Boolean).join(' ');
  if(syndromeSummary)fused.combined.summary=[String(fused.combined.summary||'').trim(),'Gợi ý thể/chứng YHCT: '+syndromeSummary+' — không thay thế chẩn đoán lâm sàng.'].filter(Boolean).join(' ');
  const atlasLanguage=documentWordingForMatches(matches,fused,body);
  const strongAtlas=atlasLanguage.matches[0]||null;
  if(strongAtlas&&atlasLanguage.wording){
    fused.combined=fused.combined||{};
    fused.combined.generalSignals=Array.isArray(fused.combined.generalSignals)?fused.combined.generalSignals:[];
    const pct=Math.round(Number(strongAtlas.similarity)*100);
    const label=`Tham Vấn: tương đồng atlas ${pct}%`;
    if(!fused.combined.generalSignals.some(x=>String(x?.label||'')===label))fused.combined.generalSignals.push({
      label,
      evidence:atlasLanguage.wording,
      rule:'Khi đối chiếu hình ảnh đạt từ 85% trở lên và ảnh qua QC, hệ thống ưu tiên đúng thuật ngữ/văn phong của mẫu tài liệu tương ứng; độ giống hình ảnh không được tự chuyển thành chẩn đoán xác định.',
      confidence:Number(strongAtlas.similarity)
    });
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
