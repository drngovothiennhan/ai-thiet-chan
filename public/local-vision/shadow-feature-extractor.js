import {boundedChannelGains,normalizeRgb,mapNormalizedGeometry,SHADOW_PREPROCESS_VERSION} from './shadow-preprocess-v3.js';

export const SHADOW_FEATURE_VERSION='shadow-feature-extractor-v3';

function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,Number(v)||0));}
function q(v,n=4){return Number(Number(v||0).toFixed(n));}
function rgbToHsv(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0;
  if(d){if(max===r)h=60*((g-b)/d%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4);}
  if(h<0)h+=360;
  return {h,s:max?d/max:0,v:max};
}
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
function bbox(mask,w,h){
  let minX=w,minY=h,maxX=-1,maxY=-1;
  for(let p=0;p<mask.length;p++)if(mask[p]){const x=p%w,y=(p/w)|0;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  return maxX<0?null:{minX,minY,maxX,maxY,width:maxX-minX+1,height:maxY-minY+1};
}
function neutralReference(px,w,h,roiMask){
  let sr=0,sg=0,sb=0,count=0;
  const minX=Math.floor(w*.06),maxX=Math.ceil(w*.94),minY=Math.floor(h*.05),maxY=Math.ceil(h*.95);
  for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++){
    const p=y*w+x;if(roiMask?.[p])continue;
    const i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b);
    if(hsv.s>.13||hsv.v<.24||hsv.v>.92)continue;
    sr+=r;sg+=g;sb+=b;count++;
  }
  return {r:count?sr/count:0,g:count?sg/count:0,b:count?sb/count:0,sampleCount:count};
}
function candidateColor(stats,flashRisk){
  const {r,g,b,s,v,purpleRatio}=stats;
  let label='đỏ nhạt',margin=.15;
  if(purpleRatio>.12){label='tím';margin=clamp((purpleRatio-.12)/.18);}
  else if(r>g*1.23&&s>.32){label='đỏ';margin=clamp((r/g-1.23)/.22+s-.32);}
  else if(s<.20&&v>.62){label='nhợt';margin=clamp((.20-s)*3+(v-.62));}
  else margin=clamp(.42-Math.abs(r-g)*.5);
  return {labelCandidate:label,score:q(margin*(1-.55*flashRisk)),calibrated:false,authority:false};
}
async function decode(dataUrl,maxSide=192){
  if(typeof createImageBitmap!=='function'||typeof OffscreenCanvas==='undefined')throw new Error('SHADOW_FEATURE_CANVAS_UNAVAILABLE');
  const blob=await (await fetch(dataUrl)).blob();const bitmap=await createImageBitmap(blob);
  try{
    const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
    const w=Math.max(48,Math.round(bitmap.width*scale)),h=Math.max(48,Math.round(bitmap.height*scale));
    const canvas=new OffscreenCanvas(w,h),ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw new Error('SHADOW_FEATURE_CONTEXT_UNAVAILABLE');
    ctx.drawImage(bitmap,0,0,w,h);
    return {w,h,px:ctx.getImageData(0,0,w,h).data};
  }finally{try{bitmap.close?.();}catch{}}
}
export async function analyzeShadowFeatureCandidates(dataUrl,role='top',options={}){
  const started=performance.now();
  const normalizedRole=role==='bottom'?'bottom':'top';
  const {w,h,px}=await decode(dataUrl);
  const n=w*h,raw=new Uint8Array(n),gray=new Float32Array(n);
  const modelWindow=normalizedRole==='top'?mapNormalizedGeometry(options?.roiGeometry,w,h,.055):null;
  for(let p=0;p<n;p++){
    const x=p%w,y=(p/w)|0,i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b);
    gray[p]=.299*r+.587*g+.114*b;
    if(x<w*.05||x>w*.95||y<h*.04||y>h*.97)continue;
    if(modelWindow&&(x<modelWindow.minX||x>modelWindow.maxX||y<modelWindow.minY||y>modelWindow.maxY))continue;
    const redBias=r-(g+b)/2;
    if(r>48&&hsv.v>.18&&hsv.s>.055&&(hsv.h<=75||hsv.h>=285)&&redBias>-3)raw[p]=1;
  }
  const comp=largestComponent(raw,w,h),box=bbox(comp.mask,w,h);
  if(!box||comp.area<Math.max(90,n*.012))return Object.freeze({
    schemaVersion:'aitc-shadow-feature-candidates-v3',runtimeVersion:SHADOW_FEATURE_VERSION,role:normalizedRole,status:'insufficient-roi',
    authority:false,productionEligible:false,latencyMs:Math.round(performance.now()-started)
  });

  const neutral=neutralReference(px,w,h,comp.mask);
  const normalization=boundedChannelGains(neutral,{minSamples:Math.max(64,Math.floor(n*.003)),limit:.20});
  const gains=normalization.gains;
  let den=0,glare=0,clipDark=0,grad=0,gradN=0,sr=0,sg=0,sb=0,ss=0,sv=0,robustN=0,purpleN=0;
  let nsr=0,nsg=0,nsb=0,nss=0,nsv=0,npurpleN=0;
  let darkTotal=0,darkCentral=0,darkOff=0,centralRows=0,longestRun=0,currentRun=0,offBins=new Set();
  let vessel=0,leftVessel=0,rightVessel=0,darkPurple=0,bottomCentral=0;
  const cx=(box.minX+box.maxX)/2,bw=Math.max(1,box.width),bh=Math.max(1,box.height);
  for(let y=box.minY;y<=box.maxY;y++){
    let rowCentral=false;
    for(let x=box.minX;x<=box.maxX;x++){
      const p=y*w+x;if(!comp.mask[p])continue;den++;
      const i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b);
      const isGlare=hsv.v>.92&&hsv.s<.18;if(isGlare)glare++;
      if(hsv.v<.10)clipDark++;
      if(!isGlare){
        sr+=r/255;sg+=g/255;sb+=b/255;ss+=hsv.s;sv+=hsv.v;robustN++;
        if(((hsv.h>=275&&hsv.h<=345)||(b>g*1.04&&r>g*1.04))&&hsv.s>.15)purpleN++;
        const normalized=normalizeRgb(r,g,b,gains),nhsv=rgbToHsv(normalized.r,normalized.g,normalized.b);
        nsr+=normalized.r/255;nsg+=normalized.g/255;nsb+=normalized.b/255;nss+=nhsv.s;nsv+=nhsv.v;
        if(((nhsv.h>=275&&nhsv.h<=345)||(normalized.b>normalized.g*1.04&&normalized.r>normalized.g*1.04))&&nhsv.s>.15)npurpleN++;
      }
      if(x>0&&y>0){grad+=(Math.abs(gray[p]-gray[p-1])+Math.abs(gray[p]-gray[p-w]))/510;gradN++;}
      if(normalizedRole==='top'&&x>box.minX+1&&x<box.maxX-1&&y>box.minY+1&&y<box.maxY-1){
        const neigh=(gray[p-1]+gray[p+1]+gray[p-w]+gray[p+w])/4;
        const localDark=gray[p]<neigh-17&&gray[p]<165;
        if(localDark){
          darkTotal++;const nx=Math.abs(x-cx)/(bw/2);
          if(nx<.18){darkCentral++;rowCentral=true;}else{darkOff++;offBins.add(Math.min(7,Math.floor(nx*8)));}
        }
      }
      if(normalizedRole==='bottom'){
        const nx=(x-box.minX)/bw,ny=(y-box.minY)/bh;
        if(nx>.08&&nx<.92&&ny>.05&&ny<.97){
          bottomCentral++;
          const purpleBlue=((hsv.h>=235&&hsv.h<=345)||(b>g*1.04&&r>g*1.04))&&hsv.s>.12&&hsv.v<.76;
          if(purpleBlue){vessel++;if(nx<.5)leftVessel++;else rightVessel++;if(hsv.v<.56)darkPurple++;}
        }
      }
    }
    if(normalizedRole==='top'){
      if(rowCentral){centralRows++;currentRun++;longestRun=Math.max(longestRun,currentRun);}else currentRun=0;
    }
  }
  const coverage=comp.area/n,glareRatio=den?glare/den:0,flashRisk=clamp(glareRatio/.085);
  const qc={roiCoverage:q(coverage),glareRatio:q(glareRatio),darkClipRatio:q(den?clipDark/den:0),sharpnessProxy:q(gradN?grad/gradN:0),flashRiskScore:q(flashRisk),authority:false};
  const stats={r:robustN?sr/robustN:0,g:robustN?sg/robustN:0,b:robustN?sb/robustN:0,s:robustN?ss/robustN:0,v:robustN?sv/robustN:0,purpleRatio:robustN?purpleN/robustN:0};
  const normalizedStats={r:robustN?nsr/robustN:0,g:robustN?nsg/robustN:0,b:robustN?nsb/robustN:0,s:robustN?nss/robustN:0,v:robustN?nsv/robustN:0,purpleRatio:robustN?npurpleN/robustN:0};
  const roi={coverage:q(coverage),bboxAspect:q(box.width/Math.max(1,box.height)),centralized:q(1-Math.min(1,Math.abs(cx-w/2)/(w/2))),modelGuided:Boolean(modelWindow),authority:false};
  const preprocess={
    version:SHADOW_PREPROCESS_VERSION,
    modelGuidedRoi:Boolean(modelWindow),
    roiWindow:modelWindow?{minX:modelWindow.minX,minY:modelWindow.minY,maxX:modelWindow.maxX,maxY:modelWindow.maxY}:null,
    neutralReferencePixels:neutral.sampleCount,
    normalization,
    authority:false,
    productionEligible:false
  };
  let topCandidates=null,bottomCandidates=null;
  if(normalizedRole==='top'){
    const continuity=bh?longestRun/bh:0,centralDominance=darkTotal?darkCentral/darkTotal:0,offRatio=darkTotal?darkOff/darkTotal:0;
    const darkDensity=den?darkTotal/den:0;
    const rawColor=candidateColor(stats,flashRisk);
    const normalizedColor=candidateColor(normalizedStats,flashRisk);
    topCandidates={
      color:{
        ...(normalization.applied?normalizedColor:rawColor),
        rawLabelCandidate:rawColor.labelCandidate,
        rawScore:rawColor.score,
        normalizedLabelCandidate:normalizedColor.labelCandidate,
        normalizedScore:normalizedColor.score,
        normalizationApplied:Boolean(normalization.applied),
        normalizationVersion:SHADOW_PREPROCESS_VERSION,
        authority:false
      },
      moisture:{surfaceHighlightRatio:q(glareRatio),score:q(clamp(glareRatio/.045)),reliability:q(1-flashRisk),flashConfounded:flashRisk>.25,calibrated:false,authority:false},
      medianSulcus:{score:q(clamp(continuity*centralDominance*Math.min(1,darkDensity/.018))),centralContinuity:q(continuity),centralDominance:q(centralDominance),authority:false},
      fissure:{score:q(clamp(offRatio*Math.min(1,darkDensity/.025)*(offBins.size/8))),offCenterDarkRatio:q(offRatio),spreadBins:offBins.size,depthAssessable:false,authority:false}
    };
  }else{
    const vr=bottomCentral?vessel/bottomCentral:0,dr=bottomCentral?darkPurple/bottomCentral:0;
    const lr=bottomCentral?leftVessel/bottomCentral:0,rr=bottomCentral?rightVessel/bottomCentral:0;
    const balance=Math.max(lr,rr)>0?Math.min(lr,rr)/Math.max(lr,rr):0;
    bottomCandidates={
      undersideFrame:{score:q(clamp((coverage/.22)*.55+(1-flashRisk)*.20+Math.min(1,vr/.035)*.25)),authority:false},
      vesselVisibility:{score:q(clamp(vr/.055)),candidateRatio:q(vr),authority:false},
      bilateralVessels:{balance:q(balance),leftRatio:q(lr),rightRatio:q(rr),authority:false},
      darkPurple:{ratio:q(dr),score:q(clamp(dr/.025)),authority:false},
      measurement:{absoluteScale:false,mmAllowed:false,authority:false}
    };
  }
  return Object.freeze({
    schemaVersion:'aitc-shadow-feature-candidates-v3',runtimeVersion:SHADOW_FEATURE_VERSION,role:normalizedRole,status:'complete',
    authority:false,productionEligible:false,qc,roi,preprocess,topCandidates,bottomCandidates,latencyMs:Math.round(performance.now()-started)
  });
}
