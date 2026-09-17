import {matchAtlas,coarse} from './academic-signature.js';
import './academic-vision.js';

const VERSION='device-analysis-worker-v1';
const GROUND_TRUTH=Object.freeze({
  source:'KNOWLEDGE-5DOC',
  designation:'owner-designated-ground-truth-v1',
  indexedImageOccurrences:1027,
  vectorizedVisualSignatures:298
});

function compactMatch(m){
  return {
    id:String(m?.id||''),
    sourceId:String(m?.sourceId||m?.source||''),
    page:Number(m?.page)||null,
    section:String(m?.section||''),
    kind:String(m?.kind||m?.usage||''),
    similarity:Number(m?.similarity||0),
    hash:String(m?.hash||m?.cropSha256||m?.pageSha256Prefix||'')
  };
}
async function digestText(value){
  try{
    const bytes=new TextEncoder().encode(String(value||''));
    const out=await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(out)].map(v=>v.toString(16).padStart(2,'0')).join('');
  }catch{return '';}
}
async function analyze(dataUrl,role){
  if(typeof dataUrl!=='string'||dataUrl.length<100)throw new Error('DEVICE_IMAGE_REQUIRED');
  const started=performance.now();
  const signature=await self.AITCAcademicVision?.signatureFromDataUrl?.(dataUrl);
  const matches=signature?matchAtlas(signature).map(compactMatch):[];
  const coarseVisual=signature?coarse(signature):null;
  const imageDigest=await digestText(dataUrl);
  return {
    workerVersion:VERSION,
    role:role==='bottom'?'bottom':'top',
    signature:signature||null,
    coarseVisual,
    matches,
    imageDigest,
    groundTruth:GROUND_TRUTH,
    vectorCoverage:Number((GROUND_TRUTH.vectorizedVisualSignatures/GROUND_TRUTH.indexedImageOccurrences).toFixed(4)),
    elapsedMs:Math.round(performance.now()-started)
  };
}

self.onmessage=async(event)=>{
  const {id,dataUrl,role}=event.data||{};
  try{self.postMessage({id,ok:true,result:await analyze(dataUrl,role)});}
  catch(error){self.postMessage({id,ok:false,error:String(error?.message||error||'DEVICE_WORKER_FAILED')});}
};
