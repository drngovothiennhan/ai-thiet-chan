import './model-manifest.js';
import './shadow-pixel-mlp.js';

const VERSION='shadow-worker-v1';

self.onmessage=async event=>{
  const {id,dataUrl,role='top'}=event.data||{};
  if(!id)return;
  try{
    const manifest=self.AITCLocalVisionModelManifest;
    if(manifest?.status!=='candidate-shadow'||manifest?.activation!=='shadow-only'){
      self.postMessage({id,ok:false,error:'SHADOW_MODEL_DISABLED',workerVersion:VERSION});
      return;
    }
    const result=await self.AITCLocalVisionShadow.analyzeDataUrl(dataUrl,role);
    self.postMessage({id,ok:true,result,workerVersion:VERSION});
  }catch(error){
    self.postMessage({id,ok:false,error:String(error?.message||error||'SHADOW_MODEL_FAILED'),workerVersion:VERSION});
  }
};
