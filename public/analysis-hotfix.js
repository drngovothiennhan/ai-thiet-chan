(()=>{
'use strict';
const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');
const priorFetch=(input,init)=>requestClient.fetchAfter('analysis-hotfix',input,init);
const FALLBACK_DEADLINE_MS=8_500;
const FALLBACK_CONFIDENCE_CAP=.62;
let clickStartedAt=null;
let lastMetrics=null;

const now=()=>performance?.now?.()??Date.now();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const clamp=(v,max=1)=>{const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(max,n)):0;};
function deviceClass(){const ua=navigator.userAgent||'';if(/Android/i.test(ua))return'android';if(/iPhone|iPad|iPod/i.test(ua))return'ios';if(/Windows/i.test(ua))return'windows';if(/Macintosh|Mac OS X/i.test(ua))return'macos';if(/Linux/i.test(ua))return'linux';return'other';}
function rgbToHsv(r,g,b){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;if(d){if(max===r)h=60*((g-b)/d%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4);}if(h<0)h+=360;return{h,s:max?d/max:0,v:max};}
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
function largestComponent(mask,w,h){const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);let best=[];for(let seed=0;seed<mask.length;seed++){if(!mask[seed]||seen[seed])continue;let head=0,tail=0;queue[tail++]=seed;seen[seed]=1;const cells=[];while(head<tail){const p=queue[head++];cells.push(p);const x=p%w,y=(p/w)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const np=ny*w+nx;if(mask[np]&&!seen[np]){seen[np]=1;queue[tail++]=np;}}}if(cells.length>best.length)best=cells;}const out=new Uint8Array(mask.length);for(const p of best)out[p]=1;return{mask:out,area:best.length};}
function mean(values){return values.length?values.reduce((a,b)=>a+b,0)/values.length:0;}
function qcConfidence(qc,coverage){const base=qc?.grade==='good'?.60:qc?.grade==='fair'?.54:.40;const bonus=coverage>=.10&&coverage<=.50?.02:coverage>=.05?.01:-.05;return Math.max(.30,Math.min(FALLBACK_CONFIDENCE_CAP,Number((base+bonus).toFixed(3))));}
function colorReliability(qc){return qc?.grade==='good'?'good':qc?.grade==='fair'?'fair':'poor';}
function signal(label,evidence,rule,confidence){return{label,evidence,rule,confidence:clamp(confidence,FALLBACK_CONFIDENCE_CAP)};}

