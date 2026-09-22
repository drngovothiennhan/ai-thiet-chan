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
  spatialObservationVersion:'tongue-spatial-observation-v3',
  moistureObservationVersion:'tongue-moisture-features-v1',
  morphologyObservationVersion:'mouth-anchored-multiscale-morphology-v1'
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
function shapeAndToothmarkMetrics(mask,w,h,box){
  const {minX,minY,maxX,maxY,width:bw,height:bh}=box;
  const rows=[];let area=0;
  for(let y=minY;y<=maxY;y++){
    let first=-1,last=-1,count=0;
    for(let x=minX;x<=maxX;x++){
      if(!mask[y*w+x])continue;
      area++;if(first<0)first=x;last=x;count++;
    }
    if(count>=4)rows.push({y,first,last,width:last-first+1,center:(first+last)/2,ny:(y-minY)/Math.max(1,bh)});
  }
  const widths=(a,b)=>rows.filter(r=>r.ny>=a&&r.ny<=b).map(r=>r.width/Math.max(1,bw));
  const med=(a,b)=>{const v=widths(a,b);return v.length?median(v):0;};
  const allWidths=rows.map(r=>r.width/Math.max(1,bw));
  const meanWidth=allWidths.length?allWidths.reduce((a,b)=>a+b,0)/allWidths.length:0;
  const widthStd=allWidths.length?Math.sqrt(allWidths.reduce((s,x)=>s+(x-meanWidth)**2,0)/allWidths.length):0;
  let contourDelta=0,deltaN=0;
  for(let i=1;i<rows.length;i++){
    contourDelta+=Math.abs(rows[i].width-rows[i-1].width)/Math.max(1,bw);deltaN++;
  }
  const contourSmoothness=deltaN?contourDelta/deltaN:0;
  const centerMedian=rows.length?median(rows.map(r=>r.center)):minX+bw/2;
  const centerlineDeviation=rows.length?rows.reduce((s,r)=>s+Math.abs(r.center-centerMedian)/Math.max(1,bw),0)/rows.length:0;
  const root=med(.05,.28),shoulder=med(.18,.42),mid=med(.32,.68),tip=med(.72,.94);
  const side=rows.filter(r=>r.ny>=.22&&r.ny<=.84);
  let leftIndent=0,rightIndent=0,leftEvents=0,rightEvents=0,leftN=0,rightN=0;
  for(let i=2;i<side.length-2;i++){
    const r=side[i],neighbors=[side[i-2],side[i-1],side[i+1],side[i+2]];
    const lf=neighbors.reduce((s,x)=>s+x.first,0)/neighbors.length;
    const rt=neighbors.reduce((s,x)=>s+x.last,0)/neighbors.length;
    const li=Math.max(0,r.first-lf),ri=Math.max(0,rt-r.last);
    leftIndent+=li;rightIndent+=ri;leftN++;rightN++;
    if(li>=bw*.028)leftEvents++;
    if(ri>=bw*.028)rightEvents++;
  }
  const leftMean=leftN?leftIndent/leftN:0,rightMean=rightN?rightIndent/rightN:0;
  const leftScore=clamp((leftMean/Math.max(1,bw*.045))*.68+Math.min(1,leftEvents/5)*.32);
  const rightScore=clamp((rightMean/Math.max(1,bw*.045))*.68+Math.min(1,rightEvents/5)*.32);
  const bilateral=Math.min(leftScore,rightScore);
  const toothmarkScore=clamp(((leftScore+rightScore)/2)*.72+bilateral*.28);
  return Object.freeze({
    shape:Object.freeze({
      aspect:q(bw/Math.max(1,bh)),
      areaFill:q(area/Math.max(1,bw*bh)),
      rootWidthRatio:q(root),
      shoulderWidthRatio:q(shoulder),
      midWidthRatio:q(mid),
      tipWidthRatio:q(tip),
      meanWidthRatio:q(meanWidth),
      widthStdRatio:q(widthStd),
      tipTaperRatio:q(mid>0?tip/mid:0),
      rootToMidRatio:q(mid>0?root/mid:0),
      contourSmoothness:q(contourSmoothness),
      centerlineDeviation:q(centerlineDeviation),
      roiWidthRatio:q(bw/w),
      roiHeightRatio:q(bh/h),
      topMargin:q(minY/h),
      bottomMargin:q((h-1-maxY)/h),
      edgeRowCoverage:q(rows.length/Math.max(1,bh)),
      method:'multi-profile-tongue-geometry-v2'
    }),
    toothmarks:Object.freeze({
      score:q(toothmarkScore),
      leftScore:q(leftScore),
      rightScore:q(rightScore),
      bilateralScore:q(bilateral),
      leftEvents,
      rightEvents,
      method:'bilateral-smoothed-edge-concavity-v2'
    })
  });
}
function toothmarkEdgeColorSupport(mask,gray,w,h,box){
  const {minX,minY,maxX,maxY,width:bw,height:bh}=box;
  const band=Math.max(1,Math.round(bw*.028));
  const gap=Math.max(2,Math.round(bw*.050));
  let lSum=0,rSum=0,lRows=0,rRows=0,lDark=0,rDark=0;
  const meanBand=(y,a,b)=>{
    let sum=0,n=0;
    for(let x=Math.max(minX,a);x<=Math.min(maxX,b);x++){
      const p=y*w+x;if(!mask[p])continue;sum+=gray[p];n++;
    }
    return n?sum/n:null;
  };
  for(let y=Math.max(minY,Math.floor(minY+.22*bh));y<=Math.min(maxY,Math.ceil(minY+.84*bh));y++){
    let first=-1,last=-1,count=0;
    for(let x=minX;x<=maxX;x++)if(mask[y*w+x]){if(first<0)first=x;last=x;count++;}
    if(count<10)continue;
    const le=meanBand(y,first,first+band),li=meanBand(y,first+gap,first+gap+band);
    const re=meanBand(y,last-band,last),ri=meanBand(y,last-gap-band,last-gap);
    if(le!==null&&li!==null){const d=Math.max(0,(li-le)/255);lSum+=d;lRows++;if(d>=.018)lDark++;}
    if(re!==null&&ri!==null){const d=Math.max(0,(ri-re)/255);rSum+=d;rRows++;if(d>=.018)rDark++;}
  }
  const lMean=lRows?lSum/lRows:0,rMean=rRows?rSum/rRows:0;
  const lFrac=lRows?lDark/lRows:0,rFrac=rRows?rDark/rRows:0;
  const leftScore=clamp((lMean/.045)*.58+(lFrac/.35)*.42);
  const rightScore=clamp((rMean/.045)*.58+(rFrac/.35)*.42);
  return Object.freeze({
    leftScore:q(leftScore),rightScore:q(rightScore),bilateralScore:q(Math.min(leftScore,rightScore)),
    leftMeanDarkContrast:q(lMean),rightMeanDarkContrast:q(rMean),
    leftDarkRowFraction:q(lFrac),rightDarkRowFraction:q(rFrac),
    method:'lateral-edge-relative-darkening-v1',
    role:'secondary-support-only'
  });
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
  let validN=0,strictN=0,looseN=0,whiteLike=0,yellowLike=0,darkLike=0,darkNeutral=0;
  let centralN=0,centralCoat=0,middleN=0,middleCoat=0,posteriorN=0,posteriorCoat=0,anteriorN=0,anteriorCoat=0;
  let darkCentralN=0,darkCentral=0,darkPosteriorN=0,darkPosterior=0;
  const coatMask=new Uint8Array(w*h);
  for(let y=minY;y<=box.maxY;y++)for(let x=minX;x<=box.maxX;x++){
    const p=y*w+x;if(!comp.mask[p])continue;
    const nx=(x-minX)/Math.max(1,bw),ny=(y-minY)/Math.max(1,bh);
    const glare=val[p]>.94&&sat[p]<.12;if(glare)continue;
    validN++;
    const strict=gray[p]>bodyLuma+10&&sat[p]<bodySaturation-.045&&ny>.06&&ny<.80&&nx>.14&&nx<.86;
    const loose=gray[p]>bodyLuma+5&&sat[p]<bodySaturation-.015&&ny>.06&&ny<.82&&nx>.12&&nx<.88;
    const darkInterior=ny>.06&&ny<.82&&nx>.12&&nx<.88;
    const darkContrast=bodyLuma-gray[p];
    const dark=darkInterior&&darkContrast>=14&&sat[p]<=Math.min(.42,bodySaturation+.08)&&val[p]>=.12&&val[p]<=.62;
    if(strict)strictN++;
    if(loose){
      looseN++;
      if(sat[p]<.28&&val[p]>.40)whiteLike++;
      if(hue[p]>=32&&hue[p]<=70&&sat[p]>.18&&val[p]>.40)yellowLike++;
    }
    if(dark){darkLike++;if(sat[p]<=.32)darkNeutral++;}
    if(loose||dark)coatMask[p]=1;
    if(nx>.34&&nx<.66&&ny>.10&&ny<.82){centralN++;if(loose)centralCoat++;darkCentralN++;if(dark)darkCentral++;}
    if(ny>.30&&ny<.62){middleN++;if(loose)middleCoat++;}
    if(ny>.04&&ny<.36){posteriorN++;if(loose)posteriorCoat++;darkPosteriorN++;if(dark)darkPosterior++;}
    if(ny>.62&&ny<.95){anteriorN++;if(loose)anteriorCoat++;}
  }
  const strictRatio=validN?strictN/validN:0,coatRatio=validN?looseN/validN:0,darkRatio=validN?darkLike/validN:0;
  const centralRatio=centralN?centralCoat/centralN:0,middleRatio=middleN?middleCoat/middleN:0,posteriorRatio=posteriorN?posteriorCoat/posteriorN:0,anteriorRatio=anteriorN?anteriorCoat/anteriorN:0;
  const darkNeutralRatio=darkLike?darkNeutral/darkLike:0,darkCentralRatio=darkCentralN?darkCentral/darkCentralN:0,darkPosteriorRatio=darkPosteriorN?darkPosterior/darkPosteriorN:0;
  const whiteRatio=looseN?whiteLike/looseN:0,yellowRatio=looseN?yellowLike/looseN:0;
  const darkCoatingCandidate=normalizationApplied&&darkRatio>=.10&&darkNeutralRatio>=.55&&Math.max(darkCentralRatio,darkPosteriorRatio)>=.14;
  const effectiveCoatRatio=Math.max(coatRatio,darkRatio);
  const coatingThicknessCandidate=effectiveCoatRatio>.42?'dày':effectiveCoatRatio>.09?'mỏng':'rất mỏng';
  const coatingDistributionCandidate=darkCoatingCandidate&&Math.max(darkCentralRatio,darkPosteriorRatio)>=.14?'trung tâm–sau':centralRatio>=.22&&Math.max(middleRatio,posteriorRatio)>=anteriorRatio+.035?'trung tâm–sau':effectiveCoatRatio>.12?'lan tỏa':'không rõ';
  const coatingColorCandidate=darkCoatingCandidate?'xám/đen':coatRatio>=.09&&yellowRatio>=.28&&yellowRatio>whiteRatio*1.25?'vàng':coatRatio>=.07&&(whiteRatio>=.12||yellowRatio<.18)?'trắng':'';
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
  const morphologyMetrics=shapeAndToothmarkMetrics(comp.mask,w,h,box);
  const edgeColorSupport=toothmarkEdgeColorSupport(comp.mask,gray,w,h,box);
  return {
    schemaVersion:'tongue-spatial-observation-v3',
    roiCoverage:q(comp.area/(w*h)),
    bodyLuma:q(bodyLuma/255),
    bodySaturation:q(bodySaturation),
    bodyColorCandidate,
    coatingCandidateRatio:q(coatRatio),
    strictCoatingCandidateRatio:q(strictRatio),
    coatingColorCandidate,
    coatingWhiteLikeRatio:q(whiteRatio),
    coatingYellowLikeRatio:q(yellowRatio),
    darkCoatingLikeRatio:q(darkRatio),
    darkCoatingNeutralRatio:q(darkNeutralRatio),
    darkCoatingCentralRatio:q(darkCentralRatio),
    darkCoatingPosteriorRatio:q(darkPosteriorRatio),
    coatingThicknessCandidate,
    coatingDistributionCandidate,
    coatingZones:Object.freeze({central:q(centralRatio),middle:q(middleRatio),posterior:q(posteriorRatio),anterior:q(anteriorRatio)}),
    shapeMetrics:morphologyMetrics.shape,
    toothmarkMetrics:Object.freeze({...morphologyMetrics.toothmarks,edgeColorSupport}),
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
async function bottomFeaturesFromDataUrl(dataUrl){
  if(typeof dataUrl!=='string'||dataUrl.length<100||typeof createImageBitmap!=='function'||typeof OffscreenCanvas!=='function')return null;
  let bitmap=null;
  try{
    const blob=await (await fetch(dataUrl)).blob();bitmap=await createImageBitmap(blob);
    const max=192,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height)),w=Math.max(48,Math.round(bitmap.width*scale)),h=Math.max(48,Math.round(bitmap.height*scale));
    const canvas=new OffscreenCanvas(w,h),ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
    ctx.drawImage(bitmap,0,0,w,h);const px=ctx.getImageData(0,0,w,h).data,lum=new Float32Array(w*h);
    let central=0,vessel=0,darkPurple=0,lumaSum=0,rbMinusG=0,mr=0,mg=0,mb=0,mucN=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const p=y*w+x,i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b),lv=luma(r,g,b);lum[p]=lv;
      if(x<w*.15||x>w*.85||y<h*.08||y>h*.95)continue;
      central++;const purpleBlue=((hsv.h>=235&&hsv.h<=345)||(b>g*1.04&&r>g*1.04))&&hsv.s>.12;
      if(purpleBlue&&hsv.v<.72)vessel++;
      if(purpleBlue&&hsv.v<.55)darkPurple++;
      lumaSum+=lv/255;rbMinusG+=(((r+b)/2)-g)/255;
      const mucosa=r>45&&hsv.v>.18&&hsv.v<.92&&hsv.s>.06&&(r>g*.99||r>b*.95);
      if(mucosa){mr+=r/255;mg+=g/255;mb+=b/255;mucN++;}
    }
    if(!central)return null;
    let leftMuc=0,rightMuc=0,leftDark=0,rightDark=0,leftRows=0,rightRows=0,rowN=0;
    const y0=Math.max(1,Math.floor(h*.25)),y1=Math.min(h-2,Math.ceil(h*.66));
    for(let y=1;y<h-1;y++){
      let rowLeft=false,rowRight=false;
      for(let x=1;x<w-1;x++){
        if(x<=w*.22||x>=w*.78||y<=h*.20||y>=h*.70)continue;
        const p=y*w+x,i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b);
        const mucosa=r>45&&hsv.v>.18&&hsv.v<.90&&hsv.s>.08&&(r>g*1.03||r>b*1.02);
        if(!mucosa)continue;
        const left=x>w*.28&&x<w*.47,right=x>w*.53&&x<w*.72;if(!left&&!right)continue;
        const neighbor=(lum[p-1]+lum[p+1]+lum[p-w]+lum[p+w])/4;
        const darkLine=neighbor-lum[p]>5&&lum[p]<170;
        if(left){leftMuc++;if(darkLine){leftDark++;rowLeft=true;}}
        if(right){rightMuc++;if(darkLine){rightDark++;rowRight=true;}}
      }
      if(y>=y0&&y<=y1){rowN++;if(rowLeft)leftRows++;if(rowRight)rightRows++;}
    }
    const leftRatio=leftMuc?leftDark/leftMuc:0,rightRatio=rightMuc?rightDark/rightMuc:0;
    const balance=Math.max(leftRatio,rightRatio)>0?Math.min(leftRatio,rightRatio)/Math.max(leftRatio,rightRatio):0;
    const leftContinuity=rowN?leftRows/rowN:0,rightContinuity=rowN?rightRows/rowN:0;
    return Object.freeze({
      schemaVersion:'bottom-device-feature-v2',
      vesselCandidateRatio:q(vessel/central),darkPurpleRatio:q(darkPurple/central),
      meanCentralLuminance:q(lumaSum/central),redBlueMinusGreen:q(rbMinusG/central),
      leftDarkLineRatio:q(leftRatio),rightDarkLineRatio:q(rightRatio),bilateralBalance:q(balance),
      leftRowContinuity:q(leftContinuity),rightRowContinuity:q(rightContinuity),
      bilateralSignal:Math.min(leftRatio,rightRatio)>=.05&&balance>=.30&&leftContinuity>=.60&&rightContinuity>=.60,
      mucosaMeanR:q(mucN?mr/mucN:0),mucosaMeanG:q(mucN?mg/mucN:0),mucosaMeanB:q(mucN?mb/mucN:0),
      sampledPixels:central,
      policy:'direct underside structure/color features only; no absolute-size or disease inference'
    });
  }catch{return null;}finally{try{bitmap?.close?.();}catch{}}
}

