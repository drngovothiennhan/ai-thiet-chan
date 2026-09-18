import express from 'express';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { installAccessControl } from './access-control.mjs';
import { fileURLToPath } from 'node:url';
import { KNOWLEDGE_VERSION, KNOWLEDGE_SOURCES, TONGUE_KNOWLEDGE, knowledgeForQuery } from './knowledge.mjs';
import { applyAcademicFusion, ACADEMIC_HEALTH } from './academic-server.mjs';
import { analyzeLocalVision, LOCAL_VISION_HEALTH } from './local-vision-engine.mjs';
import { caseRetrievalRuntimeHealth, retrieveSimilarCasesRuntime, formatCaseRetrievalContext, suggestNextSymptomQuestion } from './case-retrieval.mjs';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const VERSION = '2.9.2';
const BUILD = process.env.RENDER_GIT_COMMIT || 'local';
const AI_RATE_LIMIT_WINDOW_MS = Math.max(60_000, Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 600_000));
const AI_RATE_LIMIT_MAX = Math.max(1, Number(process.env.AI_RATE_LIMIT_MAX || 30));
const CASE_STORE_URL = process.env.SUPABASE_URL || 'https://gzmpnsrwqjpsbklyflqr.supabase.co';
const CASE_STORE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Y4hMhXROZ-aVgWoaQ5fFKQ_ZAcXuIzG';
let caseStoreReady = false;

const OPEN_SOURCE_REFERENCES = [
  { name:'TongueDiagnosis.AI', repo:'https://github.com/TonguePicture-SKaRD/TongueDiagnosis', license:'AGPL-3.0', use:'architecture-reference-only', note:'Tham chiếu pipeline định vị lưỡi → phân đoạn → phân loại đặc trưng → LLM; không sao chép mã nguồn hoặc trọng số AGPL.' },
  { name:'OpenCV', repo:'https://github.com/opencv/opencv', license:'Apache-2.0', use:'image-quality-reference', note:'Tham chiếu kỹ thuật QC ảnh: độ nét, phơi sáng, tương phản và tiền xử lý.' },
  { name:'Segment Anything', repo:'https://github.com/facebookresearch/segment-anything', license:'Apache-2.0', use:'segmentation-reference', note:'Tham chiếu kiến trúc tạo mask để chuẩn bị bước tách vùng lưỡi trước phân loại.' },
  { name:'ONNX Runtime', repo:'https://github.com/microsoft/onnxruntime', license:'MIT', use:'inference-runtime-reference', note:'Tham chiếu runtime suy luận đa nền tảng cho mô hình ONNX.' },
  { name:'TensorFlow.js', repo:'https://github.com/tensorflow/tfjs', license:'Apache-2.0', use:'browser-ml-reference', note:'Tham chiếu huấn luyện/chuyển đổi/chạy mô hình trong trình duyệt và định dạng mẫu ML.' }
];

app.disable('x-powered-by');
app.use(express.json({ limit: '24mb' }));
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(self), microphone=(self), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');
  if(req.path.startsWith('/api/')) res.setHeader('Cache-Control','no-store');
  next();
});

const rateBuckets = new Map();
function requestIdentity(req){
  const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
  return (forwarded||req.socket?.remoteAddress||'unknown').slice(0,96);
}
const { consumeCaseAccess }=installAccessControl(app,{supabaseUrl:CASE_STORE_URL,supabaseKey:CASE_STORE_KEY,requestIdentity});
function aiRateLimit(req,res,next){
  if(req.studentAccess?.role==='student') return next();
  const now=Date.now(); const key=requestIdentity(req); let bucket=rateBuckets.get(key);
  if(!bucket||now-bucket.startedAt>=AI_RATE_LIMIT_WINDOW_MS){bucket={startedAt:now,count:0};rateBuckets.set(key,bucket);}
  bucket.count+=1;
  if(bucket.count>AI_RATE_LIMIT_MAX){
    const retryAfter=Math.max(1,Math.ceil((bucket.startedAt+AI_RATE_LIMIT_WINDOW_MS-now)/1000));
    res.setHeader('Retry-After',String(retryAfter));
    return res.status(429).json({error:'AI_RATE_LIMITED',retryAfter});
  }
  next();
}
const cleanupTimer=setInterval(()=>{
  const cutoff=Date.now()-AI_RATE_LIMIT_WINDOW_MS*2;
  for(const [key,bucket] of rateBuckets) if(bucket.startedAt<cutoff) rateBuckets.delete(key);
},AI_RATE_LIMIT_WINDOW_MS);
cleanupTimer.unref?.();

