import {matchAtlas,ACADEMIC_PAGE_CORPUS,corpusContext,searchTextCorpus,TEXT_CORPUS} from './knowledge-corpus.mjs';
import {directPatterns,evidenceFor,fuse} from './public/academic-fusion-core.js';
import {FUSION_VERSION,SOURCE,WEIGHTS} from './public/academic-source.js';
import {groundTongueMorphology,MORPHOLOGY_POLICY_VERSION} from './morphology-reference.mjs';

const ATLAS_LANGUAGE_THRESHOLD=.85;
const ATLAS_LANGUAGE_MAX_MATCHES=3;
const ATLAS_LANGUAGE_MAX_SNIPPETS=3;
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
export function applyAcademicFusion(assessment,body={}){
  assessment=groundTongueMorphology(assessment,body);
  const signature=body?.academicSignature&&typeof body.academicSignature==='object'?body.academicSignature:null;
  if(!signature)return assessment;
  const matches=matchAtlas(signature);
  const direct=directPatterns(assessment);
  const evidence=evidenceFor(direct);
  const query=[assessment?.combined?.summary,...direct.map(x=>x.label),...(assessment?.combined?.generalSignals||[]).map(x=>x?.label||'')].filter(Boolean).join(' ');
  const textMatches=searchTextCorpus(query,6);
  const visualContext=corpusContext(signature);
  const fused=fuse(assessment,signature,matches,geminiLayer(assessment),evidence);
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
  atlasLanguageThreshold:ATLAS_LANGUAGE_THRESHOLD,
  atlasLanguageMaxMatches:ATLAS_LANGUAGE_MAX_MATCHES,
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
