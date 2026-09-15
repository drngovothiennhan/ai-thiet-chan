import express from 'express';
import {aiAdmission} from './request-budget.mjs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { installAccessControl } from './access-control.mjs';
import { fileURLToPath } from 'node:url';
import { KNOWLEDGE_VERSION, KNOWLEDGE_SOURCES, TONGUE_KNOWLEDGE, knowledgeForQuery } from './knowledge.mjs';
import { applyAcademicFusion, ACADEMIC_HEALTH } from './academic-server.mjs';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const VERSION = '2.9.1';
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
app.use(aiAdmission());
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
async function geminiGenerate(key,contents,generationConfig={},signal,trace={}){
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(key)}`;
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},signal,body:JSON.stringify({contents,generationConfig:{temperature:0.15,...generationConfig}})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const err=new Error(data?.error?.message||`Gemini HTTP ${response.status}`);err.status=response.status;throw err;}
  trace.model=response.headers.get('x-ai-fallback')==='local-knowledge'?'local-knowledge':response.headers.get('x-ai-model')||MODEL;
  trace.fallback=response.headers.get('x-ai-fallback')||'unknown';
  trace.elapsedMs=Number(response.headers.get('x-ai-elapsed-ms'))||null;
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
  if(!raw||typeof raw!=='object'||!raw.top||!raw.combined||typeof raw.top.visualValidity?.tongueVisible!=='boolean')throw new Error('VISION_RESPONSE_INCOMPLETE');
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
      schemaVersion:'tongue-dual-view-feature-vector-v1',mode:selectedMode,knowledgeVersion:KNOWLEDGE_VERSION,
      top:{visual:{tongueColor:top.tongueColor||'',shape:top.shape||'',coatingColor:top.coatingColor||'',coatingThickness:top.coatingThickness||'',coatingTexture:top.coatingTexture||'',moisture:top.moisture||'',fissures:top.fissures||'',toothmarks:top.toothmarks||'',pricklesSpots:top.pricklesSpots||'',stasisMarks:top.stasisMarks||''},validity:top.visualValidity,qc:topQc||{},confidence:top.confidence},
      bottom:bottom?{visual:{undersideColor:bottom.undersideColor||'',vessels:bottom.vessels||{},otherVisibleFeatures:bottom.otherVisibleFeatures||[]},validity:bottom.visualValidity,qc:bottomQc||{},confidence:bottom.confidence}:null,
      combined:{confidence:combined.confidence,generalSignals:combined.generalSignals,stomachPatternSignals:combined.stomachPatternSignals}
    },
    storage:'automatic-server-training-store'
  };
  return assessment;
}

async function supabaseRpc(name,payload,signal){
  const response=await fetch(`${CASE_STORE_URL}/rest/v1/rpc/${name}`,{
    method:'POST',signal,headers:{'content-type':'application/json','apikey':CASE_STORE_KEY,'authorization':`Bearer ${CASE_STORE_KEY}`},body:JSON.stringify(payload)
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok) throw new Error(data?.message||data?.hint||`Case store HTTP ${response.status}`);
  return data;
}
async function ensureCaseStoreSecret(signal=AbortSignal.timeout(5000)){
  const token=apiKey();if(!token){caseStoreReady=false;return false;}
  try{const ok=await supabaseRpc('ai_thiet_chan_register_secret',{p_token:token},signal);caseStoreReady=Boolean(ok);}catch(err){caseStoreReady=false;console.error('case_store_register_error',err?.message||err);}
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
async function storeTrainingCase({mode,topImage,topMimeType,topQc,bottomImage,bottomMimeType,bottomQc,assessment,signal,providerModel=MODEL}){
  const deadline=AbortSignal.timeout(6000);
  const storageSignal=signal?AbortSignal.any([signal,deadline]):deadline;
  if(!caseStoreReady) await ensureCaseStoreSecret(storageSignal);
  if(!caseStoreReady) throw new Error('CASE_STORE_NOT_READY');
  const payload={
    p_token:apiKey(),p_case_hash:caseHash(mode,topImage,bottomImage),p_assessment_mode:mode,
    p_top_image_hash:imageHash(topImage),p_top_image_data_url:topImage,p_top_mime_type:topMimeType||'image/jpeg',
    p_bottom_image_hash:bottomImage?imageHash(bottomImage):null,p_bottom_image_data_url:bottomImage||null,p_bottom_mime_type:bottomImage?(bottomMimeType||'image/jpeg'):null,
    p_qc:{top:topQc||{},bottom:bottomQc||null},p_analysis:assessment||{},p_feature_vector:assessment?.ml?.featureVector||{},p_model:providerModel,p_knowledge_version:KNOWLEDGE_VERSION
  };
  // A storage failure must not trigger another analysis or three serial waits.
  return supabaseRpc('ai_thiet_chan_store_case_v2',payload,storageSignal);
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

app.get('/api/health',(req,res)=>res.json({
  ok:true,app:'A.I Thiệt Chẩn',architecture:'independent-web',legacyPlatform:false,version:VERSION,build:BUILD.slice(0,12),
  providerConfigured:Boolean(apiKey()),sharedProvider:true,clientSuppliedKeyAccepted:false,model:MODEL,knowledgeVersion:KNOWLEDGE_VERSION,
  knowledgeSources:KNOWLEDGE_SOURCES.length,openSourceReferences:OPEN_SOURCE_REFERENCES.length,
  assessmentModes:['normal','general'],generalAssessmentViews:['top','bottom'],
  academicVision:ACADEMIC_HEALTH,
  caseCollection:{mode:'automatic',history:true,deduplicate:'sha256-composite',storeReady:caseStoreReady},
  aiRateLimit:{windowMs:AI_RATE_LIMIT_WINDOW_MS,max:AI_RATE_LIMIT_MAX},access:{guestAnalysesPerDay:5,studentUnlimited:true},time:new Date().toISOString()
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
    const key=apiKey();if(!key) return res.status(428).json({error:'AI_PROVIDER_NOT_CONFIGURED'});
    const body=req.body||{};const mode=body.mode==='general'?'general':'normal';
    const topImage=body.topImage||body.image;const topMimeType=body.topMimeType||body.mimeType||'image/jpeg';const topQc=body.topQc||body.qc||{};
    const bottomImage=mode==='general'?body.bottomImage:null;const bottomMimeType=body.bottomMimeType||'image/jpeg';const bottomQc=mode==='general'?(body.bottomQc||{}):null;
    const topBase64=validateImage(topImage,'TOP_IMAGE');
    const bottomBase64=mode==='general'?validateImage(bottomImage,'BOTTOM_IMAGE'):null;
    const accessQuota=await consumeCaseAccess(req);
    const prompt=`Bạn là bộ phân tích thiệt tượng YHCT của A.I Thiệt Chẩn. Chỉ dùng HỆ TRI THỨC được cung cấp và những gì nhìn thấy trực tiếp trong ảnh. Không tự bịa triệu chứng, mạch chẩn, bệnh danh, nguyên nhân, điều trị hay phương thuốc. Công cụ chỉ hỗ trợ học tập/tham khảo, không phải chẩn đoán xác định. Trong JSON phân tích tuyệt đối không xuất tên tài liệu, mã nguồn, số trang, mục Nguồn đối chiếu hoặc mục Tham khảo.

