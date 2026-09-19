export const SHADOW_PREPROCESS_VERSION='shadow-preprocess-v3';

function clamp(value,min,max){return Math.max(min,Math.min(max,Number(value)));}
function finite(value){const n=Number(value);return Number.isFinite(n)?n:null;}

export function boundedChannelGains(reference={},options={}){
  const minSamples=Math.max(1,Math.floor(Number(options.minSamples)||64));
  const limit=Math.max(0,Math.min(.35,Number(options.limit)||.20));
  const sampleCount=Math.max(0,Math.floor(Number(reference.sampleCount)||0));
  const r=finite(reference.r),g=finite(reference.g),b=finite(reference.b);
  const base=Object.freeze({r:1,g:1,b:1});
  if(sampleCount<minSamples)return Object.freeze({
    version:SHADOW_PREPROCESS_VERSION,applied:false,reason:'insufficient-neutral-reference',
    sampleCount,gains:base,maxGainDeviation:0,authority:false,inputMutation:false
  });
  if(r===null||g===null||b===null||r<=0||g<=0||b<=0)return Object.freeze({
    version:SHADOW_PREPROCESS_VERSION,applied:false,reason:'invalid-neutral-reference',
    sampleCount,gains:base,maxGainDeviation:0,authority:false,inputMutation:false
  });
  const target=(r+g+b)/3;
  const gains={
    r:clamp(target/r,1-limit,1+limit),
    g:clamp(target/g,1-limit,1+limit),
    b:clamp(target/b,1-limit,1+limit)
  };
  const maxGainDeviation=Math.max(Math.abs(gains.r-1),Math.abs(gains.g-1),Math.abs(gains.b-1));
  return Object.freeze({
    version:SHADOW_PREPROCESS_VERSION,
    applied:maxGainDeviation>=.01,
    reason:maxGainDeviation>=.01?'bounded-neutral-reference':'reference-already-balanced',
    sampleCount,
    gains:Object.freeze({
      r:Number(gains.r.toFixed(6)),
      g:Number(gains.g.toFixed(6)),
      b:Number(gains.b.toFixed(6))
    }),
    maxGainDeviation:Number(maxGainDeviation.toFixed(6)),
    authority:false,
    inputMutation:false
  });
}

export function normalizeRgb(r,g,b,gains={}){
  const rr=clamp((finite(r)??0)*(finite(gains.r)??1),0,255);
  const gg=clamp((finite(g)??0)*(finite(gains.g)??1),0,255);
  const bb=clamp((finite(b)??0)*(finite(gains.b)??1),0,255);
  return Object.freeze({r:Math.round(rr),g:Math.round(gg),b:Math.round(bb)});
}

export function mapNormalizedGeometry(geometry,w,h,pad=.06){
  const width=Math.max(1,Math.floor(Number(w)||0)),height=Math.max(1,Math.floor(Number(h)||0));
  if(!geometry||width<2||height<2)return null;
  const x0=finite(geometry.x0),y0=finite(geometry.y0),x1=finite(geometry.x1),y1=finite(geometry.y1);
  if([x0,y0,x1,y1].some(v=>v===null)||x1<=x0||y1<=y0)return null;
  const p=Math.max(0,Math.min(.2,Number(pad)||0));
  const minX=Math.max(0,Math.floor((Math.max(0,x0)-p)*width));
  const minY=Math.max(0,Math.floor((Math.max(0,y0)-p)*height));
  const maxX=Math.min(width-1,Math.ceil((Math.min(1,x1)+p)*width)-1);
  const maxY=Math.min(height-1,Math.ceil((Math.min(1,y1)+p)*height)-1);
  if(maxX<=minX||maxY<=minY)return null;
  return Object.freeze({minX,minY,maxX,maxY,width:maxX-minX+1,height:maxY-minY+1});
}

// The bootstrap pixel model can include face/neck; edge-touching boxes cannot
// support independent tongue morphology. Abstain instead of grading those pixels.
export function shadowRoiStatus(geometry){
  if(!geometry)return 'missing-model-roi';
  const values=['x0','y0','x1','y1'].map(k=>geometry[k]);
  if(!values.every(v=>typeof v==='number'&&Number.isFinite(v)))return 'invalid-model-roi';
  const [x0,y0,x1,y1]=values;
  if(x0<0||y0<0||x1>1||y1>1||x1<=x0||y1<=y0)return 'invalid-model-roi';
  if(geometry.touchesFrame===true||x0===0||y0===0||x1===1||y1===1)return 'model-roi-touches-frame';
  return 'usable-candidate-roi';
}
