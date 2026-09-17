(function(scope){
'use strict';
if(scope.AITCLocalVisionShadow)return;

const VERSION='shadow-pixel-mlp-v1';
const MODEL_URL='/local-vision/models/aitc-tongue-roi-mlp-bootstrap-v1.json';
const EXPECTED_SHA256='43c64af91d4bf5b9cd6ad8a9d26b3c045817243966a7869743bbc72ff5e21174';
let modelPromise=null;

function hex(buffer){return [...new Uint8Array(buffer)].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function sha256(buffer){return hex(await crypto.subtle.digest('SHA-256',buffer));}
function sigmoid(x){return x>=0?1/(1+Math.exp(-x)):Math.exp(x)/(1+Math.exp(x));}
function relu(x){return x>0?x:0;}

function validateModel(model){
  if(model?.schemaVersion!=='aitc-pixel-mlp-v1'||model?.modelId!=='aitc-tongue-roi-mlp-bootstrap-v1')throw new Error('SHADOW_MODEL_SCHEMA_INVALID');
  if(model?.task!=='tongue-roi'||Number(model?.inputSize)!==160)throw new Error('SHADOW_MODEL_TASK_INVALID');
  if(!Array.isArray(model?.architecture)||model.architecture.join(',')!=='12,24,12,1')throw new Error('SHADOW_MODEL_ARCH_INVALID');
  const w=model?.weights||{};
  if(!Array.isArray(w['net.0.weight'])||w['net.0.weight'].length!==24)throw new Error('SHADOW_MODEL_WEIGHTS_INVALID');
  if(!Array.isArray(w['net.2.weight'])||w['net.2.weight'].length!==12)throw new Error('SHADOW_MODEL_WEIGHTS_INVALID');
  if(!Array.isArray(w['net.4.weight'])||w['net.4.weight'].length!==1)throw new Error('SHADOW_MODEL_WEIGHTS_INVALID');
  return model;
}

async function loadModel(){
  if(modelPromise)return modelPromise;
  modelPromise=(async()=>{
    const response=await fetch(MODEL_URL,{cache:'force-cache',credentials:'same-origin'});
    if(!response.ok)throw new Error('SHADOW_MODEL_FETCH_FAILED');
    const bytes=await response.arrayBuffer();
    const digest=await sha256(bytes);
    if(digest!==EXPECTED_SHA256)throw new Error('SHADOW_MODEL_DIGEST_MISMATCH');
    const model=validateModel(JSON.parse(new TextDecoder().decode(bytes)));
    return Object.freeze({model,digest});
  })();
  try{return await modelPromise;}catch(error){modelPromise=null;throw error;}
}

function inferFeatureVector(model,x){
  const w=model.weights;
  const h0=new Float64Array(24);
  for(let j=0;j<24;j++){
    let z=Number(w['net.0.bias'][j])||0;
    const row=w['net.0.weight'][j];
    for(let i=0;i<12;i++)z+=(Number(row[i])||0)*(Number(x[i])||0);
    h0[j]=relu(z);
  }
  const h1=new Float64Array(12);
  for(let j=0;j<12;j++){
    let z=Number(w['net.2.bias'][j])||0;
    const row=w['net.2.weight'][j];
    for(let i=0;i<24;i++)z+=(Number(row[i])||0)*h0[i];
    h1[j]=relu(z);
  }
  let z=Number(w['net.4.bias'][0])||0;
  for(let i=0;i<12;i++)z+=(Number(w['net.4.weight'][0][i])||0)*h1[i];
  return sigmoid(z);
}

function rgbToHsv(r,g,b){
  const rn=r/255,gn=g/255,bn=b/255,max=Math.max(rn,gn,bn),min=Math.min(rn,gn,bn),d=max-min;
  let h=0;
  if(d){
    if(max===rn)h=60*(((gn-bn)/d)%6);
    else if(max===gn)h=60*((bn-rn)/d+2);
    else h=60*((rn-gn)/d+4);
  }
  if(h<0)h+=360;
  const quantizedHue=Math.round(h/2)*2;
  return {h:quantizedHue,s:max?d/max:0,v:max};
}

function largestComponent(mask,w,h){
  const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);
  let best=null,bestSize=0;
  for(let seed=0;seed<mask.length;seed++){
    if(!mask[seed]||seen[seed])continue;
    let head=0,tail=0;queue[tail++]=seed;seen[seed]=1;
    const cells=[];
    while(head<tail){
      const p=queue[head++];cells.push(p);const x=p%w,y=(p/w)|0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;
        const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;
        const np=ny*w+nx;if(mask[np]&&!seen[np]){seen[np]=1;queue[tail++]=np;}
      }
    }
    if(cells.length>bestSize){bestSize=cells.length;best=cells;}
  }
  const out=new Uint8Array(mask.length);
  if(best)for(const p of best)out[p]=1;
  return {mask:out,area:bestSize};
}

async function analyzeDataUrl(dataUrl,role='top'){
  const started=performance.now();
  if(role!=='top')return Object.freeze({status:'not-applicable',runtimeVersion:VERSION,role});
  if(typeof createImageBitmap!=='function'||typeof OffscreenCanvas==='undefined')throw new Error('SHADOW_CANVAS_UNAVAILABLE');
  const manifest=scope.AITCLocalVisionModelManifest;
  if(manifest?.activation!=='shadow-only')throw new Error('SHADOW_MODEL_NOT_ENABLED');
  const artifact=manifest?.artifacts?.find?.(x=>x.id==='tongue-roi-mlp-bootstrap-v1');
  if(!artifact||artifact.productionEligible!==false||artifact.clinicalGold!==false)throw new Error('SHADOW_MODEL_POLICY_INVALID');

  const {model,digest}=await loadModel();
  const blob=await (await fetch(dataUrl)).blob();
  const bitmap=await createImageBitmap(blob);
  try{
    const size=Number(model.inputSize)||160;
    const canvas=new OffscreenCanvas(size,size),ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw new Error('SHADOW_CANVAS_CONTEXT_UNAVAILABLE');
    ctx.drawImage(bitmap,0,0,size,size);
    const pixels=ctx.getImageData(0,0,size,size).data;
    const rawMask=new Uint8Array(size*size);
    const threshold=Number(model.threshold)||.8;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const p=y*size+x,i=p*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2],hsv=rgbToHsv(r,g,b);
      const xn=(x/Math.max(1,size-1)-.5)*2,yn=(y/Math.max(1,size-1)-.5)*2;
      const features=[
        r/255,g/255,b/255,hsv.s,hsv.v,
        Math.sin(hsv.h*Math.PI/180),Math.cos(hsv.h*Math.PI/180),
        xn,yn,Math.sqrt(xn*xn+yn*yn)/Math.sqrt(2),
        (r-(g+b)/2)/255,(.299*r+.587*g+.114*b)/255
      ];
      if(inferFeatureVector(model,features)>=threshold)rawMask[p]=1;
    }
    const component=largestComponent(rawMask,size,size);
    const coverage=component.area/(size*size);
    const maskDigest=await sha256(component.mask);
    return Object.freeze({
      status:'complete',
      runtimeVersion:VERSION,
      modelId:model.modelId,
      modelSha256:digest,
      role,
      inputSize:size,
      threshold,
      area:component.area,
      coverage:Number(coverage.toFixed(6)),
      presence:coverage>=Number(model.postprocess?.minPresenceCoverage||.018),
      maskSha256:maskDigest,
      clinicalGold:false,
      productionEligible:false,
      latencyMs:Math.round(performance.now()-started)
    });
  }finally{try{bitmap.close?.();}catch{}}
}

function snapshot(){
  const manifest=scope.AITCLocalVisionModelManifest;
  return Object.freeze({
    version:VERSION,
    modelUrl:MODEL_URL,
    expectedSha256:EXPECTED_SHA256,
    activation:manifest?.activation||'off',
    clinicalGold:false,
    productionEligible:false,
    providerVision:false
  });
}

scope.AITCLocalVisionShadow=Object.freeze({version:VERSION,analyzeDataUrl,inferFeatureVector,loadModel,snapshot});
})(globalThis);