CHẾ ĐỘ: ${mode==='general'?'TỔNG QUÁT - 2 ảnh mặt trên và mặt dưới lưỡi':'BÌNH THƯỜNG - 1 ảnh mặt trên lưỡi'}
QC MẶT TRÊN: ${JSON.stringify(topQc)}
QC MẶT DƯỚI: ${JSON.stringify(bottomQc)}
HỆ TRI THỨC ${KNOWLEDGE_VERSION}:
${TONGUE_KNOWLEDGE}

YÊU CẦU MẶT TRÊN:
- Xác nhận có đúng mặt trên lưỡi, có thấy toàn bộ lưỡi hay không; ở chế độ tổng quát đánh giá thêm phần sau/gốc lưỡi có được bộc lộ rõ hay không.
- Mô tả hình dạng, màu chất lưỡi, rêu lưỡi, độ ẩm, nứt, hằn răng, gai/điểm, ban/điểm ứ và đặc điểm nhìn thấy khác.
- Không chẩn đoán bệnh vùng họng; phần vùng họng chỉ dùng để đánh giá mức bộc lộ phần sau/gốc lưỡi.

YÊU CẦU MẶT DƯỚI (chỉ khi chế độ tổng quát):
- Xác nhận có đúng mặt dưới lưỡi và mạch máu/tĩnh mạch dưới lưỡi có nhìn thấy rõ hay không.
- Mô tả màu mặt dưới; tình trạng mạch máu/tĩnh mạch: màu, mức nổi, giãn, uốn lượn/ngoằn ngoèo, dấu ứ nhìn thấy nếu có.
- Theo tài liệu, chỉ dùng tiêu chí đường kính/chiều dài khi ảnh có chuẩn kích thước đáng tin cậy; ảnh thông thường chỉ mô tả định tính.
- Không biến thay đổi mạch dưới lưỡi thành chẩn đoán bệnh xác định.

