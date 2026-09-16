(()=>{
  'use strict';

  const nativeFetch=window.fetch.bind(window);
  const VERSION='preanalysis-image-enhancement-v1';
  const MAX_OUTPUT_SIDE=1600;
  const MAX_OUTPUT_PIXELS=2_800_000;
  const MAX_UPSCALE=2.0;
  const BRIGHTNESS_TRIGGER=98;
  const BRIGHTNESS_TARGET=118;
  const MAX_LUMA_GAIN=1.28;
  const MIN_GAMMA=0.78;
  const MAX_COLOR_DRIFT=0.022;
  const MAX_GLARE_INCREASE=0.06;

  function clamp(v,min,max){return Math.max(min,Math.min(max,Number(v)||0));}
  function isAnalyzeRequest(url,method){
    try{const u=new URL(url,location.href);return method==='POST'&&u.origin===location.origin&&u.pathname==='/api/analyze';}
    catch{return false;}
  }
  function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
  function canvas(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;}
  function drawHighQuality(source,target){
    const ctx=target.getContext('2d',{alpha:false,willReadFrequently:true});
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(source,0,0,target.width,target.height);
    return target;
  }
  function resizeMultipass(source,targetW,targetH){
    const sw=source.width||source.naturalWidth,sh=source.height||source.naturalHeight;
    const scale=Math.max(targetW/sw,targetH/sh);
    if(scale<=1.45)return drawHighQuality(source,canvas(targetW,targetH));
    const midScale=Math.sqrt(scale),midW=Math.round(sw*midScale),midH=Math.round(sh*midScale);
    const mid=drawHighQuality(source,canvas(midW,midH));
    return drawHighQuality(mid,canvas(targetW,targetH));
  }
  function sampleMetrics(source){
    const sw=source.width||source.naturalWidth,sh=source.height||source.naturalHeight,max=240,scale=Math.min(1,max/Math.max(sw,sh));
    const c=canvas(Math.round(sw*scale),Math.round(sh*scale));drawHighQuality(source,c);
    const d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data;
    const hist=new Uint32Array(256);let sumY=0,dark=0,glare=0,cr=0,cg=0,cb=0,n=0;
    for(let i=0;i<d.length;i+=4){
      const r=d[i],g=d[i+1],b=d[i+2],y=clamp(Math.round(.2126*r+.7152*g+.0722*b),0,255),rgb=r+g+b;
      hist[y]++;sumY+=y;if(y<35)dark++;if(y>245)glare++;
      if(rgb>8){cr+=r/rgb;cg+=g/rgb;cb+=b/rgb;}else{cr+=1/3;cg+=1/3;cb+=1/3;}
      n++;
    }
    const percentile=p=>{const goal=n*p;let acc=0;for(let i=0;i<256;i++){acc+=hist[i];if(acc>=goal)return i;}return 255;};
    return {brightness:n?sumY/n:0,median:percentile(.5),p10:percentile(.1),p90:percentile(.9),dark:n?dark/n:0,glare:n?glare/n:0,chroma:n?[cr/n,cg/n,cb/n]:[1/3,1/3,1/3]};
  }
  function colorDrift(a,b){return ((Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2]))/3);}
  function gammaForMedian(median){
    if(median>=BRIGHTNESS_TRIGGER)return 1;
    const x=clamp(median/255,.05,.98),target=BRIGHTNESS_TARGET/255;
    return clamp(Math.log(target)/Math.log(x),MIN_GAMMA,1);
  }
  function applyLuminanceGamma(source,gamma){
    if(gamma>=.999)return source;
    const ctx=source.getContext('2d',{willReadFrequently:true}),img=ctx.getImageData(0,0,source.width,source.height),d=img.data;
    for(let i=0;i<d.length;i+=4){
      const r=d[i],g=d[i+1],b=d[i+2],y=.2126*r+.7152*g+.0722*b;
      if(y<=1)continue;
      const mapped=255*Math.pow(y/255,gamma),ratio=clamp(mapped/y,1,MAX_LUMA_GAIN);
      d[i]=Math.min(255,Math.round(r*ratio));d[i+1]=Math.min(255,Math.round(g*ratio));d[i+2]=Math.min(255,Math.round(b*ratio));
    }
    ctx.putImageData(img,0,0);return source;
  }
  function outputSize(w,h){
    const maxSide=Math.max(w,h);let scale=1;
    if(maxSide<800)scale=Math.min(MAX_UPSCALE,1440/maxSide);
    else if(maxSide<1280)scale=Math.min(1.5,1600/maxSide);
    else if(maxSide<1600)scale=1600/maxSide;
    scale=Math.max(1,scale);
    if(w*h*scale*scale>MAX_OUTPUT_PIXELS)scale=Math.sqrt(MAX_OUTPUT_PIXELS/(w*h));
    scale=Math.max(1,Math.min(MAX_UPSCALE,scale));
    return {width:Math.round(w*scale),height:Math.round(h*scale),scale};
  }
  function toJpeg(canvasEl,quality=.92){return canvasEl.toDataURL('image/jpeg',quality);}

  async function enhanceDataUrl(dataUrl,qc={}){
    const started=performance.now();const img=await loadImage(dataUrl),w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;
    const original=canvas(w,h);drawHighQuality(img,original);const before=sampleMetrics(original);
    const shouldBrighten=before.brightness<BRIGHTNESS_TRIGGER&&before.glare<.12&&qc?.checks?.clipping!==false;
    const gamma=shouldBrighten?gammaForMedian(before.median):1;
    const corrected=canvas(w,h);drawHighQuality(original,corrected);applyLuminanceGamma(corrected,gamma);
    const target=outputSize(w,h);let enhanced=resizeMultipass(corrected,target.width,target.height);let after=sampleMetrics(enhanced);
    let drift=colorDrift(before.chroma,after.chroma),guard='pass',brightnessApplied=gamma<.999;

    if(drift>MAX_COLOR_DRIFT||after.glare-before.glare>MAX_GLARE_INCREASE||after.brightness>205){
      enhanced=resizeMultipass(original,target.width,target.height);after=sampleMetrics(enhanced);drift=colorDrift(before.chroma,after.chroma);guard='resample-only';brightnessApplied=false;
    }

    return {
      dataUrl:toJpeg(enhanced),
      meta:{
        version:VERSION,nonGenerative:true,resampler:'canvas-high-quality-multipass',brightness:'hue-preserving-luminance-gamma',
        source:{width:w,height:h},output:{width:enhanced.width,height:enhanced.height,scale:Number(target.scale.toFixed(3))},
        brightnessApplied,gamma:Number(gamma.toFixed(3)),guard,
        before:{brightness:Number(before.brightness.toFixed(1)),median:before.median,darkPct:Number((before.dark*100).toFixed(1)),glarePct:Number((before.glare*100).toFixed(1))},
        after:{brightness:Number(after.brightness.toFixed(1)),median:after.median,darkPct:Number((after.dark*100).toFixed(1)),glarePct:Number((after.glare*100).toFixed(1))},
        colorDrift:Number(drift.toFixed(4)),elapsedMs:Math.round(performance.now()-started)
      }
    };
  }

  async function rewriteAnalyzeRequest(input,init){
    const request=input instanceof Request?input:new Request(input,init);
    if(!isAnalyzeRequest(request.url,request.method))return request;
    let body;try{body=await request.clone().json();}catch{return request;}
    if(!body||typeof body!=='object'||typeof body.topImage!=='string')return request;
    const originalTop=body.topImage,originalBottom=typeof body.bottomImage==='string'?body.bottomImage:null;
    try{
      const top=await enhanceDataUrl(originalTop,body.topQc||body.qc||{});
      body.topOriginalImage=originalTop;body.topImage=top.dataUrl;body.topEnhancement=top.meta;
      if(body.mode==='general'&&originalBottom){
        const bottom=await enhanceDataUrl(originalBottom,body.bottomQc||{});
        body.bottomOriginalImage=originalBottom;body.bottomImage=bottom.dataUrl;body.bottomEnhancement=bottom.meta;
      }
      body.imageEnhancement={version:VERSION,nonGenerative:true,colorIntegrityGuard:true};
    }catch(err){
      console.warn('image_enhancement_bypass',String(err?.message||err));
      return request;
    }
    const headers=new Headers(request.headers);headers.set('content-type','application/json');headers.delete('content-length');
    return new Request(request,{headers,body:JSON.stringify(body)});
  }

  window.AITCImageEnhancement=Object.freeze({version:VERSION,enhanceDataUrl});
  window.fetch=async(input,init)=>{
    const url=input instanceof Request?input.url:String(input||''),method=(input instanceof Request?input.method:init?.method||'GET').toUpperCase();
    if(!isAnalyzeRequest(url,method))return nativeFetch(input,init);
    const rewritten=await rewriteAnalyzeRequest(input,init);return nativeFetch(rewritten);
  };
})();
