(function(scope){
'use strict';
const VERSION='roi-qc-v2-multiscale';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
function q(v,n=2){return Number(Number(v||0).toFixed(n));}
function rgbToHsv(r,g,b){
  r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;
  if(d){if(max===r)h=60*((g-b)/d%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4);}
  if(h<0)h+=360;return {h,s:max?d/max:0,v:max};
}
function largestComponent(mask,w,h){
  const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);let best=[];
  for(let seed=0;seed<mask.length;seed++){
    if(!mask[seed]||seen[seed])continue;
    let head=0,tail=0;queue[tail++]=seed;seen[seed]=1;const cells=[];
    while(head<tail){
      const p=queue[head++];cells.push(p);const x=p%w,y=(p/w)|0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;
        const np=ny*w+nx;if(mask[np]&&!seen[np]){seen[np]=1;queue[tail++]=np;}
      }
    }
    if(cells.length>best.length)best=cells;
  }
  const out=new Uint8Array(mask.length);for(const p of best)out[p]=1;return {mask:out,area:best.length};
}
function rowFill(mask,w,h){
  const out=new Uint8Array(mask);
  for(let y=0;y<h;y++){
    let first=-1,last=-1,count=0;
    for(let x=0;x<w;x++)if(mask[y*w+x]){if(first<0)first=x;last=x;count++;}
    if(count>=6&&last-first>=8)for(let x=first;x<=last;x++)out[y*w+x]=1;
  }
  return out;
}
function bounds(mask,w,h){
  let minX=w,minY=h,maxX=-1,maxY=-1;
  for(let p=0;p<mask.length;p++)if(mask[p]){const x=p%w,y=(p/w)|0;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  return maxX<0?null:{minX,minY,maxX,maxY,width:maxX-minX+1,height:maxY-minY+1};
}
function tongueMask(data,w,h,view='top',relaxed=false){
  const out=new Uint8Array(w*h),bottom=view==='bottom';
  const x0=bottom?.10:.08,x1=bottom?.90:.92,y0=bottom?.10:.07,y1=bottom?.95:.97;
  for(let p=0;p<out.length;p++){
    const x=p%w,y=(p/w)|0;if(x<w*x0||x>w*x1||y<h*y0||y>h*y1)continue;
    const i=p*4,r=data[i],g=data[i+1],b=data[i+2],hsv=rgbToHsv(r,g,b),redBias=r-(g+b)/2;
    const hueOk=hsv.h<=72||hsv.h>=286;
    const strict=r>58&&hsv.v>.20&&hsv.s>.07&&hueOk&&redBias>2&&r>=b*.90;
    const loose=r>48&&hsv.v>.16&&hsv.s>.035&&hueOk&&redBias>-4&&r>=g*.97&&r>=b*.86;
    if(relaxed?loose:strict)out[p]=1;
  }
  return out;
}
function centralFallbackMask(w,h,view='top'){
  const out=new Uint8Array(w*h),bottom=view==='bottom',cx=.5*w,cy=(bottom?.54:.56)*h,rx=.31*w,ry=(bottom?.34:.39)*h;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(x-cx)/rx,dy=(y-cy)/ry;if(dx*dx+dy*dy<=1)out[y*w+x]=1;}
  return out;
}
function buildRoi(data,w,h,view='top'){
  let comp=largestComponent(tongueMask(data,w,h,view,false),w,h);
  if(comp.area<w*h*.018){const relaxed=largestComponent(tongueMask(data,w,h,view,true),w,h);if(relaxed.area>comp.area)comp=relaxed;}
  const detected=comp.area>=Math.max(120,w*h*.012);
  const mask=rowFill(detected?comp.mask:centralFallbackMask(w,h,view),w,h);
  const box=bounds(mask,w,h);
  let area=0;for(const v of mask)area+=v;
  return {mask,box,detected,coverage:area/(w*h)};
}
function percentile(values,p){
  if(!values.length)return 0;const a=values.slice().sort((x,y)=>x-y),idx=Math.max(0,Math.min(a.length-1,Math.round((a.length-1)*p)));return a[idx];
}
function focusMetrics(gray,mask,w,h,step=1){
  let edge=0,edgeN=0,lapSum=0,lapSq=0,lapN=0;
  for(let y=step;y<h-step;y+=step)for(let x=step;x<w-step;x+=step){
    const p=y*w+x;if(!mask[p]||!mask[p-step]||!mask[p+step]||!mask[p-step*w]||!mask[p+step*w])continue;
    const c=gray[p],l=gray[p-step],r=gray[p+step],u=gray[p-step*w],d=gray[p+step*w];
    edge+=(Math.abs(c-l)+Math.abs(c-u))/(2*step);edgeN++;
    const lap=(4*c-l-r-u-d)/step;lapSum+=lap;lapSq+=lap*lap;lapN++;
  }
  const mean=lapN?lapSum/lapN:0;
  return {edge:edgeN?edge/edgeN:0,laplacianVariance:lapN?Math.max(0,lapSq/lapN-mean*mean):0,samples:lapN};
}
function computePixelsQc(data,w,h,{view='top'}={}){
  if(!data||!w||!h)throw new Error('QC_IMAGE_REQUIRED');
  const roi=buildRoi(data,w,h,view),mask=roi.mask,box=roi.box||{width:0,height:0};
  const gray=new Float32Array(w*h),values=[];let sum=0,sumSq=0,high=0,low=0,n=0;
  for(let p=0;p<w*h;p++){
    const i=p*4,g=.299*data[i]+.587*data[i+1]+.114*data[i+2];gray[p]=g;
    if(!mask[p])continue;values.push(g);sum+=g;sumSq+=g*g;n++;if(g>=248)high++;if(g<=28)low++;
  }
  const brightness=n?sum/n:0,variance=n?Math.max(0,sumSq/n-brightness*brightness):0,contrast=Math.sqrt(variance);
  const p10=percentile(values,.10),p90=percentile(values,.90),dynamicRange=p90-p10;
  const fine=focusMetrics(gray,mask,w,h,1),coarse=focusMetrics(gray,mask,w,h,2);
  const highlightRatio=n?high/n:1,shadowRatio=n?low/n:1,minSide=Math.min(w,h),roiMin=Math.min(box.width||0,box.height||0);
  const highlight=highlightRatio<.08,shadow=shadowRatio<.10;
  const resolution=minSide>=480&&roiMin>=110;
  const light=brightness>=55&&brightness<=225&&highlightRatio<.12&&shadowRatio<.14;
  const dynamic=contrast>=18&&dynamicRange>=42;
  const focusFine=fine.laplacianVariance>=38&&fine.edge>=5.2;
  const focusCoarse=coarse.laplacianVariance>=26&&coarse.edge>=4.2;
  const focus=focusFine||(fine.laplacianVariance>=28&&fine.edge>=6.2&&focusCoarse);
  const clipping=highlight&&shadow;
  const checks={resolution,light,dynamic,focus,highlight,shadow,clipping};
  const passed=[resolution,light,dynamic,focus,clipping].filter(Boolean).length;
  let grade=passed===5?'good':passed>=3?'fair':'poor';
  if(!roi.detected&&grade==='good')grade='fair';
  const focusScore=clamp(Math.max(fine.laplacianVariance/90,fine.edge/10,coarse.laplacianVariance/70));
  const exposureScore=clamp(1-highlightRatio/.12)*.5+clamp(1-shadowRatio/.16)*.5;
  const lightScore=clamp(1-Math.abs(brightness-140)/120);
  const dynamicScore=clamp(dynamicRange/85);
  const resolutionScore=clamp(Math.min(minSide/720,roiMin/220));
  const qualityScore=Math.round(100*(.15*resolutionScore+.20*lightScore+.15*dynamicScore+.30*focusScore+.20*exposureScore)*(roi.detected?1:.82));
  return {
    version:VERSION,grade,width:w,height:h,view,roiDetected:roi.detected,roiCoverage:q(roi.coverage,4),roi:{width:box.width||0,height:box.height||0},
    brightness:q(brightness,1),contrast:q(contrast,1),dynamicRange:q(dynamicRange,1),
    edge:q(fine.edge,1),laplacianVariance:q(fine.laplacianVariance,1),coarseEdge:q(coarse.edge,1),coarseLaplacianVariance:q(coarse.laplacianVariance,1),
    glare:q(highlightRatio*100,1),darkness:q(shadowRatio*100,1),qualityScore,checks
  };
}
function computeCanvasQc(ctx,w,h,{view='top'}={}){
  const maxSide=560,scale=Math.min(1,maxSide/Math.max(w,h)),sw=Math.max(1,Math.round(w*scale)),sh=Math.max(1,Math.round(h*scale));
  let data;
  if(scale===1)data=ctx.getImageData(0,0,w,h).data;
  else{
    const temp=document.createElement('canvas');temp.width=sw;temp.height=sh;const t=temp.getContext('2d',{willReadFrequently:true});t.imageSmoothingEnabled=true;t.imageSmoothingQuality='high';t.drawImage(ctx.canvas,0,0,sw,sh);data=t.getImageData(0,0,sw,sh).data;
  }
  const qc=computePixelsQc(data,sw,sh,{view});
  qc.width=w;qc.height=h;qc.sampleWidth=sw;qc.sampleHeight=sh;
  return qc;
}
scope.AITCQC=Object.freeze({version:VERSION,computePixelsQc,computeCanvasQc});
})(globalThis);