TỔNG HỢP:
- Tách rõ quan sát mặt trên, quan sát mặt dưới và nhận định kết hợp.
- Mỗi diễn giải YHCT phải nêu bằng chứng nhìn thấy và giới hạn/dữ kiện còn thiếu.
- Nếu QC poor chỉ mô tả thô; QC fair chỉ gợi ý yếu/trung bình.

Trả về DUY NHẤT JSON hợp lệ theo schema:
{
  "mode":"normal|general",
  "top":{
    "quality":"good|fair|poor",
    "visualValidity":{"tongueVisible":true,"wholeTongueVisible":true,"rootVisible":true,"framing":"good|fair|poor","occlusion":"none|partial|major","colorReliability":"good|fair|poor"},
    "tongueColor":"...","shape":"...","coatingColor":"...","coatingThickness":"...","coatingTexture":"...","moisture":"...","fissures":"...","toothmarks":"...","pricklesSpots":"...","stasisMarks":"...","otherVisibleFeatures":["..."],
    "theoryAssessment":{"generalSignals":[{"label":"...","evidence":"...","rule":"...","confidence":0.0}],"stomachPatternSignals":[{"label":"Hàn tà khách Vị|Ẩm thực thương Vị|Can khí phạm Vị|Ứ huyết đình trệ|Thấp nhiệt trung trở|Vị âm khuy hư|Tỳ Vị hư hàn","evidence":"...","missingForConclusion":"...","confidence":0.0}],"cannotConclude":["..."]},
    "confidence":0.0,"summary":"...","limitations":["..."]
  },
  "bottom":${mode==='general'?'{"quality":"good|fair|poor","visualValidity":{"undersideVisible":true,"vesselsVisible":true,"framing":"good|fair|poor","occlusion":"none|partial|major","colorReliability":"good|fair|poor"},"undersideColor":"...","vessels":{"visible":true,"color":"...","prominence":"...","dilation":"...","tortuosity":"...","stasisSigns":"...","measurement":"định tính/không đủ chuẩn kích thước"},"otherVisibleFeatures":["..."],"confidence":0.0,"summary":"...","limitations":["..."]}':'null'},
  "combined":{"confidence":0.0,"summary":"...","generalSignals":[{"label":"...","evidence":"...","rule":"...","confidence":0.0}],"stomachPatternSignals":[{"label":"...","evidence":"...","missingForConclusion":"...","confidence":0.0}],"cannotConclude":["..."]}
}`;
    const parts=[{text:prompt},{text:'ẢNH 1 - MẶT TRÊN LƯỠI:'},{inline_data:{mime_type:topMimeType,data:topBase64}}];
    if(mode==='general') parts.push({text:'ẢNH 2 - MẶT DƯỚI LƯỠI:'},{inline_data:{mime_type:bottomMimeType,data:bottomBase64}});
    const provider={};
    const text=await geminiGenerate(key,[{role:'user',parts}],{responseMimeType:'application/json',temperature:0.05},req.aiSignal,provider);
    let assessment=normalizeAssessment(parseJsonText(text),{mode,topQc,bottomQc});
    try{assessment=applyAcademicFusion(assessment,body);}catch(err){throw Object.assign(new Error('ACADEMIC_FUSION_FAILED'),{status:503});}
    let collection={ok:false,stored:false,duplicate:false};
    try{
      const saved=await storeTrainingCase({mode,topImage,topMimeType,topQc,bottomImage,bottomMimeType,bottomQc,assessment,signal:req.aiSignal,providerModel:provider.model});
      collection={ok:true,stored:Boolean(saved?.stored),duplicate:Boolean(saved?.duplicate),caseId:saved?.id||null};
    }catch(err){console.error('case_store_error',err?.message||err);collection={ok:false,error:'CASE_STORE_FAILED'};}
    if(res.headersSent||res.destroyed)return;
    return res.json({ok:true,assessment,analysis:assessment,model:provider.model,provider,knowledgeVersion:KNOWLEDGE_VERSION,collection,access:accessQuota});
  }catch(err){if(res.headersSent||res.destroyed)return;console.error('analyze_error',err?.message||err);const status=err?.status===400||err?.status===413?err.status:err?.status===429?429:502;return res.status(status).json({error:'ANALYZE_FAILED',message:err?.message||'Unknown error'});}
});

app.post('/api/chat',aiRateLimit,async(req,res)=>{
  try{
    const key=apiKey();if(!key) return res.status(428).json({error:'AI_PROVIDER_NOT_CONFIGURED'});
    const {assessment,analysis,message}=req.body||{};if(!message||typeof message!=='string') return res.status(400).json({error:'MESSAGE_REQUIRED'});
    const context=assessment||analysis;const contextText=context?JSON.stringify(context):'Chưa có kết quả phân tích hình lưỡi.';
    const hasAssessment=Boolean(context);
    const retrievedKnowledge=hasAssessment?knowledgeForQuery(`${contextText}\n${message}`,{limit:18}):TONGUE_KNOWLEDGE;
    const prompt=`Bạn là chatbot tư vấn nhanh của A.I Thiệt Chẩn. Chỉ dùng kết quả quan sát hiện tại và hệ tri thức được cung cấp. Không tự thêm triệu chứng, mạch chẩn, chẩn đoán bệnh hay kê đơn. Nếu là ca tổng quát, phân biệt rõ dữ liệu từ mặt trên và mặt dưới lưỡi. Nếu người dùng hỏi về một thể YHCT, nêu dấu nào nhìn thấy và dấu nào còn thiếu trong tứ chẩn.