function quantile(values,p){
  if(!values.length)return 0;
  const a=[...values].sort((x,y)=>x-y),pos=clamp(p,0,1)*(a.length-1),lo=Math.floor(pos),hi=Math.ceil(pos);
  if(lo===hi)return a[lo];
  return a[lo]+(a[hi]-a[lo])*(pos-lo);
}
function multiscaleToothmarkMetrics(mask,w,h,box){
  const {minX,minY,maxX,maxY,width:bw,height:bh}=box,rows=[];
  for(let y=minY;y<=maxY;y++){
    let first=-1,last=-1,count=0;
    for(let x=minX;x<=maxX;x++)if(mask[y*w+x]){if(first<0)first=x;last=x;count++;}
    if(count>=4)rows.push({y,first,last,ny:(y-minY)/Math.max(1,bh)});
  }
  if(rows.length<12)return Object.freeze({leftScore:0,rightScore:0,leftEvents:0,rightEvents:0,leftMaxDepthRatio:0,rightMaxDepthRatio:0,method:'multiscale-lateral-concavity-v1'});
  let win=Math.max(7,Math.round(bh*.14));if(!(win%2))win++;const half=win>>1;
  const leftDepth=new Array(rows.length).fill(0),rightDepth=new Array(rows.length).fill(0);
  for(let i=0;i<rows.length;i++){
    const a=Math.max(0,i-half),b=Math.min(rows.length,i+half+1),left=[],right=[];
    for(let j=a;j<b;j++){left.push(rows[j].first);right.push(rows[j].last);}
    leftDepth[i]=Math.max(0,rows[i].first-quantile(left,.15));
    rightDepth[i]=Math.max(0,quantile(right,.85)-rows[i].last);
  }
  const threshold=Math.max(1.5,bw*.015),peakThreshold=Math.max(2,bw*.020);
  const sideEvents=depth=>{
    let events=0,maxDepth=0,inRun=false,runPeak=0,runLength=0;
    const finish=()=>{if(inRun&&runLength>=2&&runPeak>=peakThreshold)events++;inRun=false;runPeak=0;runLength=0;};
    for(let i=0;i<rows.length;i++){
      const eligible=rows[i].ny>=.18&&rows[i].ny<=.82&&depth[i]>=threshold;
      if(eligible){inRun=true;runLength++;runPeak=Math.max(runPeak,depth[i]);maxDepth=Math.max(maxDepth,depth[i]);}
      else finish();
    }
    finish();
    const depthScore=clamp(maxDepth/Math.max(1,bw*.050));
    const eventScore=clamp(events/3);
    return {events,maxDepth,score:clamp(eventScore*.62+depthScore*.38)};
  };
  const left=sideEvents(leftDepth),right=sideEvents(rightDepth);
  return Object.freeze({
    leftScore:q(left.score),rightScore:q(right.score),
    leftEvents:left.events,rightEvents:right.events,
    leftMaxDepthRatio:q(left.maxDepth/Math.max(1,bw)),rightMaxDepthRatio:q(right.maxDepth/Math.max(1,bw)),
    windowRows:win,method:'multiscale-lateral-concavity-v1'
  });
}
function mouthAnchoredMorphology(px,w,h){
  const n=w*h,dark=new Uint8Array(n);
  for(let p=0;p<n;p++){
    const x=p%w,y=(p/w)|0;if(x<w*.18||x>w*.82||y<h*.20||y>h*.72)continue;
    const i=p*4,hsv=rgbToHsv(px[i],px[i+1],px[i+2]);
    if((hsv.v<.28&&hsv.s<.85)||hsv.v<.20)dark[p]=1;
  }
  const mouth=largestComponent(dark,w,h),mb=bounds(mouth.mask,w,h);
  if(!mb||mouth.area<Math.max(30,n*.002)||mb.width<w*.12||mb.height<h*.015)return null;
  const cx=(mb.minX+mb.maxX)/2,mw=mb.width,mh=mb.height;
  const skinRatios=[],coreRatios=[];
  for(let p=0;p<n;p++){
    const x=p%w,y=(p/w)|0,i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b),bg=b/Math.max(1,g);
    const skinY=y>=mb.minY+mh*.55&&y<=mb.minY+mh*2.20;
    const skinX=(x>=mb.minX-mw*.18&&x<mb.minX+mw*.03)||(x>mb.maxX-mw*.03&&x<=mb.maxX+mw*.18);
    if(skinX&&skinY&&hsv.v>.25)skinRatios.push(bg);
    const coreX=x>=cx-mw*.22&&x<=cx+mw*.22,coreY=y>=mb.minY+mh*.55&&y<=mb.minY+mh*1.90;
    if(coreX&&coreY&&hsv.v>.40)coreRatios.push(bg);
  }
  if(skinRatios.length<16||coreRatios.length<16)return null;
  const skinRatio=median(skinRatios),coreRatio=median(coreRatios);
  if(coreRatio<=skinRatio+.035)return null;
  const bgThreshold=skinRatio+(coreRatio-skinRatio)*.62,candidate=new Uint8Array(n);
  const x0=Math.max(0,Math.floor(mb.minX-mw*.10)),x1=Math.min(w-1,Math.ceil(mb.maxX+mw*.10));
  const y0=Math.max(0,Math.floor(mb.minY+mh*.38)),y1=Math.min(h-1,Math.ceil(mb.minY+mh*2.45));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const p=y*w+x,i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b),bg=b/Math.max(1,g);
    if(hsv.v>.32&&r>65&&bg>bgThreshold&&r>=g*.95)candidate[p]=1;
  }
  const tongue=largestComponent(candidate,w,h),box=bounds(tongue.mask,w,h);
  if(!box||tongue.area<Math.max(80,n*.004)||box.width<w*.15||box.height<h*.08)return null;
  const base=shapeAndToothmarkMetrics(tongue.mask,w,h,box),gray=new Float32Array(n);
  for(let p=0;p<n;p++){const i=p*4;gray[p]=luma(px[i],px[i+1],px[i+2]);}
  const multi=multiscaleToothmarkMetrics(tongue.mask,w,h,box);
  const color=toothmarkEdgeColorSupport(tongue.mask,gray,w,h,box);
  const leftScore=clamp(multi.leftScore*.72+color.leftScore*.28);
  const rightScore=clamp(multi.rightScore*.72+color.rightScore*.28);
  const bilateral=Math.min(leftScore,rightScore);
  const score=clamp(((leftScore+rightScore)/2)*.72+bilateral*.28);
  return Object.freeze({
    shapeMetrics:Object.freeze({...base.shape,method:'mouth-anchored-multi-profile-geometry-v1'}),
    toothmarkMetrics:Object.freeze({
      score:q(score),leftScore:q(leftScore),rightScore:q(rightScore),bilateralScore:q(bilateral),
      leftEvents:multi.leftEvents,rightEvents:multi.rightEvents,
      leftMaxDepthRatio:multi.leftMaxDepthRatio,rightMaxDepthRatio:multi.rightMaxDepthRatio,
      edgeColorSupport:color,
      method:'mouth-anchored-multiscale-concavity-v1'
    }),
    roi:Object.freeze({
      method:'dark-oral-aperture-anchor-plus-adaptive-blue-green-separation-v1',
      mouthWidthRatio:q(mb.width/w),tongueWidthRatio:q(box.width/w),tongueHeightRatio:q(box.height/h),
      skinBlueGreenRatio:q(skinRatio),coreBlueGreenRatio:q(coreRatio),blueGreenThreshold:q(bgThreshold),
      sourceResolution:Object.freeze({width:w,height:h})
    })
  });
}
function highResolutionMorphologyFromBitmap(bitmap){
  if(!bitmap||typeof OffscreenCanvas!=='function')return null;
  const max=448,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const w=Math.max(96,Math.round(bitmap.width*scale)),h=Math.max(96,Math.round(bitmap.height*scale));
  const canvas=new OffscreenCanvas(w,h),ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
  ctx.drawImage(bitmap,0,0,w,h);
  const px=ctx.getImageData(0,0,w,h).data;
  return mouthAnchoredMorphology(px,w,h);
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
    const spatialBase=spatialObservation(px,w,h);
    const morphologyHighRes=highResolutionMorphologyFromBitmap(bitmap);
    const spatial=spatialBase&&morphologyHighRes?{...spatialBase,shapeMetrics:morphologyHighRes.shapeMetrics,toothmarkMetrics:morphologyHighRes.toothmarkMetrics,morphologyRoi:morphologyHighRes.roi}:spatialBase;
    return {
      r:q(sr/den),g:q(sg/den),b:q(sb/den),s:q(ss/den),v:q(sv/den),
      purple:q(purple/den),white:q(white/den),yellow:q(yellow/den),dark:q(dark/den),spot:q(spot/den),
      aspect:q(bw/bh),coverage:q(comp.area/n),segmentationMode,spatial
    };
  }catch{return null;}finally{try{bitmap?.close?.();}catch{}}
}
scope.AITCAcademicVision=Object.freeze({source:SOURCE,signatureFromDataUrl,bottomFeaturesFromDataUrl});
})(self);