function apiKey(){ return String(process.env.GEMINI_API_KEY||'').trim(); }
function textFromGemini(data){ return (data?.candidates?.[0]?.content?.parts||[]).map(p=>p?.text||'').join('').trim(); }
async function geminiGenerate(key,contents,generationConfig={}){
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(key)}`;
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents,generationConfig:{temperature:0.15,...generationConfig}})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const err=new Error(data?.error?.message||`Gemini HTTP ${response.status}`);err.status=response.status;throw err;}
  return textFromGemini(data);
}
function parseJsonText(text){
  const clean=text.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```$/i,'').trim();
  try{return JSON.parse(clean);}catch{}
  const first=clean.indexOf('{'),last=clean.lastIndexOf('}');
  if(first>=0&&last>first) return JSON.parse(clean.slice(first,last+1));
  throw new Error('AI response is not valid JSON');
}
function clampConfidence(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;}
function qcFactor(qc){return qc?.grade==='good'?1:qc?.grade==='fair'?0.72:0.35;}
function ensureStringArray(v){return Array.isArray(v)?v.map(x=>String(x||'')).filter(Boolean):[];}
function ensureSignalArray(v){return Array.isArray(v)?v.filter(x=>x&&typeof x==='object'):[];}
function normalizeChatReply(text){
  let reply=String(text||'').trim();
  const match=reply.match(/^GROUNDING\s*=\s*(IN|OUT)\s*\n?/i);
  const outside=!match||String(match[1]).toUpperCase()==='OUT';
  if(match)reply=reply.slice(match[0].length).trim();
  reply=reply.replace(/\s*\[A\.I\]\s*$/i,'').trim();
  if(outside)reply=[reply,'[A.I]'].filter(Boolean).join('\n');
  return {reply,outsideKnowledge:outside};
}
function normalizeTongueMorphology(value,legacyFissureText=''){
  const src=value&&typeof value==='object'?value:{};
  const median=src.medianSulcus&&typeof src.medianSulcus==='object'?src.medianSulcus:{};
  const fissure=src.fissure&&typeof src.fissure==='object'?src.fissure:{};
  const toothmarks=src.toothmarks&&typeof src.toothmarks==='object'?src.toothmarks:{};
  const swelling=src.swellingOrThinness&&typeof src.swellingOrThinness==='object'?src.swellingOrThinness:{};
  const allowedStatus=new Set(['unknown','absent','possible','likely','confirmed']);
  const status=v=>allowedStatus.has(String(v||''))?String(v):'unknown';
  return {
    schemaVersion:'tongue-morphology-observation-v2',
    medianSulcus:{
      status:status(median.status),
      prominence:String(median.prominence||'unknown'),
      orientation:String(median.orientation||'unknown'),
      source:String(median.source||'unknown')
    },
    fissure:{
      status:status(fissure.status),
      branching:String(fissure.branching||'unknown'),
      pattern:String(fissure.pattern||'unknown'),
      location:String(fissure.location||'unknown'),
      width:String(fissure.width||'unknown'),
      depth:String(fissure.depth||'not-assessable-from-2d-image'),
      legacyDarkLineSignal:Boolean(fissure.legacyDarkLineSignal),
      source:String(fissure.source||'unknown'),
      interpretationPolicy:String(fissure.interpretationPolicy||'Rãnh giữa không được tự động đồng nhất với nứt lưỡi; tín hiệu đường tối đơn độc không đủ để kết luận nứt.')
    },
    toothmarks:{status:status(toothmarks.status),source:String(toothmarks.source||'unknown')},
    swellingOrThinness:{status:status(swelling.status),source:String(swelling.source||'unknown')},
    legacyFissureText:String(legacyFissureText||'')
  };
}
function llmSafeAssessmentContext(context){
  if(!context||typeof context!=='object') return null;
  const top=context.top&&typeof context.top==='object'?context.top:{};
  const bottom=context.bottom&&typeof context.bottom==='object'?context.bottom:null;
  const combined=context.combined&&typeof context.combined==='object'?context.combined:{};
  const approved=Array.isArray(context.approvedClinicalKnowledge)?context.approvedClinicalKnowledge.slice(0,5).map(x=>({
    similarity:Number(x?.similarity||0),
    exactImageMatch:Boolean(x?.exactImageMatch),
    approvedAt:x?.approvedAt||null,
    professionalTitle:String(x?.professionalTitle||''),
    knowledgeRevision:x?.knowledgeRevision||null,
    clinicalNote:String(x?.clinicalNote||''),
    verifiedClinicalAnnotation:x?.verifiedClinicalAnnotation&&typeof x.verifiedClinicalAnnotation==='object'?x.verifiedClinicalAnnotation:null,
    verificationBasis:String(x?.verificationBasis||''),
    source:String(x?.source||'')
  })):[];
  return {
    schemaVersion:'aitc-llm-observation-context-v2',
    policy:{
      imageInputToLlm:false,
      visualAuthority:'local-vision-only',
      unknownMustRemainUnknown:true,
      medianSulcusIsNotAutomaticallyFissure:true,
      legacyDarkLineSignalIsNotFissureDiagnosis:true,
      fissureDepthFrom2dImageForbidden:true
    },
    mode:context.mode==='general'?'general':'normal',
    top:{
      quality:top.quality||'poor',
      confidence:clampConfidence(top.confidence),
      visualValidity:top.visualValidity||{},
      tongueColor:String(top.tongueColor||'Không xác định'),
      shape:String(top.shape||'Không xác định'),
      coatingColor:String(top.coatingColor||'Không xác định'),
      coatingThickness:String(top.coatingThickness||'Không xác định'),
      coatingTexture:String(top.coatingTexture||'Không xác định'),
      moisture:String(top.moisture||'Không xác định'),
      morphology:normalizeTongueMorphology(top.morphology,top.fissures),
      toothmarks:String(top.toothmarks||'Không xác định'),
      pricklesSpots:String(top.pricklesSpots||'Không xác định'),
      stasisMarks:String(top.stasisMarks||'Không xác định'),
      otherVisibleFeatures:ensureStringArray(top.otherVisibleFeatures),
      theoryAssessment:top.theoryAssessment||{},
      limitations:ensureStringArray(top.limitations)
    },
    bottom:bottom?{
      quality:bottom.quality||'poor',
      confidence:clampConfidence(bottom.confidence),
      visualValidity:bottom.visualValidity||{},
      undersideColor:String(bottom.undersideColor||'Không xác định'),
      vessels:bottom.vessels||{},
      otherVisibleFeatures:ensureStringArray(bottom.otherVisibleFeatures),
      limitations:ensureStringArray(bottom.limitations)
    }:null,
    combined:{
      confidence:clampConfidence(combined.confidence),
      summary:String(combined.summary||''),
      generalSignals:ensureSignalArray(combined.generalSignals),
      stomachPatternSignals:ensureSignalArray(combined.stomachPatternSignals),
      cannotConclude:ensureStringArray(combined.cannotConclude),
      academicFusion:combined.academicFusion&&typeof combined.academicFusion==='object'?combined.academicFusion:null
    },
    approvedClinicalKnowledge:approved,
    knowledgeVersion:String(context.knowledgeVersion||KNOWLEDGE_VERSION)
  };
}

