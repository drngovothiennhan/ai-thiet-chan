(function(scope){
'use strict';
const SOURCE=Object.freeze({id:'KNOWLEDGE-5DOC',sourceCount:5,indexedPages:1157,indexedImageOccurrences:1027,pageVisualSignatures:298,imageVisualSignatures:298,knowledgeVersion:'thiet-chan-kb-2026-09-15.5doc',noSilentOmission:true});
function rgbToHsv(r,g,b){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;if(d){if(max===r)h=60*((g-b)/d%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4);}if(h<0)h+=360;return {h,s:max?d/max:0,v:max};}
function largestComponent(mask,w,h){const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);let best=[];for(let seed=0;seed<mask.length;seed++){if(!mask[seed]||seen[seed])continue;let head=0,tail=0;queue[tail++]=seed;seen[seed]=1;const cells=[];while(head<tail){const p=queue[head++];cells.push(p);const x=p%w,y=(p/w)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const np=ny*w+nx;if(mask[np]&&!seen[np]){seen[np]=1;queue[tail++]=np;}}}if(cells.length>best.length)best=cells;}const out=new Uint8Array(mask.length);for(const p of best)out[p]=1;return {mask:out,area:best.length};}
async function signatureFromDataUrl(dataUrl){
  if(typeof dataUrl!=='string'||dataUrl.length<100||typeof createImageBitmap!=='function'||typeof OffscreenCanvas!=='function')return null;
  let bitmap=null;
  try{
    const blob=await (await fetch(dataUrl)).blob();bitmap=await createImageBitmap(blob);
    const max=192,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height)),w=Math.max(48,Math.round(bitmap.width*scale)),h=Math.max(48,Math.round(bitmap.height*scale));
    const canvas=new OffscreenCanvas(w,h),ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;ctx.drawImage(bitmap,0,0,w,h);
    const px=ctx.getImageData(0,0,w,h).data,n=w*h,mask=new Uint8Array(n);
    for(let p=0;p<n;p++){const x=p%w,y=(p/w)|0;if(x<w*.08||x>w*.92||y<h*.05||y>h*.97)continue;const i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b),redBias=r-(g+b)/2;if(r>55&&hsv.v>.20&&hsv.s>.08&&(hsv.h<=58||hsv.h>=300)&&redBias>3)mask[p]=1;}
    const comp=largestComponent(mask,w,h);if(comp.area<Math.max(120,n*.018))return null;
    let minX=w,minY=h,maxX=0,maxY=0;for(let p=0;p<n;p++)if(comp.mask[p]){const x=p%w,y=(p/w)|0;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    const bw=Math.max(1,maxX-minX+1),bh=Math.max(1,maxY-minY+1),cx=(minX+maxX)/2,cy=(minY+maxY)/2;let den=0,sr=0,sg=0,sb=0,ss=0,sv=0,purple=0,white=0,yellow=0,dark=0,spot=0;
    const gray=p=>{const i=p*4;return .299*px[i]+.587*px[i+1]+.114*px[i+2];};
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const nx=(x-cx)/(bw*.52),ny=(y-cy)/(bh*.52);if(nx*nx+ny*ny>1)continue;const p=y*w+x,i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b);if(!(comp.mask[p]||((r>g*.98&&r>b*.86)&&hsv.v>.22)))continue;den++;sr+=r/255;sg+=g/255;sb+=b/255;ss+=hsv.s;sv+=hsv.v;const isPurple=((hsv.h>=285&&hsv.h<=345)||(b>g*1.04&&r>g*1.04))&&hsv.s>.16;if(isPurple)purple++;if(hsv.v>.66&&hsv.s<.27)white++;if(hsv.h>=32&&hsv.h<=70&&hsv.s>.18&&hsv.v>.45)yellow++;if((hsv.h<15||hsv.h>345)&&hsv.s>.52&&hsv.v>.38)spot++;if(x>minX+1&&x<maxX-1&&y>minY+1&&y<maxY-1){const g0=gray(p),neigh=(gray(p-1)+gray(p+1)+gray(p-w)+gray(p+w))/4;if(g0<neigh-24&&g0<135)dark++;}}
    if(den<50)return null;const q=v=>Number(v.toFixed(4));return {r:q(sr/den),g:q(sg/den),b:q(sb/den),s:q(ss/den),v:q(sv/den),purple:q(purple/den),white:q(white/den),yellow:q(yellow/den),dark:q(dark/den),spot:q(spot/den),aspect:q(bw/bh),coverage:q(comp.area/n)};
  }catch{return null;}finally{try{bitmap?.close?.();}catch{}}
}
scope.AITCAcademicVision=Object.freeze({source:SOURCE,signatureFromDataUrl});
})(self);