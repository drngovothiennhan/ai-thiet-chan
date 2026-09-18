import './model-manifest.js';
import './shadow-pixel-mlp.js';
import {analyzeShadowFeatureCandidates,SHADOW_FEATURE_VERSION} from './shadow-feature-extractor.js';

const VERSION='shadow-worker-v2';

self.onmessage=async event=>{
  const {id,dataUrl,topDataUrl,bottomDataUrl}=event.data||{};
  if(!id)return;
  try{
    const manifest=self.AITCLocalVisionModelManifest;
    if(manifest?.status!=='candidate-shadow'||manifest?.activation!=='shadow-only'){
      self.postMessage({id,ok:false,error:'SHADOW_MODEL_DISABLED',workerVersion:VERSION});
      return;
    }
    const top=String(topDataUrl||dataUrl||'');
    if(!top){self.postMessage({id,ok:false,error:'SHADOW_TOP_IMAGE_REQUIRED',workerVersion:VERSION});return;}
    const started=performance.now();
    let roi=null,roiError='';
    try{roi=await self.AITCLocalVisionShadow.analyzeDataUrl(top,'top');}catch(error){roiError=String(error?.message||error||'SHADOW_ROI_FAILED');}
    const [topFeatures,bottomFeatures]=await Promise.all([
      analyzeShadowFeatureCandidates(top,'top'),
      bottomDataUrl?analyzeShadowFeatureCandidates(bottomDataUrl,'bottom'):Promise.resolve(null)
    ]);
    const result={
      status:'complete',
      runtimeVersion:VERSION,
      featureVersion:SHADOW_FEATURE_VERSION,
      role:'dual-view-shadow',
      modelId:String(roi?.modelId||'aitc-tongue-roi-mlp-bootstrap-v1'),
      modelSha256:String(roi?.modelSha256||''),
      coverage:Number.isFinite(Number(roi?.coverage))?Number(roi.coverage):null,
      presence:typeof roi?.presence==='boolean'?roi.presence:null,
      roiStatus:String(roi?.status||'unavailable'),
      roiError,
      topFeatures,
      bottomFeatures,
      clinicalGold:false,
      productionEligible:false,
      authority:false,
      latencyMs:Math.round(performance.now()-started)
    };
    self.postMessage({id,ok:true,result,workerVersion:VERSION});
  }catch(error){
    self.postMessage({id,ok:false,error:String(error?.message||error||'SHADOW_MODEL_FAILED'),workerVersion:VERSION});
  }
};