function normalizeTop(top,qc,mode){
  const out=top&&typeof top==='object'?top:{};
  out.confidence=clampConfidence(out.confidence);
  out.quality=['good','fair','poor'].includes(out.quality)?out.quality:(qc?.grade||'poor');
  if(!out.visualValidity||typeof out.visualValidity!=='object') out.visualValidity={};
  out.visualValidity={
    tongueVisible:typeof out.visualValidity.tongueVisible==='boolean'?out.visualValidity.tongueVisible:null,
    wholeTongueVisible:typeof out.visualValidity.wholeTongueVisible==='boolean'?out.visualValidity.wholeTongueVisible:null,
    rootVisible:typeof out.visualValidity.rootVisible==='boolean'?out.visualValidity.rootVisible:null,
    framing:out.visualValidity.framing||'unknown',
    occlusion:out.visualValidity.occlusion||'unknown',
    colorReliability:out.visualValidity.colorReliability||'unknown'
  };
  if(!out.theoryAssessment||typeof out.theoryAssessment!=='object') out.theoryAssessment={};
  out.theoryAssessment={
    generalSignals:ensureSignalArray(out.theoryAssessment.generalSignals),
    stomachPatternSignals:ensureSignalArray(out.theoryAssessment.stomachPatternSignals),
    cannotConclude:ensureStringArray(out.theoryAssessment.cannotConclude)
  };
  out.morphology=normalizeTongueMorphology(out.morphology,out.fissures);
  const fissureStatus=out.morphology.fissure.status;
  out.fissures=fissureStatus==='confirmed'?'Có nứt lưỡi đã được tầng thị giác xác nhận.'
    :fissureStatus==='likely'?'Nghi nứt lưỡi; cần đối chiếu thêm.'
    :out.morphology.fissure.legacyDarkLineSignal?'Có tín hiệu đường tối/rãnh; chưa đủ căn cứ gọi là nứt lưỡi.'
    :'Chưa đủ căn cứ đánh giá nứt lưỡi.';
  out.otherVisibleFeatures=ensureStringArray(out.otherVisibleFeatures);
  out.limitations=ensureStringArray(out.limitations);
  out.confidence=Number((out.confidence*qcFactor(qc)).toFixed(3));
  if(out.visualValidity.tongueVisible===false){
    out.theoryAssessment.generalSignals=[];out.theoryAssessment.stomachPatternSignals=[];out.confidence=Math.min(out.confidence,0.2);
    if(!out.theoryAssessment.cannotConclude.includes('Không xác nhận được mặt trên lưỡi rõ ràng trong ảnh.')) out.theoryAssessment.cannotConclude.push('Không xác nhận được mặt trên lưỡi rõ ràng trong ảnh.');
  }
  if(qc?.grade==='poor'){
    out.theoryAssessment.stomachPatternSignals=[];out.confidence=Math.min(out.confidence,0.25);
    if(!out.theoryAssessment.cannotConclude.includes('Ảnh mặt trên QC kém: không xếp thể từ ảnh này.')) out.theoryAssessment.cannotConclude.push('Ảnh mặt trên QC kém: không xếp thể từ ảnh này.');
  }else if(qc?.grade==='fair') out.confidence=Math.min(out.confidence,0.62);
  if(mode==='general'&&out.visualValidity.rootVisible===false){
    if(!out.limitations.includes('Ảnh mặt trên chưa thấy rõ phần sau/gốc lưỡi.')) out.limitations.push('Ảnh mặt trên chưa thấy rõ phần sau/gốc lưỡi.');
    out.confidence=Math.min(out.confidence,0.72);
  }
  return out;
}