HỆ TRI THỨC ${KNOWLEDGE_VERSION}:
${retrievedKnowledge}

Bối cảnh phân tích: ${contextText}
Câu hỏi người dùng: ${message}
Trả lời ngắn gọn bằng tiếng Việt theo hướng học tập/tham khảo. Nếu đã có kết quả thiệt chẩn, cuối câu trả lời thêm mục “Nguồn đối chiếu” và chỉ liệt kê đúng các tài liệu/trang thực sự đã dùng trong lập luận. Nếu chưa có kết quả thiệt chẩn, không hiển thị mục nguồn.`;
    const provider={};
    const reply=await geminiGenerate(key,[{role:'user',parts:[{text:prompt}]}],{temperature:0.15},req.aiSignal,provider);
    if(res.headersSent||res.destroyed)return;
    return res.json({ok:true,reply,model:provider.model,provider,knowledgeVersion:KNOWLEDGE_VERSION});
  }catch(err){if(res.headersSent||res.destroyed)return;console.error('chat_error',err?.message||err);return res.status(err?.status===429?429:502).json({error:'CHAT_FAILED',message:err?.message||'Unknown error'});}
});

app.post('/api/report',aiRateLimit,async(req,res)=>{
  try{
    const key=apiKey();if(!key) return res.status(428).json({error:'AI_PROVIDER_NOT_CONFIGURED'});
    const {mode='normal',assessment,analysis,topQc,bottomQc,qc}=req.body||{};const data=assessment||analysis;if(!data) return res.status(400).json({error:'ANALYSIS_REQUIRED'});
    const prompt=`Tạo báo cáo tổng kết ca ngắn gọn bằng tiếng Việt từ dữ liệu dưới đây. Với ca bình thường: trình bày mặt trên lưỡi và nhận định tổng hợp. Với ca tổng quát: bắt buộc tách (1) chất lượng ảnh mặt trên; (2) quan sát mặt trên; (3) chất lượng ảnh mặt dưới; (4) quan sát mạch máu/tĩnh mạch dưới lưỡi; (5) nhận định kết hợp; (6) giới hạn. Không thêm bệnh danh, triệu chứng, mạch chẩn, điều trị hay phương thuốc không có trong đầu vào. Không biến tín hiệu thiệt tượng thành chẩn đoán xác định. Không hiển thị tên tài liệu, nguồn tham khảo, mã citation hoặc số trang.
Mode: ${mode}
QC mặt trên: ${JSON.stringify(topQc||qc||{})}
QC mặt dưới: ${JSON.stringify(bottomQc||null)}
Phân tích: ${JSON.stringify(data)}
Knowledge: ${KNOWLEDGE_VERSION}`;
    const provider={};
    const report=await geminiGenerate(key,[{role:'user',parts:[{text:prompt}]}],{temperature:0.05},req.aiSignal,provider);
    if(res.headersSent||res.destroyed)return;
    return res.json({ok:true,report,model:provider.model,provider,knowledgeVersion:KNOWLEDGE_VERSION});
  }catch(err){if(res.headersSent||res.destroyed)return;console.error('report_error',err?.message||err);return res.status(err?.status===429?429:502).json({error:'REPORT_FAILED',message:err?.message||'Unknown error'});}
});

app.use(express.static(path.join(__dirname,'public'),{maxAge:0,etag:true,setHeaders:(res,filePath)=>{if(/\.(html|js|css|webmanifest|svg)$/i.test(filePath)) res.setHeader('Cache-Control','no-cache');}}));
app.use((req,res)=>{res.setHeader('Cache-Control','no-cache');res.sendFile(path.join(__dirname,'public','index.html'));});

await ensureCaseStoreSecret();
app.listen(PORT,'0.0.0.0',()=>console.log(`A.I Thiệt Chẩn web v${VERSION} listening on ${PORT} · sharedGemini=${Boolean(apiKey())} · autoTrainingStore=${caseStoreReady} · dualView=true · academic350=${ACADEMIC_HEALTH.enabled}`));