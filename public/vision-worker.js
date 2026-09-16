'use strict';
const clamp01=v=>Math.max(0,Math.min(1,v));
function rgbToHsv(r,g,b){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;if(d){if(max===r)h=60*((g-b)/d%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4);}if(h<0)h+=360;return{h,s:max?d/max:0,v:max};}
async function inspect(dataUrl,view){
  if(typeof createImageBitmap!=='function'||typeof OffscreenCanvas!=='function')return{supported:false};
  const blob=await (await fetch(dataUrl)).blob();
  const bitmap=await createImageBitmap(blob);
  const maxSide=160,scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
  const w=Math.max(48,Math.round(bitmap.width*scale)),h=Math.max(48,Math.round(bitmap.height*scale));
  const canvas=new OffscreenCanvas(w,h),ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw new Error('WORKER_CANVAS_UNAVAILABLE');
  ctx.drawImage(bitmap,0,0,w,h);bitmap.close?.();
  const px=ctx.getImageData(0,0,w,h).data;
  let count=0,sumV=0,sumS=0,red=0,purple=0,yellow=0,white=0,glare=0,dark=0;
  const x0=Math.floor(w*.08),x1=Math.ceil(w*.92),y0=Math.floor(h*.06),y1=Math.ceil(h*.96);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const i=(y*w+x)*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b);count++;sumV+=hsv.v;sumS+=hsv.s;
    const redBias=r-(g+b)/2;
    if((hsv.h<=58||hsv.h>=300)&&hsv.s>.08&&hsv.v>.2&&redBias>3)red++;
    if(((hsv.h>=285&&hsv.h<=345)||(b>g*1.04&&r>g*1.04))&&hsv.s>.16)purple++;
    if(hsv.h>=32&&hsv.h<=70&&hsv.s>.18&&hsv.v>.45)yellow++;
    if(hsv.v>.66&&hsv.s<.27)white++;
    if(hsv.v>.90&&hsv.s<.16)glare++;
    if(hsv.v<.14)dark++;
  }
  const d=Math.max(1,count);
  return{supported:true,view,width:w,height:h,meanBrightness:Number((sumV/d).toFixed(4)),meanSaturation:Number((sumS/d).toFixed(4)),redRatio:Number(clamp01(red/d).toFixed(4)),purpleRatio:Number(clamp01(purple/d).toFixed(4)),yellowRatio:Number(clamp01(yellow/d).toFixed(4)),whiteRatio:Number(clamp01(white/d).toFixed(4)),glareRatio:Number(clamp01(glare/d).toFixed(4)),darkRatio:Number(clamp01(dark/d).toFixed(4)),version:'vision-worker-v1'};
}
self.onmessage=async event=>{
  const {id,dataUrl,view='top'}=event.data||{};
  if(!id||!dataUrl)return;
  try{self.postMessage({id,ok:true,result:await inspect(dataUrl,view)});}catch(error){self.postMessage({id,ok:false,error:String(error?.message||error)});}
};