function normalizeBottom(bottom,qc){
  const out=bottom&&typeof bottom==='object'?bottom:{};
  out.confidence=clampConfidence(out.confidence);
  out.quality=['good','fair','poor'].includes(out.quality)?out.quality:(qc?.grade||'poor');
  if(!out.visualValidity||typeof out.visualValidity!=='object') out.visualValidity={};
  out.visualValidity={
    undersideVisible:typeof out.visualValidity.undersideVisible==='boolean'?out.visualValidity.undersideVisible:null,
    vesselsVisible:typeof out.visualValidity.vesselsVisible==='boolean'?out.visualValidity.vesselsVisible:null,
    framing:out.visualValidity.framing||'unknown',
    occlusion:out.visualValidity.occlusion||'unknown',
    colorReliability:out.visualValidity.colorReliability||'unknown'
  };
  if(!out.vessels||typeof out.vessels!=='object') out.vessels={};
  out.vessels={
    visible:typeof out.vessels.visible==='boolean'?out.vessels.visible:Boolean(out.visualValidity.vesselsVisible),
    color:out.vessels.color||'Không xác định',
    prominence:out.vessels.prominence||'Không xác định',
    dilation:out.vessels.dilation||'Không xác định',
    tortuosity:out.vessels.tortuosity||'Không xác định',
    stasisSigns:out.vessels.stasisSigns||'Không xác định',
    measurement:out.vessels.measurement||'Chỉ mô tả định tính khi ảnh không có chuẩn kích thước đáng tin cậy.'
  };
  out.otherVisibleFeatures=ensureStringArray(out.otherVisibleFeatures);
  out.limitations=ensureStringArray(out.limitations);
  out.confidence=Number((out.confidence*qcFactor(qc)).toFixed(3));
  if(out.visualValidity.undersideVisible===false){out.confidence=Math.min(out.confidence,0.2);out.limitations.push('Không xác nhận được mặt dưới lưỡi rõ ràng.');}
  if(out.visualValidity.vesselsVisible===false){out.confidence=Math.min(out.confidence,0.35);out.limitations.push('Không thấy rõ mạch máu/tĩnh mạch dưới lưỡi để đánh giá.');}
  if(qc?.grade==='poor'){out.confidence=Math.min(out.confidence,0.25);out.limitations.push('Ảnh mặt dưới QC kém: chỉ mô tả thô, không suy luận thêm.');}
  else if(qc?.grade==='fair') out.confidence=Math.min(out.confidence,0.62);
  out.limitations=[...new Set(out.limitations)];
  return out;
}

function normalizeAssessment(raw,{mode,topQc,bottomQc}){
  const selectedMode=mode==='general'?'general':'normal';
  const src=raw&&typeof raw==='object'?raw:{};
  const top=normalizeTop(src.top,topQc,selectedMode);
  const bottom=selectedMode==='general'?normalizeBottom(src.bottom,bottomQc):null;
  const combined=src.combined&&typeof src.combined==='object'?src.combined:{};
  combined.confidence=clampConfidence(combined.confidence);
  combined.summary=String(combined.summary||top.summary||'Không có tóm tắt.');
  combined.generalSignals=ensureSignalArray(combined.generalSignals);
  combined.stomachPatternSignals=ensureSignalArray(combined.stomachPatternSignals);
  combined.cannotConclude=ensureStringArray(combined.cannotConclude);
  const factor=selectedMode==='general'?Math.min(qcFactor(topQc),qcFactor(bottomQc)):qcFactor(topQc);
  combined.confidence=Number((combined.confidence*factor).toFixed(3));
  if(top.visualValidity.tongueVisible===false) combined.confidence=Math.min(combined.confidence,0.2);
  if(selectedMode==='general'){
    if(bottom?.visualValidity?.undersideVisible===false||bottom?.visualValidity?.vesselsVisible===false){
      combined.confidence=Math.min(combined.confidence,0.4);
      if(!combined.cannotConclude.includes('Ảnh mặt dưới chưa đủ để đánh giá mạch máu dưới lưỡi.')) combined.cannotConclude.push('Ảnh mặt dưới chưa đủ để đánh giá mạch máu dưới lưỡi.');
    }
    if(top.visualValidity.rootVisible===false){
      combined.confidence=Math.min(combined.confidence,0.65);
      if(!combined.cannotConclude.includes('Ảnh mặt trên chưa thấy rõ phần sau/gốc lưỡi.')) combined.cannotConclude.push('Ảnh mặt trên chưa thấy rõ phần sau/gốc lưỡi.');
    }
  }
  const assessment={mode:selectedMode,top,bottom,combined,knowledgeVersion:KNOWLEDGE_VERSION};
  assessment.ml={
    pipeline:['capture-qc','view-validity','top-feature-extraction','sublingual-vessel-description','knowledge-mapping','combined-assessment'],
    featureVector:{
      schemaVersion:'tongue-dual-view-feature-vector-v2',mode:selectedMode,knowledgeVersion:KNOWLEDGE_VERSION,
      top:{visual:{tongueColor:top.tongueColor||'',shape:top.shape||'',coatingColor:top.coatingColor||'',coatingThickness:top.coatingThickness||'',coatingTexture:top.coatingTexture||'',moisture:top.moisture||'',morphology:top.morphology||normalizeTongueMorphology(null,top.fissures),fissures:top.fissures||'',toothmarks:top.toothmarks||'',pricklesSpots:top.pricklesSpots||'',stasisMarks:top.stasisMarks||''},validity:top.visualValidity,qc:topQc||{},confidence:top.confidence},
      bottom:bottom?{visual:{undersideColor:bottom.undersideColor||'',vessels:bottom.vessels||{},otherVisibleFeatures:bottom.otherVisibleFeatures||[]},validity:bottom.visualValidity,qc:bottomQc||{},confidence:bottom.confidence}:null,
      combined:{confidence:combined.confidence,generalSignals:combined.generalSignals,stomachPatternSignals:combined.stomachPatternSignals}
    },
    storage:'automatic-server-training-store'
  };
  return assessment;
}