async function inspectView(dataUrl,qc,view='top'){
  const started=now();
  const img=await loadImage(dataUrl);
  const maxSide=192,scale=Math.min(1,maxSide/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
  const w=Math.max(48,Math.round((img.naturalWidth||img.width)*scale)),h=Math.max(48,Math.round((img.naturalHeight||img.height)*scale));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('LOCAL_CANVAS_UNAVAILABLE');ctx.drawImage(img,0,0,w,h);
  const px=ctx.getImageData(0,0,w,h).data,n=w*h,mask=new Uint8Array(n);
  for(let p=0;p<n;p++){const x=p%w,y=(p/w)|0;if(x<w*.08||x>w*.92||y<h*.05||y>h*.97)continue;const i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b),redBias=r-(g+b)/2;if(r>55&&hsv.v>.20&&hsv.s>.08&&(hsv.h<=58||hsv.h>=300)&&redBias>3)mask[p]=1;}
  const comp=largestComponent(mask,w,h),coverage=comp.area/n;
  if(comp.area<Math.max(120,n*.018))return{visible:false,coverage,confidence:.25,reason:'Không tách được vùng lưỡi đủ rõ từ ảnh hiện tại.',elapsedMs:Math.round(now()-started)};
  let minX=w,minY=h,maxX=0,maxY=0;const rs=[],gs=[],bs=[],ss=[],vs=[];
  for(let p=0;p<n;p++)if(comp.mask[p]){const x=p%w,y=(p/w)|0;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);const i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b);rs.push(r);gs.push(g);bs.push(b);ss.push(hsv.s);vs.push(hsv.v);}
  const bw=Math.max(1,maxX-minX+1),bh=Math.max(1,maxY-minY+1),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  const meanR=mean(rs),meanG=mean(gs),meanB=mean(bs),meanS=mean(ss),meanV=mean(vs);
  let purple=0,stasis=0,central=0,whiteCoat=0,yellowCoat=0,glare=0,darkLines=0,redSpots=0,vessel=0;
  const gray=p=>{const i=p*4;return .299*px[i]+.587*px[i+1]+.114*px[i+2];};
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const nx=(x-cx)/(bw*.52),ny=(y-cy)/(bh*.52);if(nx*nx+ny*ny>1)continue;const p=y*w+x,i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b);const bodyLike=comp.mask[p]||((r>g*.98&&r>b*.86)&&hsv.v>.22);if(!bodyLike)continue;central++;const isPurple=((hsv.h>=285&&hsv.h<=345)||(b>g*1.04&&r>g*1.04))&&hsv.s>.16;if(isPurple)purple++;if(isPurple&&hsv.v<.58)stasis++;if(hsv.v>.66&&hsv.s<.27)whiteCoat++;if(hsv.h>=32&&hsv.h<=70&&hsv.s>.18&&hsv.v>.45)yellowCoat++;if(hsv.v>.90&&hsv.s<.16)glare++;if((hsv.h<12||hsv.h>348)&&hsv.s>.52&&hsv.v>.38)redSpots++;if(view==='bottom'&&isPurple&&hsv.v<.68)vessel++;if(x>minX+1&&x<maxX-1&&y>minY+1&&y<maxY-1){const g0=gray(p),neigh=(gray(p-1)+gray(p+1)+gray(p-w)+gray(p+w))/4;if(g0<neigh-24&&g0<135)darkLines++;}}
  const denom=Math.max(1,central),purpleRatio=purple/denom,stasisRatio=stasis/denom,whiteRatio=whiteCoat/denom,yellowRatio=yellowCoat/denom,glareRatio=glare/denom,darkRatio=darkLines/denom,spotRatio=redSpots/denom,vesselRatio=vessel/denom;
  const clipped=minX<=w*.09||maxX>=w*.91||minY<=h*.055||maxY>=h*.965,wholeVisible=!clipped&&bw>w*.22&&bh>h*.28,rootVisible=minY<h*.35&&!clipped,bboxRatio=bw/bh,confidence=qcConfidence(qc,coverage);
  let tongueColor='Đỏ nhạt/hồng';if(purpleRatio>.13||stasisRatio>.07)tongueColor='Tím/ám tím';else if(meanV<.53&&meanR>meanG*1.12)tongueColor='Đỏ sẫm';else if(meanR>meanG*1.25&&meanS>.34)tongueColor='Đỏ';else if(meanS<.20&&meanV>.60)tongueColor='Nhợt/nhạt';
  const coatingColor=yellowRatio>.075&&yellowRatio>whiteRatio*.55?'Vàng':whiteRatio>.10?'Trắng':'Không thấy màu rêu nổi bật';
  const coatRatio=Math.max(whiteRatio,yellowRatio),coatingThickness=coatRatio>.34?'Dày':coatRatio>.15?'Mỏng':'Rất mỏng/khó tách';
  const coatingTexture=coatRatio>.22&&glareRatio>.025?'Khá nhuận/ẩm':coatRatio>.22?'Tương đối đồng nhất':'Khó đánh giá chắc';
  const moisture=glareRatio>.035?'Nhuận/ẩm':glareRatio<.008&&qc?.checks?.light?'Thiên khô tương đối':'Trung bình/khó xác định';
  const shape=bboxRatio>.88?'Khá rộng/bệu':bboxRatio<.52?'Khá thon':'Trung bình';
  const fissures=darkRatio>.045?'Có rãnh/nứt nhìn thấy':darkRatio>.020?'Có thể có rãnh nứt nhẹ':'Không thấy nứt nổi bật';
  const toothmarks=(bboxRatio>.78&&coverage>.10&&darkRatio>.028)?'Bờ lưỡi không đều, cần đối chiếu dấu răng':'Chưa thấy dấu răng nổi bật';
  const pricklesSpots=spotRatio>.055?'Có điểm đỏ/gai nổi bật':spotRatio>.025?'Có một số điểm đỏ':'Không thấy nổi bật';
  const stasisMarks=stasisRatio>.055?'Có vùng tím/sẫm cần đối chiếu':'Không thấy ban/điểm ứ nổi bật';
  return{visible:true,coverage,confidence,quality:qc?.grade||'fair',wholeVisible,rootVisible,colorReliability:colorReliability(qc),tongueColor,shape,coatingColor,coatingThickness,coatingTexture,moisture,fissures,toothmarks,pricklesSpots,stasisMarks,purpleRatio,vesselRatio,meanR,meanG,meanB,undersideColor:tongueColor,elapsedMs:Math.round(now()-started)};
}

