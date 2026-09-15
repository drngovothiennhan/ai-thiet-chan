import {MODERN_EVIDENCE,WEIGHTS,FUSION_VERSION,KNOWLEDGE_VERSION,SOURCE} from './academic-source.js';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
export function directPatterns(assessment){
  const t=assessment?.top||{};
  const text=[t.tongueColor,t.shape,t.coatingColor,t.coatingThickness,t.coatingTexture,t.moisture,t.fissures,t.toothmarks,t.pricklesSpots,t.stasisMarks].join(' ').toLowerCase();
  const out=[],add=(label,ev,score)=>out.push({label,directEvidence:ev,score});
  if(/đỏ/.test(text)&&/vàng/.test(text))add('Tín hiệu nhiệt / thực nhiệt','Chất lưỡi đỏ phối hợp rêu vàng.',.72);
  if(/nhợt|nhạt/.test(text)&&/trắng/.test(text))add('Tín hiệu hư hàn','Chất lưỡi nhợt/nhạt phối hợp rêu trắng.',.68);
  if(/dày|nhầy|dính|bẩn/.test(text))add('Tín hiệu thấp trọc / đàm hoặc tích trệ','Rêu dày/nhầy/dính cần đối chiếu thấp trọc, đàm hoặc tích trệ.',.62);
  if(/tím|ứ/.test(text))add('Tín hiệu khí huyết ứ trệ','Màu tím/ám tím hoặc dấu ứ nhìn thấy.',.66);
  if(/nứt/.test(text)&&/khô/.test(text)&&/đỏ/.test(text))add('Tín hiệu âm dịch hao tổn / nhiệt thương tân','Đỏ phối hợp nứt và thiên khô.',.64);
  if(/hằn răng|dấu răng/.test(text)&&/nhợt|nhạt/.test(text))add('Tín hiệu Tỳ khí/Tỳ dương hư kèm thấp','Nhợt/nhạt phối hợp dấu răng hoặc hình bệu.',.60);
  return out;
}
export function evidenceFor(patterns){
  const hay=patterns.map(p=>p.label.toLowerCase()).join(' ');
  const scored=MODERN_EVIDENCE.map(e=>{let s=0;for(const t of e.topics)if(hay.includes(t.toLowerCase()))s++;return{...e,s};}).sort((a,b)=>b.s-a.s||String(a.source).localeCompare(String(b.source))||a.page-b.page);
  return scored.filter((e,i)=>e.s>0||i<6).slice(0,10);
}
export function extractJson(text){const s=String(text||'').replace(/^```json\s*/i,'').replace(/^```\s*/i,'').trim(),first=s.indexOf('{'),last=s.lastIndexOf('}');if(first<0||last<=first)return null;try{return JSON.parse(s.slice(first,last+1));}catch{return null;}}
export function fuse(assessment,sig,matches,gemini,evidence){
  const direct=clamp(assessment?.combined?.confidence||assessment?.top?.confidence||0),atlas=clamp(matches[0]?.similarity||0);
  const geminiPatterns=Array.isArray(gemini?.patternCandidates)?gemini.patternCandidates:[],directP=directPatterns(assessment),byLabel=new Map();
  for(const p of [...directP,...geminiPatterns]){const key=String(p.label||'').trim();if(!key)continue;const prev=byLabel.get(key)||{label:key};byLabel.set(key,{...prev,...p});}
  const candidates=[...byLabel.values()].map(p=>{const gp=clamp(p.score||0),local=directP.find(x=>x.label===p.label),directScore=clamp(local?.score||0);const atlasSupport=atlas>=.72?.82:atlas>=.60?.64:atlas>=.50?.48:.25,layers=[directScore>=.55,atlasSupport>=.55,gp>=.55].filter(Boolean).length;const score=clamp(WEIGHTS.directImage*directScore+WEIGHTS.atlasSimilarity*atlasSupport+WEIGHTS.geminiAcademic*gp);return {...p,directEvidence:p.directEvidence||local?.directEvidence||'',atlasEvidence:p.atlasEvidence||`Top atlas similarity ${Math.round(atlas*100)}%`,academicEvidence:p.academicEvidence||'',score:Number(score.toFixed(3)),accepted:layers>=2,layers};}).filter(p=>p.accepted).sort((a,b)=>b.score-a.score).slice(0,4);
  const academic=candidates.length?candidates.reduce((s,p)=>s+p.score,0)/candidates.length:clamp(geminiPatterns[0]?.score||.35);
  const weighted=WEIGHTS.directImage*direct+WEIGHTS.atlasSimilarity*atlas+WEIGHTS.geminiAcademic*academic,q=assessment?.top?.quality,cap=q==='good'?.88:q==='fair'?.62:.25;
  const finalConfidence=Math.max(0,Math.min(cap,direct+.08,weighted));
  const agreement=(direct>=.60&&atlas>=.68&&academic>=.60)?'strong':([direct>=.52,atlas>=.58,academic>=.52].filter(Boolean).length>=2?'moderate':'weak');
  const existing=Array.isArray(assessment?.combined?.generalSignals)?assessment.combined.generalSignals:[];
  const additions=candidates.map(p=>({label:p.label,evidence:[p.directEvidence,p.atlasEvidence].filter(Boolean).join(' | '),rule:'Chỉ giữ khi tối thiểu 2/3 lớp bằng chứng đồng thuận (ảnh trực tiếp + atlas Knowledge + học thuật Gemini).',confidence:p.score}));
  const seen=new Set(existing.map(x=>String(x?.label||'').toLowerCase()));assessment.combined.generalSignals=[...existing,...additions.filter(x=>!seen.has(x.label.toLowerCase()))];
  assessment.combined.confidence=Number(finalConfidence.toFixed(3));
  const base=String(assessment.combined.summary||assessment?.top?.summary||'').trim();
  const tail=agreement==='strong'?'Đối chiếu học thuật đa lớp có độ đồng thuận cao.':agreement==='moderate'?'Đối chiếu học thuật đa lớp có độ đồng thuận trung bình; vẫn cần Vấn chẩn/Tứ chẩn để củng cố.':'Đối chiếu học thuật đa lớp còn yếu hoặc không đồng nhất; không nâng mức kết luận.';
  assessment.combined.summary=[base,tail].filter(Boolean).join(' ');
  assessment.combined.academicFusion={version:FUSION_VERSION,knowledgeVersion:KNOWLEDGE_VERSION,weights:WEIGHTS,agreement,finalConfidence:Number(finalConfidence.toFixed(3)),sourceDocument:SOURCE,atlasMatches:matches.map(m=>({id:m.id,sourceId:m.sourceId,page:m.page,kind:m.kind,similarity:m.similarity,hash:m.hash,usage:'visual-similarity-only'})),evidence:evidence.map(e=>({source:e.source,page:e.page,text:e.text})),geminiAcademic:gemini||null,acceptedPatterns:candidates.map(p=>({label:p.label,score:p.score,layers:p.layers})),rule:'Không chuyển bệnh danh ca atlas thành chẩn đoán; chỉ nhận định khi ít nhất 2/3 lớp bằng chứng đồng thuận.'};
  assessment.ml=assessment.ml||{};assessment.ml.academicFusion=assessment.combined.academicFusion;
  if(assessment.ml.featureVector)assessment.ml.featureVector.academic={source:'KNOWLEDGE-5DOC',signature:sig,atlasMatches:assessment.combined.academicFusion.atlasMatches,acceptedPatterns:assessment.combined.academicFusion.acceptedPatterns};
  return assessment;
}