async function supabaseRpc(name,payload){
  const response=await fetch(`${CASE_STORE_URL}/rest/v1/rpc/${name}`,{
    method:'POST',headers:{'content-type':'application/json','apikey':CASE_STORE_KEY,'authorization':`Bearer ${CASE_STORE_KEY}`},body:JSON.stringify(payload)
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok) throw new Error(data?.message||data?.hint||`Case store HTTP ${response.status}`);
  return data;
}
async function ensureCaseStoreSecret(){
  const token=apiKey();if(!token){caseStoreReady=false;return false;}
  try{const ok=await supabaseRpc('ai_thiet_chan_register_secret',{p_token:token});caseStoreReady=Boolean(ok);}catch(err){caseStoreReady=false;console.error('case_store_register_error',err?.message||err);}
  return caseStoreReady;
}
function imageHash(image){
  const base64=String(image||'').includes(',')?String(image).split(',').pop():String(image||'');
  return createHash('sha256').update(base64).digest('hex');
}
function caseHash(mode,topImage,bottomImage){
  const top=imageHash(topImage);const bottom=bottomImage?imageHash(bottomImage):'';
  return createHash('sha256').update(`${mode}:${top}:${bottom}`).digest('hex');
}
async function storeTrainingCase({mode,topImage,topMimeType,topQc,bottomImage,bottomMimeType,bottomQc,assessment}){
  if(!caseStoreReady) await ensureCaseStoreSecret();
  if(!caseStoreReady) throw new Error('CASE_STORE_NOT_READY');
  const payload={
    p_token:apiKey(),p_case_hash:caseHash(mode,topImage,bottomImage),p_assessment_mode:mode,
    p_top_image_hash:imageHash(topImage),p_top_image_data_url:topImage,p_top_mime_type:topMimeType||'image/jpeg',
    p_bottom_image_hash:bottomImage?imageHash(bottomImage):null,p_bottom_image_data_url:bottomImage||null,p_bottom_mime_type:bottomImage?(bottomMimeType||'image/jpeg'):null,
    p_qc:{top:topQc||{},bottom:bottomQc||null},p_analysis:assessment||{},p_feature_vector:assessment?.ml?.featureVector||{},p_model:assessment?.ml?.visionEngine?.engine||LOCAL_VISION_HEALTH.engine,p_knowledge_version:KNOWLEDGE_VERSION
  };
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
    try{return await supabaseRpc('ai_thiet_chan_store_case_v2',payload);}catch(err){lastError=err;if(attempt<2) await new Promise(r=>setTimeout(r,500*(attempt+1)));}
  }
  throw lastError;
}
async function listTrainingCases(limit=30){
  if(!caseStoreReady) await ensureCaseStoreSecret();
  if(!caseStoreReady) throw new Error('CASE_STORE_NOT_READY');
  return supabaseRpc('ai_thiet_chan_list_cases_v2',{p_token:apiKey(),p_limit:Math.min(100,Math.max(1,Number(limit)||30))});
}

function validateImage(image,label){
  if(typeof image!=='string'||image.length<100){const err=new Error(`${label}_REQUIRED`);err.status=400;throw err;}
  const base64=image.includes(',')?image.split(',').pop():image;
  if(base64.length>14_000_000){const err=new Error(`${label}_TOO_LARGE`);err.status=413;throw err;}
  return base64;
}