function topAssessment(v,qc){
  if(!v.visible)return{quality:'poor',visualValidity:{tongueVisible:false,wholeTongueVisible:false,rootVisible:false,framing:'poor',occlusion:'major',colorReliability:'poor'},tongueColor:'Không xác định',shape:'Không xác định',coatingColor:'Không xác định',coatingThickness:'Không xác định',coatingTexture:'Không xác định',moisture:'Không xác định',fissures:'Không xác định',toothmarks:'Không xác định',pricklesSpots:'Không xác định',stasisMarks:'Không xác định',otherVisibleFeatures:[],theoryAssessment:{generalSignals:[],stomachPatternSignals:[],cannotConclude:[v.reason]},confidence:.25,summary:v.reason,limitations:[v.reason]};
  const signals=[];
  if(/Đỏ/.test(v.tongueColor)&&v.coatingColor==='Vàng')signals.push(signal('Tín hiệu nhiệt',`Chất lưỡi ${v.tongueColor.toLowerCase()}, rêu ${v.coatingColor.toLowerCase()} ${v.coatingThickness.toLowerCase()}.`,'Đối chiếu tri thức đã nạp: lưỡi đỏ phối hợp rêu vàng thiên về tín hiệu nhiệt; vẫn cần Tứ chẩn.',Math.min(.60,v.confidence)));
  if(/Nhợt/.test(v.tongueColor)&&v.coatingColor==='Trắng')signals.push(signal('Tín hiệu hư/hàn',`Chất lưỡi ${v.tongueColor.toLowerCase()}, rêu trắng, độ ẩm ${v.moisture.toLowerCase()}.`,'Đối chiếu tri thức đã nạp: chất lưỡi nhạt phối hợp rêu trắng/ẩm có thể thiên hư-hàn trong bối cảnh phù hợp.',Math.min(.58,v.confidence)));
  if(v.coatingThickness==='Dày')signals.push(signal('Tín hiệu thấp/đàm hoặc tích trệ',`Rêu ${v.coatingThickness.toLowerCase()} và ${v.coatingTexture.toLowerCase()}.`,'Rêu dày cần đối chiếu thêm triệu chứng và mạch; không kết luận từ ảnh đơn độc.',Math.min(.56,v.confidence)));
  if(/Tím/.test(v.tongueColor)||/tím/.test(v.stasisMarks))signals.push(signal('Tín hiệu ứ trệ cần đối chiếu',`Màu chất lưỡi ${v.tongueColor.toLowerCase()}${/tím/.test(v.stasisMarks)?', có vùng tím/sẫm':''}.`,'Màu tím/ám tím là tín hiệu cần đối chiếu khí huyết vận hành và các dữ kiện khác.',Math.min(.58,v.confidence)));
  const limitations=[];if(qc?.grade==='poor')limitations.push('Ảnh có chất lượng thấp nên chỉ mô tả các dấu nổi bật.');if(!v.wholeVisible)limitations.push('Chưa chắc toàn bộ lưỡi nằm trọn trong khung.');if(!v.rootVisible)limitations.push('Phần sau/gốc lưỡi chưa được bộc lộ rõ.');
  const summary=`Quan sát local CV: chất lưỡi ${v.tongueColor.toLowerCase()}, hình thể ${v.shape.toLowerCase()}, rêu ${v.coatingColor.toLowerCase()} ${v.coatingThickness.toLowerCase()}, độ ẩm ${v.moisture.toLowerCase()}.`;
  return{quality:v.quality,visualValidity:{tongueVisible:true,wholeTongueVisible:v.wholeVisible,rootVisible:v.rootVisible,framing:v.wholeVisible?'good':'fair',occlusion:v.wholeVisible?'none':'partial',colorReliability:v.colorReliability},tongueColor:v.tongueColor,shape:v.shape,coatingColor:v.coatingColor,coatingThickness:v.coatingThickness,coatingTexture:v.coatingTexture,moisture:v.moisture,fissures:v.fissures,toothmarks:v.toothmarks,pricklesSpots:v.pricklesSpots,stasisMarks:v.stasisMarks,otherVisibleFeatures:[],theoryAssessment:{generalSignals:signals,stomachPatternSignals:[],cannotConclude:['Chưa có Vấn chẩn và mạch chẩn nên không kết luận thể bệnh xác định.']},confidence:clamp(v.confidence,FALLBACK_CONFIDENCE_CAP),summary,limitations};
}
function bottomAssessment(v,qc){
  if(!v?.visible)return{quality:'poor',visualValidity:{undersideVisible:false,vesselsVisible:false,framing:'poor',occlusion:'major',colorReliability:'poor'},undersideColor:'Không xác định',vessels:{visible:false,color:'Không xác định',prominence:'Không xác định',dilation:'Không xác định',tortuosity:'Không xác định',stasisSigns:'Không xác định',measurement:'Chỉ mô tả định tính khi ảnh không có chuẩn kích thước đáng tin cậy.'},otherVisibleFeatures:[],confidence:.25,summary:'Không xác nhận được rõ mặt dưới lưỡi.',limitations:[v?.reason||'Không tách được vùng mặt dưới lưỡi đủ rõ.']};
  const visible=v.vesselRatio>.012,prominence=v.vesselRatio>.075?'Nổi rõ':v.vesselRatio>.03?'Thấy mức vừa':'Ít nổi',dilation=v.vesselRatio>.10?'Có dấu hiệu giãn tương đối':'Không thấy giãn rõ';
  return{quality:v.quality,visualValidity:{undersideVisible:true,vesselsVisible:visible,framing:v.wholeVisible?'good':'fair',occlusion:v.wholeVisible?'none':'partial',colorReliability:v.colorReliability},undersideColor:v.undersideColor,vessels:{visible,color:visible?(v.purpleRatio>.10?'Tím/xanh tím':'Tím nhạt'):'Không xác định',prominence,dilation,tortuosity:'Chưa đánh giá chắc từ ảnh tĩnh',stasisSigns:v.vesselRatio>.075?'Có vùng mạch tím/sẫm cần đối chiếu':'Không thấy dấu ứ nổi bật',measurement:'Chỉ mô tả định tính khi ảnh không có chuẩn kích thước đáng tin cậy.'},otherVisibleFeatures:[],confidence:clamp(v.confidence,FALLBACK_CONFIDENCE_CAP),summary:visible?`Mặt dưới lưỡi thấy mạch màu ${v.purpleRatio>.10?'tím/xanh tím':'tím nhạt'}, mức nổi ${prominence.toLowerCase()}.`:'Mặt dưới lưỡi nhìn thấy nhưng mạch dưới lưỡi chưa nổi đủ rõ để mô tả chắc.',limitations:qc?.grade==='poor'?['Ảnh mặt dưới có chất lượng thấp; chỉ mô tả dấu nổi bật.']:[]};
}
function buildAssessment(mode,top,bottom,topQc,bottomQc){
  const ta=topAssessment(top,topQc),ba=mode==='general'?bottomAssessment(bottom,bottomQc):null,signals=[...(ta.theoryAssessment?.generalSignals||[])];
  if(ba?.vessels?.visible&&/Tím/.test(ba.vessels.color))signals.push(signal('Tín hiệu ứ trệ cần đối chiếu',`Mạch dưới lưỡi ${ba.vessels.color.toLowerCase()}, ${ba.vessels.prominence.toLowerCase()}.`,'Mạch dưới lưỡi tím/giãn chỉ là dấu hỗ trợ; cần phối hợp triệu chứng và mạch chẩn.',Math.min(.58,ba.confidence)));
  const conf=Math.min(FALLBACK_CONFIDENCE_CAP,mode==='general'?Math.min(ta.confidence,ba?.confidence||ta.confidence):ta.confidence);
  const combined={confidence:Number(conf.toFixed(3)),summary:mode==='general'?`${ta.summary} ${ba?.summary||''}`.trim():ta.summary,generalSignals:signals,stomachPatternSignals:[],cannotConclude:['Kết quả fallback chỉ hỗ trợ học tập/tham khảo; cần phối hợp Vấn chẩn và các dữ kiện lâm sàng khác.']};
  const featureVector={schemaVersion:'tongue-local-vision-v1',mode,top:{visual:{tongueColor:ta.tongueColor,shape:ta.shape,coatingColor:ta.coatingColor,coatingThickness:ta.coatingThickness,coatingTexture:ta.coatingTexture,moisture:ta.moisture,fissures:ta.fissures,toothmarks:ta.toothmarks,pricklesSpots:ta.pricklesSpots,stasisMarks:ta.stasisMarks},validity:ta.visualValidity,qc:topQc||{},confidence:ta.confidence},bottom:ba?{visual:{undersideColor:ba.undersideColor,vessels:ba.vessels},validity:ba.visualValidity,qc:bottomQc||{},confidence:ba.confidence}:null,combined:{confidence:combined.confidence,generalSignals:signals,stomachPatternSignals:[]}};
  return{mode,top:ta,bottom:ba,combined,ml:{pipeline:['parallel-browser-localization','color-segmentation','connected-component-roi','visual-feature-extraction','knowledge-mapping','academic-fusion'],featureVector,storage:'background-sync',fallback:{active:true,confidenceCap:FALLBACK_CONFIDENCE_CAP,policy:'model-observation-not-ground-truth'}}};
}
function capFallback(assessment){
  if(!assessment)return assessment;
  if(assessment.top)assessment.top.confidence=clamp(assessment.top.confidence,FALLBACK_CONFIDENCE_CAP);
  if(assessment.bottom)assessment.bottom.confidence=clamp(assessment.bottom.confidence,FALLBACK_CONFIDENCE_CAP);
  if(assessment.combined)assessment.combined.confidence=clamp(assessment.combined.confidence,FALLBACK_CONFIDENCE_CAP);
  return assessment;
}
async function prepareLocal(body){
  const started=now(),mode=body.mode==='general'?'general':'normal';
  const top=await inspectView(body.topImage||body.image,body.topQc||body.qc||{},'top');
  const bottom=mode==='general'?await inspectView(body.bottomImage,body.bottomQc||{},'bottom'):null;
  let assessment=buildAssessment(mode,top,bottom,body.topQc||body.qc||{},body.bottomQc||{});
  if(assessment?.top?.visualValidity?.tongueVisible!==true)return null;
  if(mode==='general'&&assessment?.bottom?.visualValidity?.undersideVisible!==true)return null;
  let signature=null;
  try{signature=await window.AITCAcademicVision?.signatureFromDataUrl?.(body.topImage||body.image)||null;}catch{}
  if(signature){
    body.academicSignature=signature;body.academicSource=window.AITCAcademicVision?.source||{id:'KNOWLEDGE-5DOC'};
    assessment.ml.featureVector.academic={source:'KNOWLEDGE-5DOC',signature};
  }
  const visionMs=Math.round(now()-started);
  const fusionStarted=now();
  let academicFusion=false;
  try{
    const r=await priorFetch('/api/local-fusion',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({assessment,body:{mode,topQc:body.topQc||body.qc||{},bottomQc:body.bottomQc||{},academicSignature:signature,academicSource:body.academicSource||null}})});
    const d=await r.json().catch(()=>null);
    if(r.ok&&d?.assessment){assessment=capFallback(d.assessment);academicFusion=Boolean(d.academicFusion);}
  }catch{}
  return{assessment,localVisionMs:visionMs,fusionMs:Math.round(now()-fusionStarted),academicFusion,totalLocalMs:Math.round(now()-started)};
}
function reasonFromResponse(response,data){
  const text=String(data?.message||data?.error||data?.reason||'').toUpperCase();
  if(text.includes('TIMEOUT')||response?.status===504)return'gemini_timeout';
  if(response?.status===503||text.includes('UNAVAILABLE'))return'gemini_503';
  return'gemini_unavailable';
}
function localResponse(body,prepared,reason,requestStarted){
  const requestToResultMs=Math.round(now()-requestStarted);
  const payload={ok:true,assessment:prepared.assessment,analysis:prepared.assessment,model:null,knowledgeVersion:'thiet-chan-kb-2026-09-15.5doc',collection:{ok:false,stored:false,backgroundSync:true,localVision:true},localVision:true,visionStatus:'local-image-analysis',fallback:true,inferenceSource:'local-open-source-vision-v1',fallbackReason:reason,academicFusion:Boolean(prepared.academicFusion),timing:{requestToResultMs,localVisionMs:prepared.localVisionMs,fusionMs:prepared.fusionMs,fallbackDeadlineMs:FALLBACK_DEADLINE_MS}};
  lastMetrics={requestToResultMs,localVisionMs:prepared.localVisionMs,fusionMs:prepared.fusionMs,fallback:true,fallbackReason:reason,inferenceSource:'local-open-source-vision-v1',mode:body.mode==='general'?'general':'normal',success:true};
  return new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json','cache-control':'no-store','x-aitc-vision':'local-parallel-fallback','x-aitc-fallback-reason':reason}});
}
async function inspectResponseMetrics(response,requestStarted,mode){
  try{
    const data=await response.clone().json();
    const requestToResultMs=Math.round(now()-requestStarted);
    lastMetrics={requestToResultMs,localVisionMs:Number(data?.timing?.localVisionMs)||null,fusionMs:Number(data?.timing?.fusionMs)||null,fallback:Boolean(data?.fallback||data?.localVision),fallbackReason:String(data?.fallbackReason||''),inferenceSource:data?.fallback?'local-open-source-vision-v1':(data?.localVision?'local-open-source-vision-v1':'gemini-3.8-flash'),mode,success:response.ok};
  }catch{}
}

