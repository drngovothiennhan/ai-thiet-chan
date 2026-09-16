(()=>{
  'use strict';

  const nativeFetch=window.fetch.bind(window);
  const VERSION='preanalysis-image-enhancement-v3-front-camera';
  const SUPABASE_URL='https://gzmpnsrwqjpsbklyflqr.supabase.co';
  const SUPABASE_KEY='sb_publishable_Y4hMhXROZ-aVgWoaQ5fFKQ_ZAcXuIzG';
  const CONFIG_TTL_MS=30000;
  const MAX_OUTPUT_SIDE=1800;
  const MAX_OUTPUT_PIXELS=3_200_000;
  const MAX_UPSCALE=2.2;
  const STANDARD_MAX_UPSCALE=2.0;
  const BRIGHTNESS_TRIGGER=98;
  const BRIGHTNESS_TARGET=118;
  const MAX_LUMA_GAIN=1.28;
  const MIN_GAMMA=0.78;
  const MAX_COLOR_DRIFT=0.022;
  const MAX_GLARE_INCREASE=0.06;
  const MAX_CONTRAST_GAIN=1.08;
  const MAX_SHARPEN_DELTA=8;
  let configCache={enabled:true,version:VERSION,at:0};

  function clamp(v,min,max){return Math.max(min,Math.min(max,Number(v)||0));}
  function isAnalyzeRequest(url,method){
    try{const u=new URL(url,location.href);return method==='POST'&&u.origin===location.origin&&u.pathname==='/api/analyze';}
    catch{return false;}
  }
  async function enhancementConfig(){
    if(Date.now()-configCache.at<CONFIG_TTL_MS)return configCache;
    try{
      const r=await nativeFetch(`${SUPABASE_URL}/rest/v1/rpc/ai_thiet_chan_image_enhancement_config_v1`,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'authorization':`Bearer ${SUPABASE_KEY}`},body:'{}',cache:'no-store'});
      const d=await r.json();
      if(r.ok&&d&&typeof d.enabled==='boolean')configCache={enabled:d.enabled,version:String(d.version||VERSION),at:Date.now()};
    }catch(err){console.warn('image_enhancement_config_fallback',String(err?.message||err));configCache.at=Date.now();}
    return configCache;
  }
  function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
  function canvas(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;}
  function drawHighQuality(source,target){
    const ctx=target.getContext('2d',{alpha:false,willReadFrequently:true});
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(source,0,0,target.width,target.height);return target;
  }
  function resizeMultipass(source,targetW,targetH){
    const sw=source.width||source.naturalWidth,sh=source.height||source.naturalHeight;
    const scale=Math.max(targetW/sw,targetH/sh);
    if(scale<=1.45)return drawHighQuality(source,canvas(targetW,targetH));
    const midScale=Math.sqrt(scale),midW=Math.round(sw*midScale),midH=Math.round(sh*midScale);
    const mid=drawHighQuality(source,canvas(midW,midH));return drawHighQuality(mid,canvas(targetW,targetH));
  }
  function sampleMetrics(source){
    const sw=source.width||source.naturalWidth,sh=source.height||source.naturalHeight,max=240,scale=Math.min(1,max/Math.max(sw,sh));
    const c=canvas(Math.round(sw*scale),Math.round(sh*scale));drawHighQuality(source,c);
    const d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data;
    const hist=new Uint32Array(256);let sumY=0,dark=0,glare=0,cr=0,cg=0,cb=0,n=0;
    for(let i=0;i<d.length;i+=4){
      const r=d[i],g=d[i+1],b=d[i+2],y=clamp(Math.round(.2126*r+.7152*g+.0722*b),0,255),rgb=r+g+b;
      hist[y]++;sumY+=y;if(y<35)dark++;if(y>245)glare++;
      if(rgb>8){cr+=r/rgb;cg+=g/rgb;cb+=b/rgb;}else{cr+=1/3;cg+=1/3;cb+=1/3;}n++;
    }
    const percentile=p=>{const goal=n*p;let acc=0;for(let i=0;i<256;i++){acc+=hist[i];if(acc>=goal)return i;}return 255;};
    const p10=percentile(.1),p90=percentile(.9);
    return {brightness:n?sumY/n:0,median:percentile(.5),p10,p90,contrastSpread:p90-p10,dark:n?dark/n:0,glare:n?glare/n:0,chroma:n?[cr/n,cg/n,cb/n]:[1/3,1/3,1/3]};
  }
  function colorDrift(a,b){return ((Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2]))/3);}
  function gammaForMedian(median){if(median>=BRIGHTNESS_TRIGGER)return 1;const x=clamp(median/255,.05,.98),target=BRIGHTNESS_TARGET/255;return clamp(Math.log(target)/Math.log(x),MIN_GAMMA,1);}
  function applyLuminanceGamma(source,gamma){
    if(gamma>=.999)return source;
    const ctx=source.getContext('2d',{willReadFrequently:true}),img=ctx.getImageData(0,0,source.width,source.height),d=img.data;
    for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2],y=.2126*r+.7152*g+.0722*b;if(y<=1)continue;const mapped=255*Math.pow(y/255,gamma),ratio=clamp(mapped/y,1,MAX_LUMA_GAIN);d[i]=Math.min(255,Math.round(r*ratio));d[i+1]=Math.min(255,Math.round(g*ratio));d[i+2]=Math.min(255,Math.round(b*ratio));}
    ctx.putImageData(img,0,0);return source;
  }
  function applyLuminanceContrast(source,gain=1){
    if(gain<=1.001)return source;
    const ctx=source.getContext('2d',{willReadFrequently:true}),img=ctx.getImageData(0,0,source.width,source.height),d=img.data;
    for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2],y=.2126*r+.7152*g+.0722*b,mapped=clamp(128+(y-128)*gain,0,255),delta=mapped-y;d[i]=clamp(Math.round(r+delta),0,255);d[i+1]=clamp(Math.round(g+delta),0,255);d[i+2]=clamp(Math.round(b+delta),0,255);}
    ctx.putImageData(img,0,0);return source;
  }
  function applyLuminanceSharpen(source,amount=.16){
    if(amount<=.001||source.width<3||source.height<3)return source;
    const ctx=source.getContext('2d',{willReadFrequently:true}),img=ctx.getImageData(0,0,source.width,source.height),src=new Uint8ClampedArray(img.data),d=img.data,w=source.width,h=source.height;
    const yAt=i=>.2126*src[i]+.7152*src[i+1]+.0722*src[i+2];
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=(y*w+x)*4,up=i-w*4,down=i+w*4,left=i-4,right=i+4;
      const center=yAt(i),avg=(yAt(up)+yAt(down)+yAt(left)+yAt(right))/4,delta=clamp((center-avg)*amount,-MAX_SHARPEN_DELTA,MAX_SHARPEN_DELTA);
      d[i]=clamp(Math.round(src[i]+delta),0,255);d[i+1]=clamp(Math.round(src[i+1]+delta),0,255);d[i+2]=clamp(Math.round(src[i+2]+delta),0,255);
    }
    ctx.putImageData(img,0,0);return source;
  }
  function outputSize(w,h,frontCamera=false){
    const maxSide=Math.max(w,h),maxUpscale=frontCamera?MAX_UPSCALE:STANDARD_MAX_UPSCALE,targetSide=frontCamera?MAX_OUTPUT_SIDE:1600;let scale=1;
    if(maxSide<800)scale=Math.min(maxUpscale,targetSide/maxSide);else if(maxSide<1280)scale=Math.min(frontCamera?1.65:1.5,targetSide/maxSide);else if(maxSide<targetSide)scale=targetSide/maxSide;
    scale=Math.max(1,scale);if(w*h*scale*scale>MAX_OUTPUT_PIXELS)scale=Math.sqrt(MAX_OUTPUT_PIXELS/(w*h));scale=Math.max(1,Math.min(maxUpscale,scale));
    return {width:Math.round(w*scale),height:Math.round(h*scale),scale};
  }
  function toJpeg(canvasEl,quality=.93){return canvasEl.toDataURL('image/jpeg',quality);}

  async function enhanceDataUrl(dataUrl,qc={}){
    const started=performance.now();const img=await loadImage(dataUrl),w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;
    const frontCamera=qc?.capture?.frontCamera===true||qc?.capture?.facingMode==='user';
    const original=canvas(w,h);drawHighQuality(img,original);const before=sampleMetrics(original);
    const shouldBrighten=before.brightness<BRIGHTNESS_TRIGGER&&before.glare<.12&&qc?.checks?.clipping!==false;
    const gamma=shouldBrighten?gammaForMedian(before.median):1;
    const contrastGain=(frontCamera&&before.contrastSpread<78)?MAX_CONTRAST_GAIN:(!frontCamera&&before.contrastSpread<62?1.04:1);
    const corrected=canvas(w,h);drawHighQuality(original,corrected);applyLuminanceGamma(corrected,gamma);applyLuminanceContrast(corrected,contrastGain);
    const target=outputSize(w,h,frontCamera);let enhanced=resizeMultipass(corrected,target.width,target.height);
    const blurMetric=Number(qc?.laplacianVariance)||0,focusFailed=qc?.checks?.focus===false;
    const recoverableBlur=focusFailed&&blurMetric>=12;
    const sharpenAmount=recoverableBlur?(frontCamera?.20:.12):0;
    if(sharpenAmount)applyLuminanceSharpen(enhanced,sharpenAmount);
    let after=sampleMetrics(enhanced);
    let drift=colorDrift(before.chroma,after.chroma),guard='pass',brightnessApplied=gamma<.999,contrastApplied=contrastGain>1.001,sharpenApplied=sharpenAmount>0,rollback=false,rollbackReason=[];
    const glareDelta=after.glare-before.glare;
    if(drift>MAX_COLOR_DRIFT)rollbackReason.push('color-drift');
    if(glareDelta>MAX_GLARE_INCREASE)rollbackReason.push('glare');
    if(after.brightness>205)rollbackReason.push('brightness');
    if(after.contrastSpread>Math.max(150,before.contrastSpread+55))rollbackReason.push('contrast');
    if(rollbackReason.length){
      enhanced=resizeMultipass(original,target.width,target.height);after=sampleMetrics(enhanced);drift=colorDrift(before.chroma,after.chroma);guard='resample-only';brightnessApplied=false;contrastApplied=false;sharpenApplied=false;rollback=true;
    }
    return {dataUrl:toJpeg(enhanced),meta:{version:VERSION,enabled:true,nonGenerative:true,profile:frontCamera?'front-camera-recovery':'standard',frontCamera,resampler:'canvas-high-quality-multipass',brightness:'hue-preserving-luminance-gamma',contrast:'bounded-luminance-contrast',sharpen:'bounded-luminance-unsharp',source:{width:w,height:h},output:{width:enhanced.width,height:enhanced.height,scale:Number(target.scale.toFixed(3))},brightnessApplied,contrastApplied,contrastGain:Number(contrastGain.toFixed(3)),sharpenApplied,sharpenAmount:Number(sharpenAmount.toFixed(3)),recoverableBlur,gamma:Number(gamma.toFixed(3)),guard,rollback,rollbackReason,before:{brightness:Number(before.brightness.toFixed(1)),median:before.median,contrastSpread:before.contrastSpread,darkPct:Number((before.dark*100).toFixed(1)),glarePct:Number((before.glare*100).toFixed(1))},after:{brightness:Number(after.brightness.toFixed(1)),median:after.median,contrastSpread:after.contrastSpread,darkPct:Number((after.dark*100).toFixed(1)),glarePct:Number((after.glare*100).toFixed(1))},colorDrift:Number(drift.toFixed(4)),glareDeltaPct:Number(((after.glare-before.glare)*100).toFixed(2)),capture:qc?.capture||null,limits:{maxOutputSide:MAX_OUTPUT_SIDE,maxUpscale:frontCamera?MAX_UPSCALE:STANDARD_MAX_UPSCALE,maxColorDrift:MAX_COLOR_DRIFT,maxGlareIncrease:MAX_GLARE_INCREASE,maxContrastGain:MAX_CONTRAST_GAIN,maxSharpenDelta:MAX_SHARPEN_DELTA,minGamma:MIN_GAMMA},elapsedMs:Math.round(performance.now()-started)}};
  }

  async function rewriteAnalyzeRequest(input,init){
    const request=input instanceof Request?input:new Request(input,init);
    if(!isAnalyzeRequest(request.url,request.method))return request;
    const config=await enhancementConfig();
    if(!config.enabled)return request;
    let body;try{body=await request.clone().json();}catch{return request;}
    if(!body||typeof body!=='object'||typeof body.topImage!=='string')return request;
    const originalTop=body.topImage,originalBottom=typeof body.bottomImage==='string'?body.bottomImage:null;
    try{
      const top=await enhanceDataUrl(originalTop,body.topQc||body.qc||{});
      body.topOriginalImage=originalTop;body.topImage=top.dataUrl;body.topEnhancement=top.meta;
      body.topQc={...(body.topQc||body.qc||{}),enhancement:top.meta};
      if(body.mode==='general'&&originalBottom){
        const bottom=await enhanceDataUrl(originalBottom,body.bottomQc||{});
        body.bottomOriginalImage=originalBottom;body.bottomImage=bottom.dataUrl;body.bottomEnhancement=bottom.meta;
        body.bottomQc={...(body.bottomQc||{}),enhancement:bottom.meta};
      }
      body.imageEnhancement={enabled:true,version:VERSION,configuredVersion:config.version,nonGenerative:true,colorIntegrityGuard:true,frontCameraAware:true};
    }catch(err){console.warn('image_enhancement_bypass',String(err?.message||err));return request;}
    const headers=new Headers(request.headers);headers.set('content-type','application/json');headers.delete('content-length');
    return new Request(request,{headers,body:JSON.stringify(body)});
  }

  window.AITCImageEnhancement=Object.freeze({version:VERSION,enhanceDataUrl,config:enhancementConfig});
  window.fetch=async(input,init)=>{
    const url=input instanceof Request?input.url:String(input||''),method=(input instanceof Request?input.method:init?.method||'GET').toUpperCase();
    if(!isAnalyzeRequest(url,method))return nativeFetch(input,init);
    const rewritten=await rewriteAnalyzeRequest(input,init);return nativeFetch(rewritten);
  };
})();