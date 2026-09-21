export const LOCAL_VISION_ADAPTER_VERSION='aitc-native-vision-adapter-v1';

const HASH_RE=/^[a-f0-9]{64}$/i;
const UNIT_KEYS=['r','g','b','s','v','purple','white','yellow','dark','spot','coverage'];

function clamp01(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):null;}
function text(value,max=160){return String(value||'').trim().slice(0,max);}

function sanitizeSignature(raw){
  if(!raw||typeof raw!=='object')return null;
  const out={};
  for(const key of UNIT_KEYS){const n=clamp01(raw[key]);if(n===null)return null;out[key]=n;}
  const aspect=Number(raw.aspect);if(!Number.isFinite(aspect)||aspect<=0||aspect>5)return null;out.aspect=aspect;
  if(raw.segmentationMode)out.segmentationMode=text(raw.segmentationMode,80);
  return Object.freeze(out);
}

function sanitizeQc(raw={}){
  const grade=['good','fair','poor'].includes(raw.grade)?raw.grade:'poor';
  const out={grade};
  for(const key of ['blur','exposure','framing','tongueVisibility']){
    if(raw[key]===undefined)continue;
    const n=clamp01(raw[key]);if(n!==null)out[key]=n;
  }
  return Object.freeze(out);
}

function sanitizeObservationObject(raw={}){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return Object.freeze({});
  const allowed=['tongueColor','coatingColor','coatingThickness','coatingDistribution','moisture','medianSulcus','fissure','toothmarks','stasisMarks','undersideColor','vessels'];
  const out={};
  for(const key of allowed){
    const value=raw[key];
    if(value===undefined)continue;
    if(typeof value==='string')out[key]=text(value,240);
    else if(value&&typeof value==='object')out[key]=JSON.parse(JSON.stringify(value));
  }
  return Object.freeze(out);
}

export function adaptNativeVisionResult(payload={}){
  const artifact=payload.artifact&&typeof payload.artifact==='object'?payload.artifact:{};
  const imageHash=String(payload.imageHash||'').toLowerCase();
  const qc=sanitizeQc(payload.qc||{});
  const base={
    schemaVersion:'aitc-local-vision-adapter-result-v1',
    adapterVersion:LOCAL_VISION_ADAPTER_VERSION,
    taskId:text(payload.taskId,120),
    imageHash:HASH_RE.test(imageHash)?imageHash:'',
    qc,
    observations:Object.freeze({}),
    signature:null,
    accepted:false,
    limitations:[]
  };
  if(!base.imageHash)return Object.freeze({...base,limitations:Object.freeze(['image-hash-invalid'])});
  if(artifact.productionEligible!==true||artifact.validationStatus!=='validated'){
    return Object.freeze({...base,limitations:Object.freeze(['model-not-validation-approved','shadow-or-candidate-output-not-promoted'])});
  }
  const signature=sanitizeSignature(payload.signature);
  if(!signature)return Object.freeze({...base,limitations:Object.freeze(['signature-missing-or-invalid'])});
  const observations=sanitizeObservationObject(payload.observations);
  return Object.freeze({
    ...base,
    accepted:true,
    signature,
    observations,
    artifact:Object.freeze({
      id:text(artifact.id,160),
      version:text(artifact.version,120),
      sha256:HASH_RE.test(String(artifact.sha256||''))?String(artifact.sha256).toLowerCase():'',
      validationStatus:'validated',
      productionEligible:true
    }),
    limitations:Object.freeze(qc.grade==='poor'?['image-quality-poor-output-needs-review']:[])
  });
}