app.get('/api/health',async(req,res)=>res.json({
  ok:true,app:'A.I Thiệt Chẩn',architecture:'independent-web',legacyPlatform:false,version:VERSION,build:BUILD.slice(0,12),
  providerConfigured:Boolean(apiKey()),sharedProvider:true,clientSuppliedKeyAccepted:false,model:MODEL,consultationModel:MODEL,knowledgeVersion:KNOWLEDGE_VERSION,
  vision:{provider:'local',engine:LOCAL_VISION_HEALTH.engine,geminiVision:false,analysisRequiresProvider:false,inputContract:LOCAL_VISION_HEALTH.inputContract,semanticMode:LOCAL_VISION_HEALTH.semanticMode},
  consultation:{provider:'Gemini',configured:Boolean(apiKey()),model:MODEL,role:'post-analysis-reasoning-only',resilience:{primary:'gemini-3.8-flash',directFallback:'gemini-3.6-flash',gatewayAvailable:Boolean(process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN),gatewayEnabled:String(process.env.AI_GATEWAY_ENABLED||'auto').toLowerCase()!=='false',gatewayModel:String(process.env.AITC_AI_GATEWAY_PRIMARY_MODEL||process.env.AI_GATEWAY_PRIMARY_MODEL||'openai/gpt-5.6-sol'),localKnowledgeFallback:true,visionSentToLlm:false}},
  caseReasoningRetrieval:await caseRetrievalRuntimeHealth(),
  knowledgeSources:KNOWLEDGE_SOURCES.length,openSourceReferences:OPEN_SOURCE_REFERENCES.length,
  assessmentModes:['normal','general'],generalAssessmentViews:['top','bottom'],
  academicVision:ACADEMIC_HEALTH,
  caseCollection:{mode:'automatic',history:true,deduplicate:'sha256-composite',storeReady:caseStoreReady},
  aiRateLimit:{windowMs:AI_RATE_LIMIT_WINDOW_MS,max:AI_RATE_LIMIT_MAX,appliesTo:['analyze','report']},
  chatPolicy:{provider:'Gemini',applicationRateLimit:false,outsideKnowledgeSuffix:'[A.I]',documentVoice:true,atlasLanguageThreshold:ACADEMIC_HEALTH.atlasLanguageThreshold},
  access:{guestAnalysesPerDay:5,studentUnlimited:true},time:new Date().toISOString()
}));
app.get('/api/sources',(req,res)=>res.json({ok:true,version:VERSION,references:OPEN_SOURCE_REFERENCES}));
app.get('/api/cases',async(req,res)=>{
  try{
    if(!apiKey()) return res.status(428).json({error:'AI_PROVIDER_NOT_CONFIGURED'});
    const cases=await listTrainingCases(req.query.limit||30);
    return res.json({ok:true,cases:Array.isArray(cases)?cases:[],collectionMode:'automatic'});
  }catch(err){console.error('case_history_error',err?.message||err);return res.status(503).json({error:'CASE_HISTORY_UNAVAILABLE'});}
});

app.post('/api/analyze',aiRateLimit,async(req,res)=>{
  try{
    const body=req.body||{};const mode=body.mode==='general'?'general':'normal';
    const topImage=body.topImage||body.image;const topMimeType=body.topMimeType||body.mimeType||'image/jpeg';const topQc=body.topQc||body.qc||{};
    const bottomImage=mode==='general'?body.bottomImage:null;const bottomMimeType=body.bottomMimeType||'image/jpeg';const bottomQc=mode==='general'?(body.bottomQc||{}):null;
    validateImage(topImage,'TOP_IMAGE');
    if(mode==='general')validateImage(bottomImage,'BOTTOM_IMAGE');
    const accessQuota=await consumeCaseAccess(req);

    const local=analyzeLocalVision(body,{mode,topQc,bottomQc});
    let assessment=normalizeAssessment(local.assessment,{mode,topQc,bottomQc});
    assessment.ml=assessment.ml||{};
    assessment.ml.visionEngine={...local.provenance,geminiVision:false,authority:'image-observation'};
    try{assessment=applyAcademicFusion(assessment,body);}catch(err){console.error('academic_fusion_error',err?.message||err);}

    let collection={ok:false,stored:false,duplicate:false};
    try{
      const saved=await storeTrainingCase({mode,topImage,topMimeType,topQc,bottomImage,bottomMimeType,bottomQc,assessment});
      collection={ok:true,stored:Boolean(saved?.stored),duplicate:Boolean(saved?.duplicate),caseId:saved?.id||null};
    }catch(err){console.error('case_store_error',err?.message||err);collection={ok:false,error:'CASE_STORE_FAILED'};}

    return res.json({
      ok:true,assessment,analysis:assessment,
      model:LOCAL_VISION_HEALTH.engine,visionModel:LOCAL_VISION_HEALTH.engine,
      geminiVision:false,consultationModel:MODEL,knowledgeVersion:KNOWLEDGE_VERSION,
      collection,access:accessQuota
    });
  }catch(err){
    console.error('analyze_error',err?.message||err);
    const status=[400,413,422,429].includes(Number(err?.status))?Number(err.status):503;
    return res.status(status).json({error:err?.code||'ANALYZE_FAILED',message:err?.message||'Unknown error',geminiVision:false});
  }
});
app.post('/api/symptom-next',async(req,res)=>{
  const startedAt=Date.now();
  try{
    const {assessment,analysis,symptomContext,message}=req.body||{};
    const context=assessment||analysis;
    const llmContext=llmSafeAssessmentContext(context);
    if(!llmContext)return res.status(400).json({error:'ANALYSIS_REQUIRED'});
    const confirmed=String(symptomContext||message||'').slice(0,5000);
    const contextText=JSON.stringify(llmContext);
    const caseRetrieval=await retrieveSimilarCasesRuntime(`${contextText}\n${confirmed}`,{limit:4});
    const suggestion=suggestNextSymptomQuestion(confirmed,caseRetrieval);
    const elapsedMs=Date.now()-startedAt;
    console.info('symptom_rag_question',JSON.stringify({
      elapsedMs,
      returned:Number(caseRetrieval?.returned||0),
      mode:String(caseRetrieval?.mode||'disabled'),
      errorCode:caseRetrieval?.errorCode||null,
      conceptId:suggestion.conceptId,
      supportCases:suggestion.supportCases,
      evidenceBased:suggestion.evidenceBased
    }));
    return res.json({
      ok:true,
      reply:suggestion.question,
      engine:suggestion.engine,
      evidenceBased:suggestion.evidenceBased,
      selectedConcept:suggestion.conceptId,
      supportCases:suggestion.supportCases,
      consideredCases:suggestion.consideredCases,
      timingMs:elapsedMs,
      caseRetrieval:{
        corpusId:caseRetrieval?.corpusId||null,
        engine:caseRetrieval?.engine||null,
        active:Boolean(caseRetrieval?.active),
        returned:Number(caseRetrieval?.returned||0),
        limit:Number(caseRetrieval?.limit||4),
        terms:Array.isArray(caseRetrieval?.terms)?caseRetrieval.terms:[],
        errorCode:caseRetrieval?.errorCode||null,
        mode:caseRetrieval?.mode||'disabled'
      }
    });
  }catch(err){
    console.error('symptom_rag_question_error',err?.message||err);
    return res.status(503).json({error:'SYMPTOM_RAG_UNAVAILABLE',message:'Không truy hồi được câu hỏi đối chiếu lúc này.'});
  }
});

