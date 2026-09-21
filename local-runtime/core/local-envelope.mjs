export const LOCAL_ANALYSIS_ENVELOPE_VERSION='aitc-local-analysis-envelope-v1';
const HASH_RE=/^[a-f0-9]{64}$/i;
function object(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function cleanHashes(raw){const out={};for(const [k,v] of Object.entries(object(raw))){if(HASH_RE.test(String(v)))out[String(k).slice(0,80)]=String(v).toLowerCase();}return out;}
export function buildLocalAnalysisEnvelope(input={}){
  const hashes=cleanHashes(input.imageHashes);
  if(!Object.keys(hashes).length)throw new Error('ENVELOPE_IMAGE_HASH_REQUIRED');
  const confidence=Number(input.confidence);
  if(!Number.isFinite(confidence)||confidence<0||confidence>1)throw new Error('ENVELOPE_CONFIDENCE_INVALID');
  const envelope={
    schemaVersion:LOCAL_ANALYSIS_ENVELOPE_VERSION,
    appVersion:String(input.appVersion||'').trim(),
    runtimeVersion:String(input.runtimeVersion||'').trim(),
    modelSetVersion:String(input.modelSetVersion||'').trim(),
    knowledgeVersion:String(input.knowledgeVersion||'').trim(),
    deviceProfile:object(input.deviceProfile),
    executionProfile:object(input.executionProfile),
    imageHashes:hashes,
    qc:object(input.qc),
    observations:object(input.observations),
    localRetrieval:object(input.localRetrieval),
    localReasoning:object(input.localReasoning),
    confidence,
    limitations:(Array.isArray(input.limitations)?input.limitations:[]).map(x=>String(x).slice(0,500)),
    provenance:object(input.provenance),
    degraded:input.degraded===true,
    offline:input.offline===true,
    timestamp:String(input.timestamp||new Date().toISOString())
  };
  for(const key of ['appVersion','runtimeVersion','modelSetVersion','knowledgeVersion'])if(!envelope[key])throw new Error(`ENVELOPE_${key.toUpperCase()}_REQUIRED`);
  if(Number.isNaN(Date.parse(envelope.timestamp)))throw new Error('ENVELOPE_TIMESTAMP_INVALID');
  return Object.freeze(envelope);
}
