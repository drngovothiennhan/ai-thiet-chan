(function(scope){
'use strict';
const SOURCE=Object.freeze({
  id:'KNOWLEDGE-5DOC',
  sourceCount:5,
  indexedPages:1157,
  indexedImageOccurrences:1027,
  pageVisualSignatures:298,
  imageVisualSignatures:298,
  knowledgeVersion:'thiet-chan-kb-2026-09-15.5doc',
  noSilentOmission:true,
  segmentationVersion:'adaptive-tongue-mask-v2',
  spatialObservationVersion:'tongue-spatial-observation-v2'
});

function q(v,n=4){return Number(Number(v||0).toFixed(n));}
function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,Number(v)||0));}
function median(values){
  if(!values.length)return 0;
  values.sort((a,b)=>a-b);
  const m=values.length>>1;
  return values.length%2?values[m]:(values[m-1]+values[m])/2;
}
function rgbToHsv(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0;
  if(d){if(max===r)h=60*((g-b)/d%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4);}
  if(h<0)h+=360;
  return {h,s:max?d/max:0,v:max};
}
function luma(r,g,b){return .299*r+.587*g+.114*b;}
function largestComponent(mask,w,h){
  const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);let best=[];
  for(let seed=0;seed<mask.length;seed++){
    if(!mask[seed]||seen[seed])continue;
    let head=0,tail=0;queue[tail++]=seed;seen[seed]=1;const cells=[];
    while(head<tail){
      const p=queue[head++];cells.push(p);const x=p%w,y=(p/w)|0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;
        if(nx<0||ny<0||nx>=w||ny>=h)continue;
        const np=ny*w+nx;if(mask[np]&&!seen[np]){seen[np]=1;queue[tail++]=np;}
      }
    }
    if(cells.length>best.length)best=cells;
  }
  const out=new Uint8Array(mask.length);for(const p of best)out[p]=1;
  return {mask:out,area:best.length};
}
function bounds(mask,w,h){
  let minX=w,minY=h,maxX=-1,maxY=-1;
  for(let p=0;p<mask.length;p++)if(mask[p]){
    const x=p%w,y=(p/w)|0;
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  }
  return maxX<0?null:{minX,minY,maxX,maxY,width:maxX-minX+1,height:maxY-minY+1};
}
function buildTongueMask(px,w,h,relaxed=false){
  const mask=new Uint8Array(w*h),left=relaxed?.12:.08,right=relaxed?.88:.92,top=relaxed?.08:.05,bottom=relaxed?.95:.97;
  for(let p=0;p<mask.length;p++){
    const x=p%w,y=(p/w)|0;if(x<w*left||x>w*right||y<h*top||y>h*bottom)continue;
    const i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b),redBias=r-(g+b)/2,tongueHue=hsv.h<=62||hsv.h>=296;
    if(!relaxed){if(r>55&&hsv.v>.20&&hsv.s>.08&&tongueHue&&redBias>3)mask[p]=1;continue;}
    const centerX=Math.abs(x-w*.5)<=w*.36,centerY=y>=h*.12&&y<=h*.94;
    if(centerX&&centerY&&r>50&&hsv.v>.18&&hsv.s>.045&&tongueHue&&redBias>1.5&&r>=g*1.01&&r>=b*.93)mask[p]=1;
  }
  return mask;
}
function buildSpatialMask(px,w,h,relaxed=false){
  const mask=new Uint8Array(w*h);
  const left=relaxed?.14:.18,right=relaxed?.86:.82,top=relaxed?.16:.20,bottom=relaxed?.78:.72;
  for(let p=0;p<mask.length;p++){
    const x=p%w,y=(p/w)|0;if(x<w*left||x>w*right||y<h*top||y>h*bottom)continue;
    const i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b),redBias=r-(g+b)/2,tongueHue=hsv.h<=62||hsv.h>=296;
    if(!relaxed){
      if(r>48&&hsv.v>.176&&hsv.s>.055&&tongueHue&&redBias>-1)mask[p]=1;
    }else if(r>45&&hsv.v>.157&&hsv.s>.031&&tongueHue&&redBias>-4)mask[p]=1;
  }
  return mask;
}
function rowMean(gray,w,y,x0,x1){
  const a=Math.max(0,Math.floor(x0)),b=Math.min(w-1,Math.floor(x1));
  if(b<a)return 0;let sum=0,n=0;for(let x=a;x<=b;x++){sum+=gray[y*w+x];n++;}
  return n?sum/n:0;
}
function spatialObservation(px,w,h){
  let comp=largestComponent(buildSpatialMask(px,w,h,false),w,h);
  if(comp.area<Math.max(90,w*h*.018)){
    const relaxed=largestComponent(buildSpatialMask(px,w,h,true),w,h);
    if(relaxed.area>comp.area)comp=relaxed;
  }
  const box=bounds(comp.mask,w,h);
  if(!box||comp.area<Math.max(90,w*h*.018))return null;
  const {minX,minY,width:bw,height:bh}=box;
  const rowCenters=[];
  for(let y=Math.max(0,Math.floor(minY+.25*bh));y<=Math.min(h-1,Math.ceil(minY+.95*bh));y++){
    let first=-1,last=-1,count=0;
    for(let x=minX;x<=box.maxX;x++){if(comp.mask[y*w+x]){if(first<0)first=x;last=x;count++;}}
    if(count>=5)rowCenters.push((first+last)/2);
  }
  const symmetryAxis=rowCenters.length?median(rowCenters):minX+bw/2;

  let nr=0,ng=0,nb=0,neutralN=0;
  for(let p=0;p<w*h;p++){
    if(comp.mask[p])continue;
    const x=p%w,y=(p/w)|0;
    if(x<w*.06||x>w*.94||y<h*.05||y>h*.95)continue;
    const i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b);
    if(hsv.s>.13||hsv.v<.24||hsv.v>.92)continue;
    nr+=r;ng+=g;nb+=b;neutralN++;
  }
  let gainR=1,gainG=1,gainB=1,normalizationApplied=false;
  if(neutralN>=64){
    const mr=nr/neutralN,mg=ng/neutralN,mb=nb/neutralN,target=(mr+mg+mb)/3;
    gainR=clamp(target/Math.max(1,mr),.8,1.2);
    gainG=clamp(target/Math.max(1,mg),.8,1.2);
    gainB=clamp(target/Math.max(1,mb),.8,1.2);
    normalizationApplied=true;
  }

  const gray=new Float32Array(w*h),sat=new Float32Array(w*h),val=new Float32Array(w*h),hue=new Float32Array(w*h);
  for(let p=0;p<w*h;p++){
    const i=p*4,r=clamp(px[i]*gainR,0,255),g=clamp(px[i+1]*gainG,0,255),b=clamp(px[i+2]*gainB,0,255),hsv=rgbToHsv(r,g,b);
    gray[p]=luma(r,g,b);sat[p]=hsv.s;val[p]=hsv.v;hue[p]=hsv.h;
  }
  const lateralLuma=[],lateralSat=[];
  for(let y=minY;y<=box.maxY;y++)for(let x=minX;x<=box.maxX;x++){
    const p=y*w+x;if(!comp.mask[p])continue;
    const nx=(x-minX)/Math.max(1,bw),ny=(y-minY)/Math.max(1,bh);
    if(((nx>.08&&nx<.30)||(nx>.70&&nx<.92))&&ny>.28&&ny<.92){
      lateralLuma.push(gray[p]);lateralSat.push(sat[p]);
    }
  }
  if(lateralLuma.length<30){
    lateralLuma.length=0;lateralSat.length=0;
    for(let p=0;p<comp.mask.length;p++)if(comp.mask[p]){lateralLuma.push(gray[p]);lateralSat.push(sat[p]);}
  }
  const bodyLuma=median(lateralLuma),bodySaturation=median(lateralSat);
  let validN=0,strictN=0,looseN=0,whiteLike=0,yellowLike=0;
  let centralN=0,centralCoat=0,middleN=0,middleCoat=0,posteriorN=0,posteriorCoat=0,anteriorN=0,anteriorCoat=0;
  const coatMask=new Uint8Array(w*h);
  for(let y=minY;y<=box.maxY;y++)for(let x=minX;x<=box.maxX;x++){
    const p=y*w+x;if(!comp.mask[p])continue;
    const nx=(x-minX)/Math.max(1,bw),ny=(y-minY)/Math.max(1,bh);
    const glare=val[p]>.94&&sat[p]<.12;if(glare)continue;
    validN++;
    const strict=gray[p]>bodyLuma+10&&sat[p]<bodySaturation-.045&&ny>.06&&ny<.80&&nx>.14&&nx<.86;
    const loose=gray[p]>bodyLuma+5&&sat[p]<bodySaturation-.015&&ny>.06&&ny<.82&&nx>.12&&nx<.88;
    if(strict)strictN++;
    if(loose){
      looseN++;coatMask[p]=1;
      if(sat[p]<.28&&val[p]>.40)whiteLike++;
      if(hue[p]>=32&&hue[p]<=70&&sat[p]>.18&&val[p]>.40)yellowLike++;
    }
    if(nx>.34&&nx<.66&&ny>.10&&ny<.82){centralN++;if(loose)centralCoat++;}
    if(ny>.30&&ny<.62){middleN++;if(loose)middleCoat++;}
    if(ny>.04&&ny<.36){posteriorN++;if(loose)posteriorCoat++;}
    if(ny>.62&&ny<.95){anteriorN++;if(loose)anteriorCoat++;}
  }
  const strictRatio=validN?strictN/validN:0,coatRatio=validN?looseN/validN:0;
  const centralRatio=centralN?centralCoat/centralN:0,middleRatio=middleN?middleCoat/middleN:0,posteriorRatio=posteriorN?posteriorCoat/posteriorN:0,anteriorRatio=anteriorN?anteriorCoat/anteriorN:0;
  const whiteRatio=looseN?whiteLike/looseN:0,yellowRatio=looseN?yellowLike/looseN:0;
  const coatingThicknessCandidate=coatRatio>.42?'dày':coatRatio>.09?'mỏng':'rất mỏng';
  const coatingDistributionCandidate=centralRatio>=.22&&Math.max(middleRatio,posteriorRatio)>=anteriorRatio+.035?'trung tâm–sau':coatRatio>.12?'lan tỏa':'không rõ';
  const coatingColorCandidate=coatRatio>=.09&&yellowRatio>=.28&&yellowRatio>whiteRatio*1.25?'vàng':coatRatio>=.07&&(whiteRatio>=.12||yellowRatio<.18)?'trắng':'';
  const bodyColorCandidate=bodySaturation>.44?'đỏ':bodySaturation<.18&&bodyLuma>150?'nhợt':'đỏ nhạt';

  function moistureRegion(kind){
    let sampled=0,glossN=0,strictGlossN=0,roughSum=0,roughN=0,valueSum=0,over=0,under=0;
    const glossMask=new Uint8Array(w*h);
    for(let y=Math.max(minY+1,1);y<=Math.min(box.maxY-1,h-2);y++)for(let x=Math.max(minX+1,1);x<=Math.min(box.maxX-1,w-2);x++){
      const p=y*w+x;if(!comp.mask[p])continue;
      if(!comp.mask[p-1]||!comp.mask[p+1]||!comp.mask[p-w]||!comp.mask[p+w])continue;
      const coatVotes=coatMask[p]+coatMask[p-1]+coatMask[p+1]+coatMask[p-w]+coatMask[p+w];
      const inCoating=coatVotes>=2;
      if(kind==='body'&&inCoating)continue;
      if(kind==='coating'&&!inCoating)continue;
      const local=(gray[p-1]+gray[p+1]+gray[p-w]+gray[p+w])/4;
      const bright=(gray[p]-local)/255;
      const micro=Math.abs(gray[p]-local)/255;
      const softGloss=val[p]>.68&&sat[p]<.34&&bright>.028;
      const strictGloss=val[p]>.90&&sat[p]<.24&&bright>.018;
      sampled++;valueSum+=val[p];
      if(val[p]>.985)over++;if(val[p]<.15)under++;
      if(softGloss){glossN++;glossMask[p]=1;}
      if(strictGloss)strictGlossN++;
      if(!softGloss){roughSum+=micro;roughN++;}
    }
    const largest=glossN?largestComponent(glossMask,w,h).area:0;
    const dominance=glossN?largest/glossN:0;
    return Object.freeze({
      sampledPixels:sampled,
      glossRatio:q(sampled?glossN/sampled:0),
      strictGlossRatio:q(sampled?strictGlossN/sampled:0),
      largestGlossComponentRatio:q(dominance),
      distributedGlossRatio:q(glossN?(glossN-largest)/glossN:0),
      roughness:q(roughN?roughSum/roughN:0),
      meanValue:q(sampled?valueSum/sampled:0),
      overexposedRatio:q(sampled?over/sampled:0),
      underexposedRatio:q(sampled?under/sampled:0)
    });
  }
  const moistureSurface=moistureRegion('surface');
  const moistureBody=moistureRegion('body');
  const moistureCoating=moistureRegion('coating');
  const moistureObservation=Object.freeze({
    schemaVersion:'tongue-moisture-features-v1',
    surface:moistureSurface,
    body:moistureBody,
    coating:moistureCoating,
    qc:Object.freeze({
      roiCoverage:q(comp.area/(w*h)),
      overexposedRatio:moistureSurface.overexposedRatio,
      underexposedRatio:moistureSurface.underexposedRatio,
      largestGlossComponentRatio:moistureSurface.largestGlossComponentRatio,
      neutralReferencePixels:neutralN,
      colorNormalizationApplied:normalizationApplied
    }),
    method:'local-specular-plus-microtexture-v1',
    calibration:'engineering-candidate-not-clinical-threshold'
  });

  const y0=Math.max(0,Math.floor(minY+.32*bh)),y1=Math.min(h-1,Math.ceil(minY+.95*bh));
  const x0=Math.max(0,Math.floor(symmetryAxis-.15*bw)),x1=Math.min(w-1,Math.ceil(symmetryAxis+.15*bw));
  let bestX=symmetryAxis,bestMean=0,bestHits=0,rowCount=Math.max(0,y1-y0+1);
  if(rowCount>=10&&x1-x0+1>=8){
    for(let x=x0;x<=x1;x++){
      let sum=0,hits=0;
      for(let y=y0;y<=y1;y++){
        const baseline=rowMean(gray,w,y,x-7,x+7),narrow=rowMean(gray,w,y,x-1,x+1);
        const contrast=Math.max(0,baseline-narrow);sum+=contrast;if(contrast>5)hits++;
      }
      const mean=sum/rowCount;if(mean>bestMean){bestMean=mean;bestHits=hits;bestX=x;}
    }
  }
  const continuity=rowCount?bestHits/rowCount:0;
  const centrality=clamp(1-Math.abs(bestX-symmetryAxis)/Math.max(1,bw*.22));
  const sulcusScore=clamp((bestMean/7)*.45+(continuity/.42)*.35+centrality*.20);
  const visibleSignal=sulcusScore>=.62&&centrality>=.35&&continuity>=.22;
  return {
    schemaVersion:'tongue-spatial-observation-v2',
    roiCoverage:q(comp.area/(w*h)),
    bodyLuma:q(bodyLuma/255),
    bodySaturation:q(bodySaturation),
    bodyColorCandidate,
    coatingCandidateRatio:q(coatRatio),
    strictCoatingCandidateRatio:q(strictRatio),
    coatingColorCandidate,
    coatingWhiteLikeRatio:q(whiteRatio),
    coatingYellowLikeRatio:q(yellowRatio),
    coatingThicknessCandidate,
    coatingDistributionCandidate,
    coatingZones:Object.freeze({central:q(centralRatio),middle:q(middleRatio),posterior:q(posteriorRatio),anterior:q(anteriorRatio)}),
    moisture:moistureObservation,
    colorNormalization:Object.freeze({applied:normalizationApplied,neutralPixels:neutralN,gainR:q(gainR),gainG:q(gainG),gainB:q(gainB),bounded:true}),
    medianSulcus:Object.freeze({
      visibleSignal,
      score:q(sulcusScore),
      continuity:q(continuity),
      centrality:q(centrality),
      meanDarkContrast:q(bestMean/255),
      source:'deterministic-symmetry-relative-dark-line-v2'
    }),
    fissurePolicy:'median-sulcus-is-not-pathological-fissure',
    authority:'direct-image-observation-only'
  };
}
async function signatureFromDataUrl(dataUrl){
  if(typeof dataUrl!=='string'||dataUrl.length<100||typeof createImageBitmap!=='function'||typeof OffscreenCanvas!=='function')return null;
  let bitmap=null;
  try{
    const blob=await (await fetch(dataUrl)).blob();bitmap=await createImageBitmap(blob);
    const max=192,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height)),w=Math.max(48,Math.round(bitmap.width*scale)),h=Math.max(48,Math.round(bitmap.height*scale));
    const canvas=new OffscreenCanvas(w,h),ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
    ctx.drawImage(bitmap,0,0,w,h);
    const px=ctx.getImageData(0,0,w,h).data,n=w*h,minArea=Math.max(120,n*.018);
    let comp=largestComponent(buildTongueMask(px,w,h,false),w,h),segmentationMode='strict';
    if(comp.area<minArea){
      const relaxed=largestComponent(buildTongueMask(px,w,h,true),w,h);
      if(relaxed.area>comp.area){comp=relaxed;segmentationMode='adaptive-low-saturation';}
    }
    if(comp.area<minArea)return null;
    let minX=w,minY=h,maxX=0,maxY=0;
    for(let p=0;p<n;p++)if(comp.mask[p]){const x=p%w,y=(p/w)|0;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    const bw=Math.max(1,maxX-minX+1),bh=Math.max(1,maxY-minY+1),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    let den=0,sr=0,sg=0,sb=0,ss=0,sv=0,purple=0,white=0,yellow=0,dark=0,spot=0;
    const gray=p=>{const i=p*4;return luma(px[i],px[i+1],px[i+2]);};
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      const nx=(x-cx)/(bw*.52),ny=(y-cy)/(bh*.52);if(nx*nx+ny*ny>1)continue;
      const p=y*w+x,i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b);
      if(!(comp.mask[p]||((r>g*.98&&r>b*.86)&&hsv.v>.22)))continue;
      den++;sr+=r/255;sg+=g/255;sb+=b/255;ss+=hsv.s;sv+=hsv.v;
      const isPurple=((hsv.h>=285&&hsv.h<=345)||(b>g*1.04&&r>g*1.04))&&hsv.s>.16;
      if(isPurple)purple++;if(hsv.v>.66&&hsv.s<.27)white++;if(hsv.h>=32&&hsv.h<=70&&hsv.s>.18&&hsv.v>.45)yellow++;
      if((hsv.h<15||hsv.h>345)&&hsv.s>.52&&hsv.v>.38)spot++;
      if(x>minX+1&&x<maxX-1&&y>minY+1&&y<maxY-1){const g0=gray(p),neigh=(gray(p-1)+gray(p+1)+gray(p-w)+gray(p+w))/4;if(g0<neigh-24&&g0<135)dark++;}
    }
    if(den<50)return null;
    const spatial=spatialObservation(px,w,h);
    return {
      r:q(sr/den),g:q(sg/den),b:q(sb/den),s:q(ss/den),v:q(sv/den),
      purple:q(purple/den),white:q(white/den),yellow:q(yellow/den),dark:q(dark/den),spot:q(spot/den),
      aspect:q(bw/bh),coverage:q(comp.area/n),segmentationMode,spatial
    };
  }catch{return null;}finally{try{bitmap?.close?.();}catch{}}
}
scope.AITCAcademicVision=Object.freeze({source:SOURCE,signatureFromDataUrl});
})(self);