app.post('/api/chat',async(req,res)=>{
  try{
    const key=apiKey();if(!key) return res.status(428).json({error:'AI_PROVIDER_NOT_CONFIGURED'});
    const {assessment,analysis,message}=req.body||{};if(!message||typeof message!=='string') return res.status(400).json({error:'MESSAGE_REQUIRED'});
    const context=assessment||analysis;
    const llmContext=llmSafeAssessmentContext(context);
    const contextText=llmContext?JSON.stringify(llmContext):'Chưa có kết quả phân tích hình lưỡi.';
    const hasAssessment=Boolean(llmContext);
    const retrievedKnowledge=hasAssessment?knowledgeForQuery(`${contextText}\n${message}`,{limit:18}):TONGUE_KNOWLEDGE;
    const caseRetrieval=hasAssessment?await retrieveSimilarCasesRuntime(`${contextText}\n${message}`,{limit:4}):null;
    const retrievedCases=caseRetrieval?formatCaseRetrievalContext(caseRetrieval):'';
    const caseRetrievalSection=retrievedCases?`\n\nCA TƯƠNG TỰ TỪ ${caseRetrieval.corpusId} (retrieval top-k, không phải gold):\n${retrievedCases}`:'';
    const prompt=`[CHAT_GROUNDING_PROTOCOL]\nBạn là chatbot Gemini của A.I Thiệt Chẩn. Gemini chỉ phân tích KẾT QUẢ CẤU TRÚC do tầng thị giác cục bộ cung cấp; Gemini không được xem ảnh và không được tạo thêm quan sát hình ảnh. Ưu tiên tuyệt đối hệ tri thức được cung cấp, kết quả quan sát cấu trúc của ca hiện tại và dữ kiện Thập vấn do người dùng cung cấp. Không tự thêm triệu chứng, mạch chẩn, chẩn đoán bệnh hay kê đơn. Nếu là ca tổng quát, phân biệt rõ dữ liệu từ mặt trên và mặt dưới lưỡi. Nếu người dùng hỏi về một thể YHCT, nêu dấu nào nhìn thấy và dấu nào còn thiếu trong tứ chẩn.\n\nQUY TẮC HÌNH THÁI ƯU TIÊN: medianSulcus (rãnh giữa) và fissure (nứt) là hai trường khác nhau. Không được gọi rãnh giữa là nứt chỉ vì có một đường dọc giữa. legacyDarkLineSignal chỉ là tín hiệu điểm/đường tối thô và KHÔNG đủ để kết luận nứt. Nếu morphology.fissure.status=unknown thì phải nói chưa đủ căn cứ đánh giá nứt. Không suy đoán độ sâu nứt từ ảnh 2D. Chỉ mô tả branching/pattern/location khi trường tương ứng khác unknown.\n\nGIỌNG VĂN: dùng thuật ngữ, cách gọi và nhịp diễn đạt của tài liệu/hệ tri thức đã cung cấp khi có nội dung tương ứng; không thay bằng từ ngữ chat đời thường nếu tài liệu đã có thuật ngữ chuẩn. Nếu bối cảnh có combined.academicFusion.atlasLanguage.applied=true và câu hỏi liên quan trực tiếp đến dấu đó, giữ nguyên trường wording của tài liệu khi diễn đạt phần đối chiếu.\n\nQUY TẮC CA TƯƠNG TỰ: nếu phần CA TƯƠNG TỰ xuất hiện, đó chỉ là các ca được SQLite FTS5 truy hồi để đối chiếu cách lập luận. Chúng không phải gold, không được dùng để tự tạo thêm triệu chứng, không biến đáp án lịch sử trong corpus thành chẩn đoán cho ca hiện tại, và không được sao chép khuyến nghị thuốc/phương vào tư vấn cá thể. Chỉ nêu tương đồng/khác biệt khi dữ kiện hiện tại thực sự hỗ trợ.\n\nQUY TẮC NGOÀI TÀI LIỆU: nếu toàn bộ nội dung y học/YHCT trong câu trả lời đều được hỗ trợ trực tiếp bởi HỆ TRI THỨC hoặc dữ kiện ca hiện tại, dòng đầu phải là GROUNDING=IN. Nếu có bất kỳ phần trả lời nào dựa trên kiến thức chung của Gemini mà không có trong HỆ TRI THỨC/dữ kiện ca hiện tại, vẫn được trả lời nhưng dòng đầu phải là GROUNDING=OUT. Không tự ghi ký hiệu [A.I]; máy chủ sẽ gắn ký hiệu đó ở cuối câu trả lời. Không bịa nguồn hoặc giả vờ nội dung ngoài tài liệu là nội dung đã nạp.\n\nHỆ TRI THỨC ${KNOWLEDGE_VERSION}:\n${retrievedKnowledge}${caseRetrievalSection}\n\nBối cảnh phân tích: ${contextText}\nCâu hỏi người dùng: ${message}\nTrả lời bằng tiếng Việt theo hướng học tập/tham khảo. Nếu đã có kết quả thiệt chẩn, cuối phần nội dung có thể thêm mục “Nguồn đối chiếu” và chỉ liệt kê đúng tài liệu/trang thực sự đã dùng trong lập luận; nếu không có nguồn cụ thể thì không tạo mục nguồn.`;
    const raw=await geminiGenerate(key,[{role:'user',parts:[{text:prompt}]}],{temperature:0.15});
    const normalized=normalizeChatReply(raw);
    return res.json({ok:true,reply:normalized.reply,model:MODEL,knowledgeVersion:KNOWLEDGE_VERSION,grounding:normalized.outsideKnowledge?'ai-general':'supplied-knowledge',applicationRateLimited:false,caseRetrieval:caseRetrieval?{corpusId:caseRetrieval.corpusId,engine:caseRetrieval.engine,active:caseRetrieval.active,returned:caseRetrieval.returned,limit:caseRetrieval.limit,terms:caseRetrieval.terms,errorCode:caseRetrieval.errorCode,mode:caseRetrieval.mode||'local'}: {active:false,returned:0,reason:'assessment-required'}});
  }catch(err){console.error('chat_error',err?.message||err);return res.status(502).json({error:'CHAT_FAILED',message:err?.message||'Unknown error'});}
});