const __aitcStage3bFetch=async(input,init={})=>{
  const url=typeof input==='string'?input:input?.url||'';
  if(!url.includes('/api/analyze')||String(init?.method||'GET').toUpperCase()!=='POST'||typeof init?.body!=='string')return priorFetch(input,init);
  const requestStarted=now();
  let body;
  try{body=JSON.parse(init.body);}catch{return priorFetch(input,init);}
  const mode=body.mode==='general'?'general':'normal';
  const localPromise=prepareLocal(body).catch(()=>null);
  const serverPromise=priorFetch(input,init).then(response=>({type:'response',response})).catch(error=>({type:'error',error}));
  const outcome=await Promise.race([serverPromise,sleep(FALLBACK_DEADLINE_MS).then(()=>({type:'deadline'}))]);
  if(outcome.type==='response'){
    const response=outcome.response;
    if(response.ok){await inspectResponseMetrics(response,requestStarted,mode);return response;}
    let data={};try{data=await response.clone().json();}catch{}
    if([502,503,504].includes(response.status)){
      const prepared=await Promise.race([localPromise,sleep(600).then(()=>null)]);
      if(prepared)return localResponse(body,prepared,reasonFromResponse(response,data),requestStarted);
    }
    await inspectResponseMetrics(response,requestStarted,mode);return response;
  }
  const prepared=await Promise.race([localPromise,sleep(600).then(()=>null)]);
  if(prepared){serverPromise.then(()=>{}).catch(()=>{});return localResponse(body,prepared,outcome.type==='deadline'?'gemini_timeout':'gemini_unavailable',requestStarted);}
  const failure={error:'LOCAL_VISION_NOT_CONFIRMED',message:'Không xác nhận được vùng lưỡi đủ rõ trong thời gian giới hạn. Vui lòng chụp lại ảnh rõ hơn.'};
  lastMetrics={requestToResultMs:Math.round(now()-requestStarted),fallback:false,fallbackReason:'local_vision_not_confirmed',inferenceSource:'none',mode,success:false};
  return new Response(JSON.stringify(failure),{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}});
};
requestClient.register('analysis-hotfix',__aitcStage3bFetch,800);

function emitBenchmark(){
  if(clickStartedAt===null)return;
  const clickToResultMs=Math.round(now()-clickStartedAt);
  const payload={event:'analysis_render',clickToResultMs,...(lastMetrics||{}),deviceClass:deviceClass()};
  clickStartedAt=null;
  priorFetch('/api/benchmark',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),keepalive:true}).catch(()=>{});
}
function installBenchmarkHooks(){
  const button=document.getElementById('analyzeBtn'),card=document.getElementById('resultCard');
  if(button)button.addEventListener('click',()=>{clickStartedAt=now();lastMetrics=null;},{capture:true});
  if(card)new MutationObserver(()=>{if(!card.hidden)emitBenchmark();}).observe(card,{attributes:true,attributeFilter:['hidden']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installBenchmarkHooks,{once:true});else installBenchmarkHooks();
})();
