import {matchAtlas,coarse} from './academic-signature.js';
import {GROUND_TRUTH_PROFILE,classifyGlobalContext} from './ground-truth-profile.js';
import './academic-vision.js';

const VERSION='device-analysis-worker-v4';
const GROUND_TRUTH=GROUND_TRUTH_PROFILE;

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
function base64Payload(dataUrl){
  const text=String(dataUrl||'');
  return text.includes(',')?text.slice(text.indexOf(',')+1):text;
}
function rgbToHsv(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0;
  if(d){if(max===r)h=60*((g-b)/d%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4);}
  if(h<0)h+=360;
  return {h,s:max?d/max:0,v:max};
}
function q(v,n=4){return Number(Number(v||0).toFixed(n));}
async function inspectPixels(dataUrl,role){
  if(typeof createImageBitmap!=='function'||typeof OffscreenCanvas==='undefined')return {globalFeatures:null,bottomFeatures:null};
  let bitmap=null;
  try{
    const blob=await (await fetch(dataUrl)).blob();
    bitmap=await createImageBitmap(blob);
    const maxSide=160,scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
    const w=Math.max(40,Math.round(bitmap.width*scale)),h=Math.max(40,Math.round(bitmap.height*scale));
    const canvas=new OffscreenCanvas(w,h),ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)return {globalFeatures:null,bottomFeatures:null};
    ctx.drawImage(bitmap,0,0,w,h);
    const px=ctx.getImageData(0,0,w,h).data,lumaMap=new Float32Array(w*h);
    let sr=0,sg=0,sb=0,ss=0,sv=0,n=0;
    let central=0,vesselCandidates=0,darkPurple=0,lumaSum=0,rbMinusG=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const p=y*w+x,i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b),luma=.299*r+.587*g+.114*b;
      lumaMap[p]=luma;
      sr+=r/255;sg+=g/255;sb+=b/255;ss+=hsv.s;sv+=hsv.v;n++;
      if(role!=='bottom'||x<w*.15||x>w*.85||y<h*.08||y>h*.95)continue;
      central++;
      const purpleBlue=((hsv.h>=235&&hsv.h<=345)||(b>g*1.04&&r>g*1.04))&&hsv.s>.12;
      if(purpleBlue&&hsv.v<.72)vesselCandidates++;
      if(purpleBlue&&hsv.v<.55)darkPurple++;
      lumaSum+=luma/255;
      rbMinusG+=(((r+b)/2)-g)/255;
    }
    const globalFeatures=n?[q(sr/n),q(sg/n),q(sb/n),q(ss/n),q(sv/n)]:null;
    let bottomFeatures=null;
    if(role==='bottom'&&central){
      let leftMuc=0,rightMuc=0,leftDark=0,rightDark=0,leftRows=0,rightRows=0,rowN=0;
      let vesselColorN=0,vesselR=0,vesselG=0,vesselB=0,vesselSat=0,vesselVal=0,bluePurpleVotes=0,redPurpleVotes=0,darkPurpleVotes=0,vesselChromaDelta=0;
      const y0=Math.max(1,Math.floor(h*.25)),y1=Math.min(h-2,Math.ceil(h*.66));
      for(let y=1;y<h-1;y++){
        let rowLeft=false,rowRight=false;
        for(let x=1;x<w-1;x++){
          if(x<=w*.22||x>=w*.78||y<=h*.20||y>=h*.70)continue;
          const p=y*w+x,i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b);
          const mucosa=r>45&&hsv.v>.18&&hsv.v<.90&&hsv.s>.08&&(r>g*1.03||r>b*1.02);
          if(!mucosa)continue;
          const left=x>w*.28&&x<w*.47,right=x>w*.53&&x<w*.72;
          if(!left&&!right)continue;
          const neighbor=(lumaMap[p-1]+lumaMap[p+1]+lumaMap[p-w]+lumaMap[p+w])/4;
          const darkLine=neighbor-lumaMap[p]>5&&lumaMap[p]<170;
          if(darkLine){
            const purpleLike=((hsv.h>=235&&hsv.h<=350)||(r>g*1.015&&b>g*1.015))&&hsv.s>.10;
            if(purpleLike){
              vesselColorN++;vesselR+=r/255;vesselG+=g/255;vesselB+=b/255;vesselSat+=hsv.s;vesselVal+=hsv.v;
              const bgChroma=(((px[(p-1)*4]+px[(p+1)*4]+px[(p-w)*4]+px[(p+w)*4])/4)+((px[(p-1)*4+2]+px[(p+1)*4+2]+px[(p-w)*4+2]+px[(p+w)*4+2])/4))/2
                -((px[(p-1)*4+1]+px[(p+1)*4+1]+px[(p-w)*4+1]+px[(p+w)*4+1])/4);
              vesselChromaDelta+=Math.max(0,((((r+b)/2)-g)-bgChroma)/255);
              if(b>r*1.035)bluePurpleVotes++;
              else if(r>b*1.035)redPurpleVotes++;
              if(hsv.v<.50)darkPurpleVotes++;
            }
          }
          if(left){leftMuc++;if(darkLine){leftDark++;rowLeft=true;}}
          if(right){rightMuc++;if(darkLine){rightDark++;rowRight=true;}}
        }
        if(y>=y0&&y<=y1){rowN++;if(rowLeft)leftRows++;if(rowRight)rightRows++;}
      }
      const leftRatio=leftMuc?leftDark/leftMuc:0,rightRatio=rightMuc?rightDark/rightMuc:0;
      const bilateralBalance=Math.max(leftRatio,rightRatio)>0?Math.min(leftRatio,rightRatio)/Math.max(leftRatio,rightRatio):0;
      const leftRowContinuity=rowN?leftRows/rowN:0,rightRowContinuity=rowN?rightRows/rowN:0;
      const bilateralSignal=Math.min(leftRatio,rightRatio)>=.05&&bilateralBalance>=.30&&leftRowContinuity>=.60&&rightRowContinuity>=.60;
      bottomFeatures={
        schemaVersion:'bottom-device-feature-v3',
        vesselCandidateRatio:q(vesselCandidates/central),
        darkPurpleRatio:q(darkPurple/central),
        meanCentralLuminance:q(lumaSum/central),
        redBlueMinusGreen:q(rbMinusG/central),
        leftDarkLineRatio:q(leftRatio),
        rightDarkLineRatio:q(rightRatio),
        bilateralBalance:q(bilateralBalance),
        leftRowContinuity:q(leftRowContinuity),
        rightRowContinuity:q(rightRowContinuity),
        bilateralSignal,
        vesselColorSamplePixels:vesselColorN,
        vesselMeanR:q(vesselColorN?vesselR/vesselColorN:0),
        vesselMeanG:q(vesselColorN?vesselG/vesselColorN:0),
        vesselMeanB:q(vesselColorN?vesselB/vesselColorN:0),
        vesselMeanSaturation:q(vesselColorN?vesselSat/vesselColorN:0),
        vesselMeanValue:q(vesselColorN?vesselVal/vesselColorN:0),
        vesselBluePurpleRatio:q(vesselColorN?bluePurpleVotes/vesselColorN:0),
        vesselRedPurpleRatio:q(vesselColorN?redPurpleVotes/vesselColorN:0),
        vesselDarkPurpleRatio:q(vesselColorN?darkPurpleVotes/vesselColorN:0),
        vesselVsMucosaChromaDelta:q(vesselColorN?vesselChromaDelta/vesselColorN:0),
        sampledPixels:central,
        policy:'role-specific direct visual features only; color is relative observed chroma on verified vessel-like dark lines, not venous diagnosis, dilation, tortuosity or stasis; engineering candidate thresholds only'
      };
    }
    return {globalFeatures,bottomFeatures};
  }catch{return {globalFeatures:null,bottomFeatures:null};}
  finally{try{bitmap?.close?.();}catch{}}
}
async function analyze(dataUrl,role,tier){
  if(typeof dataUrl!=='string'||dataUrl.length<100)throw new Error('DEVICE_IMAGE_REQUIRED');
  const started=performance.now();
  const normalizedRole=role==='bottom'?'bottom':'top';
  const signature=await self.AITCAcademicVision?.signatureFromDataUrl?.(dataUrl);
  const pixel=await inspectPixels(dataUrl,normalizedRole);
  const matches=signature?matchAtlas(signature).map(compactMatch):[];
  const coarseVisual=signature?coarse(signature):null;
  const imageDigest=await digestText(base64Payload(dataUrl));
  const groundTruthContext=normalizedRole==='top'&&pixel.globalFeatures?classifyGlobalContext(pixel.globalFeatures):{available:false};
  return {
    workerVersion:VERSION,
    role:normalizedRole,
    tier:String(tier||'unknown'),
    signature:signature||null,
    globalFeatures:pixel.globalFeatures,
    coarseVisual,
    matches,
    groundTruthContext,
    bottomFeatures:pixel.bottomFeatures,
    imageDigest,
    groundTruth:GROUND_TRUTH,
    trainingVectorCoverage:GROUND_TRUTH.trainingVectorCoverage,
    diagnosticSignatureCoverage:GROUND_TRUTH.diagnosticSignatureCoverage,
    elapsedMs:Math.round(performance.now()-started)
  };
}

self.onmessage=async(event)=>{
  const {id,dataUrl,role,tier}=event.data||{};
  try{self.postMessage({id,ok:true,result:await analyze(dataUrl,role,tier)});}
  catch(error){self.postMessage({id,ok:false,error:String(error?.message||error||'DEVICE_WORKER_FAILED')});}
};