app.post('/api/report',aiRateLimit,async(req,res)=>{
  try{
    const key=apiKey();if(!key) return res.status(428).json({error:'AI_PROVIDER_NOT_CONFIGURED'});
    const {mode='normal',assessment,analysis,topQc,bottomQc,qc}=req.body||{};const data=assessment||analysis;if(!data) return res.status(400).json({error:'ANALYSIS_REQUIRED'});
    const llmData=llmSafeAssessmentContext(data);
    const prompt=`Tạo báo cáo tổng kết ca ngắn gọn bằng tiếng Việt từ dữ liệu CẤU TRÚC dưới đây. Gemini không được tạo thêm quan sát hình ảnh. Với hình thái rãnh/nứt: rãnh giữa (medianSulcus) không tự động đồng nghĩa với nứt; legacyDarkLineSignal không đủ để kết luận nứt; nếu fissure.status=unknown phải ghi chưa đủ căn cứ; không suy đoán độ sâu từ ảnh 2D. Với ca bình thường: trình bày mặt trên lưỡi và nhận định tổng hợp. Với ca tổng quát: bắt buộc tách (1) chất lượng ảnh mặt trên; (2) quan sát mặt trên; (3) chất lượng ảnh mặt dưới; (4) quan sát mạch máu/tĩnh mạch dưới lưỡi; (5) nhận định kết hợp; (6) giới hạn. Không thêm bệnh danh, triệu chứng, mạch chẩn, điều trị hay phương thuốc không có trong đầu vào. Không biến tín hiệu thiệt tượng thành chẩn đoán xác định. Không hiển thị tên tài liệu, nguồn tham khảo, mã citation hoặc số trang. Dùng giọng văn và thuật ngữ của hệ tri thức; nếu analysis.combined.academicFusion.atlasLanguage.applied=true thì giữ nguyên wording tương ứng trong phần đối chiếu hình ảnh.\nMode: ${mode}\nQC mặt trên: ${JSON.stringify(topQc||qc||{})}\nQC mặt dưới: ${JSON.stringify(bottomQc||null)}\nPhân tích cấu trúc: ${JSON.stringify(llmData)}\nKnowledge: ${KNOWLEDGE_VERSION}`;
    const report=await geminiGenerate(key,[{role:'user',parts:[{text:prompt}]}],{temperature:0.05});
    return res.json({ok:true,report,model:MODEL,knowledgeVersion:KNOWLEDGE_VERSION});
  }catch(err){console.error('report_error',err?.message||err);return res.status(err?.status===429?429:502).json({error:'REPORT_FAILED',message:err?.message||'Unknown error'});}
});

app.use(express.static(path.join(__dirname,'public'),{maxAge:0,etag:true,setHeaders:(res,filePath)=>{if(/\.(html|js|css|webmanifest|svg)$/i.test(filePath)) res.setHeader('Cache-Control','no-cache');}}));
app.use((req,res)=>{res.setHeader('Cache-Control','no-cache');res.sendFile(path.join(__dirname,'public','index.html'));});

await ensureCaseStoreSecret();
app.listen(PORT,'0.0.0.0',()=>console.log(`A.I Thiệt Chẩn web v${VERSION} listening on ${PORT} · sharedGemini=${Boolean(apiKey())} · autoTrainingStore=${caseStoreReady} · dualView=true · academic350=${ACADEMIC_HEALTH.enabled}`));