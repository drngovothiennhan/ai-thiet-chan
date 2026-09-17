(function(scope){
'use strict';
if(scope.AITCLocalVisionModelRuntime)return;
const VERSION='local-vision-model-runtime-v1';
const MANIFEST_SCHEMA='aitc-local-vision-model-manifest-v1';

function hex(buffer){return [...new Uint8Array(buffer)].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function sha256(buffer){return hex(await crypto.subtle.digest('SHA-256',buffer));}
function manifest(){
  const m=scope.AITCLocalVisionModelManifest;
  if(!m||m.schemaVersion!==MANIFEST_SCHEMA)throw new Error('LOCAL_VISION_MODEL_MANIFEST_INVALID');
  return m;
}
function readyManifest(){
  const m=manifest();
  if(m.status!=='ready'||m.activation==='off')throw new Error('LOCAL_VISION_MODEL_NOT_READY');
  if(!Array.isArray(m.artifacts)||!m.artifacts.length)throw new Error('LOCAL_VISION_MODEL_ARTIFACTS_MISSING');
  return m;
}
function artifactFor(taskId){
  const m=readyManifest();
  const task=m.tasks.find(x=>x.id===taskId);
  if(!task?.artifactId)throw new Error('LOCAL_VISION_TASK_NOT_CONFIGURED');
  const artifact=m.artifacts.find(x=>x.id===task.artifactId);
  if(!artifact?.url||!/^[a-f0-9]{64}$/i.test(String(artifact.sha256||'')))throw new Error('LOCAL_VISION_ARTIFACT_METADATA_INVALID');
  return {m,task,artifact};
}
async function loadOrt(){
  if(scope.ort?.InferenceSession&&scope.ort?.Tensor)return scope.ort;
  throw new Error('ONNX_RUNTIME_NOT_LOADED');
}
const sessions=new Map();
async function sessionFor(taskId){
  if(sessions.has(taskId))return sessions.get(taskId);
  const {m,artifact}=artifactFor(taskId);
  const response=await fetch(artifact.url,{cache:'force-cache',credentials:'same-origin'});
  if(!response.ok)throw new Error('LOCAL_VISION_MODEL_FETCH_FAILED');
  const bytes=await response.arrayBuffer();
  const digest=await sha256(bytes);
  if(digest.toLowerCase()!==String(artifact.sha256).toLowerCase())throw new Error('LOCAL_VISION_MODEL_DIGEST_MISMATCH');
  const ort=await loadOrt();
  const providers=[];
  const wantsWebGpu=m.runtime?.optionalProvider==='webgpu'&&Boolean(navigator.gpu)&&artifact.webgpuParityApproved===true;
  if(wantsWebGpu)providers.push('webgpu');
  providers.push('wasm');
  const session=await ort.InferenceSession.create(bytes,{executionProviders:providers});
  const entry=Object.freeze({session,artifact,providers:Object.freeze(providers)});
  sessions.set(taskId,entry);
  return entry;
}
async function run(taskId,feeds){
  const {m,task}=artifactFor(taskId);
  if(m.activation!=='shadow-only'&&m.activation!=='active')throw new Error('LOCAL_VISION_MODEL_ACTIVATION_INVALID');
  if(!feeds||typeof feeds!=='object')throw new Error('LOCAL_VISION_MODEL_INPUT_REQUIRED');
  const entry=await sessionFor(taskId);
  const outputs=await entry.session.run(feeds);
  return Object.freeze({
    runtimeVersion:VERSION,
    pipelineVersion:m.pipelineVersion,
    taskId:task.id,
    activation:m.activation,
    artifactId:entry.artifact.id,
    modelSha256:entry.artifact.sha256,
    providers:entry.providers,
    outputs
  });
}
function snapshot(){
  let m=null;try{m=manifest();}catch{}
  return Object.freeze({
    version:VERSION,
    manifestSchema:MANIFEST_SCHEMA,
    status:m?.status||'missing',
    activation:m?.activation||'off',
    loadedTasks:Object.freeze([...sessions.keys()]),
    providerVision:false
  });
}
scope.AITCLocalVisionModelRuntime=Object.freeze({version:VERSION,run,snapshot});
})(globalThis);
