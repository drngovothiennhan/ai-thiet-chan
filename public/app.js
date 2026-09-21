const $=id=>document.getElementById(id);
const emptyImage=()=>({data:'',mimeType:'image/jpeg',qc:null});
const state={
  mode:'normal',stream:null,facingMode:'environment',videoInputs:[],activeTarget:null,currentCameraProfile:null,cameraOpenedAt:0,cameraProfileByTarget:{top:null,bottom:null},
  images:{top:emptyImage(),bottom:emptyImage()},assessment:null,serverKey:false,knowledgeVersion:'',model:'',history:[]
};
const els={
  health:$('healthBadge'),normalMode:$('normalModeBtn'),generalMode:$('generalGuide'),generalModeBtn:$('generalModeBtn'),generalGuide:$('generalGuide'),bottomCaptureCard:$('bottomCaptureCard'),
  video:$('video'),cameraPanel:$('cameraPanel'),cameraTargetLabel:$('cameraTargetLabel'),switchCamera:$('switchCameraBtn'),capture:$('captureBtn'),closeCamera:$('closeCameraBtn'),
  topPreview:$('topPreview'),topEmpty:$('topEmpty'),topCamera:$('topCameraBtn'),topFile:$('topFileInput'),topReset:$('topResetBtn'),topQcPanel:$('topQcPanel'),topQcChips:$('topQcChips'),
  bottomPreview:$('bottomPreview'),bottomEmpty:$('bottomEmpty'),bottomCamera:$('bottomCameraBtn'),bottomFile:$('bottomFileInput'),bottomReset:$('bottomResetBtn'),bottomQcPanel:$('bottomQcPanel'),bottomQcChips:$('bottomQcChips'),
  analyze:$('analyzeBtn'),resultCard:$('resultCard'),topResultGrid:$('topResultGrid'),topLimitations:$('topLimitations'),bottomResultSection:$('bottomResultSection'),bottomResultGrid:$('bottomResultGrid'),bottomLimitations:$('bottomLimitations'),combinedTitle:$('combinedTitle'),theoryBox:$('theoryBox'),summary:$('summaryText'),confidence:$('confidenceBadge'),modelLabel:$('modelLabel'),report:$('reportBtn'),reportBox:$('reportBox'),
  chatForm:$('chatForm'),chatInput:$('chatInput'),chatLog:$('chatLog'),historyList:$('historyList'),historyCount:$('historyCount'),refreshHistory:$('refreshHistoryBtn'),canvas:$('workCanvas')
};
els.generalMode=els.generalModeBtn;

function setHealth(text,cls=''){els.health.textContent=text;els.health.className=`status-pill ${cls}`.trim();}
function escapeHtml(v){return String(v??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));}
function appendBubble(text,who='bot'){const div=document.createElement('div');div.className=`bubble ${who}`;div.textContent=text;els.chatLog.appendChild(div);els.chatLog.scrollTop=els.chatLog.scrollHeight;}
function formatDate(v){try{return new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(new Date(v));}catch{return v||'';}}
function viewLabel(target){return target==='bottom'?'mặt dưới lưỡi':'mặt trên lưỡi';}
function imageState(target){return state.images[target];}
function unique(arr){return [...new Set(arr.filter(Boolean))];}
function normalizeChatReferences(text){
  let value=String(text||'').replace(/\r/g,'').trim();
  if(!value)return value;
  const footerMatch=value.match(/(?:^|\n)(#{1,3}\s*)?Nguồn đối chiếu\b/i);
  const footerAt=footerMatch?.index??-1;
  let body=footerAt>=0?value.slice(0,footerAt):value;
  const footer=footerAt>=0?value.slice(footerAt).trim():'';
  const refs=new Map();
  body=body.replace(/\[(TC\d+|DY\d+|MC\d+|AT\d+|PSY\d+),\s*tr\.\s*([0-9,\-–\s]+)\]/gi,(full,id,pages)=>{
    const key=String(id).toUpperCase();
    const found=String(pages).split(/[,\s]+/).map(x=>x.trim()).filter(Boolean);
    refs.set(key,unique([...(refs.get(key)||[]),...found]));
    return '';
  });
  body=body.replace(/[ \t]+([,.;:!?])/g,'$1').replace(/[ \t]{2,}/g,' ').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  let sourceBlock=footer;
  if(!sourceBlock&&refs.size){
    sourceBlock='### Nguồn đối chiếu\n'+[...refs.entries()].map(([id,pages])=>`* [${id}, tr. ${pages.join(', ')}]`).join('\n');
  }
  return [body,sourceBlock].filter(Boolean).join('\n\n');
}

function updateAnalyzeState(){
  const topReady=Boolean(state.images.top.data);
  const bottomReady=Boolean(state.images.bottom.data);
  els.analyze.disabled=state.mode==='general'?!topReady||!bottomReady:!topReady;
}
function setMode(mode){
  state.mode=mode==='general'?'general':'normal';
  els.normalMode.classList.toggle('active',state.mode==='normal');
  els.generalMode.classList.toggle('active',state.mode==='general');
  els.generalGuide.hidden=state.mode!=='general';
  els.bottomCaptureCard.hidden=state.mode!=='general';
  state.assessment=null;els.resultCard.hidden=true;els.reportBox.hidden=true;
  if(state.stream) stopCamera();
  updateAnalyzeState();
}

function stopCamera(){
  if(state.stream){state.stream.getTracks().forEach(t=>t.stop());state.stream=null;}
  els.video.srcObject=null;els.video.classList.remove('mirror');els.cameraPanel.hidden=true;state.activeTarget=null;state.currentCameraProfile=null;state.cameraOpenedAt=0;
}
async function refreshVideoInputs(){
  try{const devices=await navigator.mediaDevices.enumerateDevices();state.videoInputs=devices.filter(d=>d.kind==='videoinput');}catch{state.videoInputs=[];}
  els.switchCamera.disabled=state.videoInputs.length<2;
}
async function optimizeCameraTrack(stream,facingMode){
  const track=stream?.getVideoTracks?.()[0];if(!track)return {facingMode,optimized:false};
  let capabilities={};try{capabilities=track.getCapabilities?.()||{};}catch{}
  const advanced={};
  if(Array.isArray(capabilities.focusMode)&&capabilities.focusMode.includes('continuous'))advanced.focusMode='continuous';
  if(Array.isArray(capabilities.exposureMode)&&capabilities.exposureMode.includes('continuous'))advanced.exposureMode='continuous';
  if(Array.isArray(capabilities.whiteBalanceMode)&&capabilities.whiteBalanceMode.includes('continuous'))advanced.whiteBalanceMode='continuous';
  if(capabilities.frameRate?.max>=24)advanced.frameRate=Math.min(30,capabilities.frameRate.max);
  let optimized=false;
  if(Object.keys(advanced).length){try{await track.applyConstraints({advanced:[advanced]});optimized=true;}catch{}}
  let settings={};try{settings=track.getSettings?.()||{};}catch{}
  return {
    source:'camera',facingMode:settings.facingMode||facingMode||'unknown',optimized,
    focusMode:settings.focusMode||advanced.focusMode||'unknown',exposureMode:settings.exposureMode||advanced.exposureMode||'unknown',whiteBalanceMode:settings.whiteBalanceMode||advanced.whiteBalanceMode||'unknown',
    width:Number(settings.width)||0,height:Number(settings.height)||0,frameRate:Number(settings.frameRate)||0
  };
}
async function startCamera(target,facingMode=state.facingMode){
  if(!navigator.mediaDevices?.getUserMedia) throw new Error('CAMERA_UNSUPPORTED');
  if(state.stream){state.stream.getTracks().forEach(t=>t.stop());state.stream=null;}
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facingMode},width:{ideal:1920},height:{ideal:1440},frameRate:{ideal:30,min:20}},audio:false});
  state.stream=stream;state.facingMode=facingMode;state.activeTarget=target;state.currentCameraProfile=await optimizeCameraTrack(stream,facingMode);state.cameraOpenedAt=performance.now();els.video.srcObject=stream;els.video.classList.toggle('mirror',state.currentCameraProfile?.facingMode==='user'||facingMode==='user');els.cameraPanel.hidden=false;els.cameraTargetLabel.textContent=`Đang chụp ${viewLabel(target)}${(state.currentCameraProfile?.facingMode||facingMode)==='user'?' · camera trước được tăng ổn định nét/phơi sáng':''}`;await refreshVideoInputs();els.cameraPanel.scrollIntoView({behavior:'smooth',block:'center'});
}
async function openCamera(target){
  try{await startCamera(target,state.facingMode);}catch(err){appendBubble(err?.name==='NotAllowedError'?'Thiết bị đang chặn quyền camera. Bạn vẫn có thể tải ảnh có sẵn từ máy.':`Không mở được camera để chụp ${viewLabel(target)}. Hãy thử tải ảnh từ thiết bị.`);}
}
async function switchCamera(){
  if(!state.stream||!state.activeTarget)return;const target=state.activeTarget,previous=state.facingMode,next=previous==='environment'?'user':'environment';els.switchCamera.disabled=true;
  try{await startCamera(target,next);els.switchCamera.textContent=next==='user'?'↻ Camera sau':'↻ Camera trước';}
  catch{try{await startCamera(target,previous);}catch{stopCamera();}appendBubble('Không chuyển được camera trên thiết bị này.');}
  finally{els.switchCamera.disabled=false;}
}
function waitForStableVideoFrame(){
  const elapsed=Math.max(0,performance.now()-(state.cameraOpenedAt||0));
  if(elapsed>=220&&els.video.readyState>=2)return Promise.resolve();
  const remaining=Math.max(0,220-elapsed);
  const timeout=Math.min(160,Math.max(60,remaining));
  return new Promise(resolve=>{
    let done=false;const finish=()=>{if(done)return;done=true;resolve();};const timer=setTimeout(finish,timeout);
    if(typeof els.video.requestVideoFrameCallback==='function')els.video.requestVideoFrameCallback(()=>{clearTimeout(timer);finish();});
  });
}
function waitForNextVideoFrame(timeout=70){
  return new Promise(resolve=>{
    let done=false;const finish=()=>{if(done)return;done=true;resolve();};const timer=setTimeout(finish,timeout);
    if(typeof els.video.requestVideoFrameCallback==='function')els.video.requestVideoFrameCallback(()=>{clearTimeout(timer);finish();});
  });
}
function captureCandidate(target,vw,vh){
  els.canvas.width=vw;els.canvas.height=vh;
  const ctx=els.canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(els.video,0,0,vw,vh);
  const qc=computeQc(ctx,vw,vh,target);
  return {data:els.canvas.toDataURL('image/jpeg',.91),qc,score:(Number(qc?.qualityScore)||0)+(qc?.checks?.focus?12:0)};
}
async function captureFrame(){
  if(!state.stream||!state.activeTarget)return;
  const target=state.activeTarget;
  const started=performance.now();
  await waitForStableVideoFrame();
  const vw=els.video.videoWidth||1280,vh=els.video.videoHeight||960;
  const first=captureCandidate(target,vw,vh);
  let best=first,frames=1;
  if(!first.qc?.checks?.focus||Number(first.qc?.qualityScore||0)<78){
    await waitForNextVideoFrame();
    const second=captureCandidate(target,vw,vh);frames=2;
    if(second.score>first.score)best=second;
  }
  const captureMeta={
    ...(state.currentCameraProfile||{source:'camera',facingMode:state.facingMode}),
    capturedAt:Date.now(),burstFrames:frames,bestFrameScore:Number(best?.score||0),
    selection:frames===1?'roi-qc-fast-single':'roi-qc-fast-best-of-2',
    captureLatencyMs:Math.round(performance.now()-started),
    precomputedQc:best.qc
  };
  state.cameraProfileByTarget[target]={...captureMeta,precomputedQc:undefined};
  stopCamera();
  await acceptImage(target,best.data,'image/jpeg',captureMeta);
}

function fileToDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}

async function acceptImage(target,dataUrl,mimeType,captureMeta={source:'upload',facingMode:'unknown'}){
  const img=await loadImage(dataUrl),max=1440,scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,w,h);
  const {precomputedQc,...captureInfo}=captureMeta||{};const qc=precomputedQc?{...precomputedQc}:computeQc(ctx,w,h,target);qc.capture={...captureInfo,frontCamera:captureMeta?.facingMode==='user'};
  state.images[target]={data:c.toDataURL('image/jpeg',.90),mimeType:'image/jpeg',qc};state.assessment=null;els.resultCard.hidden=true;els.reportBox.hidden=true;renderImageSlot(target);updateAnalyzeState();
}
function clearImage(target){state.images[target]=emptyImage();state.cameraProfileByTarget[target]=null;state.assessment=null;renderImageSlot(target);els.resultCard.hidden=true;els.reportBox.hidden=true;updateAnalyzeState();}
function renderImageSlot(target){
  const current=imageState(target),preview=target==='top'?els.topPreview:els.bottomPreview,empty=target==='top'?els.topEmpty:els.bottomEmpty,panel=target==='top'?els.topQcPanel:els.bottomQcPanel,chips=target==='top'?els.topQcChips:els.bottomQcChips;
  if(current.data){preview.src=current.data;preview.hidden=false;empty.hidden=true;panel.hidden=false;renderQc(current.qc,chips);}else{preview.removeAttribute('src');preview.hidden=true;empty.hidden=false;panel.hidden=true;chips.innerHTML='';}
}
function computeQc(ctx,w,h,target='top'){
  if(globalThis.AITCQC?.computeCanvasQc){
    try{return globalThis.AITCQC.computeCanvasQc(ctx,w,h,{view:target});}catch(err){console.warn('roi_qc_fallback',err?.message||err);}
  }
  const sw=Math.min(280,w),sh=Math.max(1,Math.round(h*(sw/w))),temp=document.createElement('canvas');temp.width=sw;temp.height=sh;const t=temp.getContext('2d',{willReadFrequently:true});t.drawImage(ctx.canvas,0,0,sw,sh);const d=t.getImageData(0,0,sw,sh).data;
  const gray=new Float32Array(sw*sh);let sum=0,sumSq=0,bright=0,dark=0;
  for(let i=0,p=0;i<d.length;i+=4,p++){const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];gray[p]=g;sum+=g;sumSq+=g*g;if(g>245)bright++;if(g<35)dark++;}
  const n=gray.length,brightness=sum/n,variance=Math.max(0,sumSq/n-brightness*brightness),contrast=Math.sqrt(variance);let edge=0,count=0,lapSum=0,lapSq=0,lapCount=0;
  for(let y=1;y<sh;y++)for(let x=1;x<sw;x++){const p=y*sw+x;edge+=Math.abs(gray[p]-gray[p-1])+Math.abs(gray[p]-gray[p-sw]);count+=2;}
  for(let y=1;y<sh-1;y++)for(let x=1;x<sw-1;x++){const p=y*sw+x,lap=4*gray[p]-gray[p-1]-gray[p+1]-gray[p-sw]-gray[p+sw];lapSum+=lap;lapSq+=lap*lap;lapCount++;}
  const edgeScore=count?edge/count:0,lapMean=lapCount?lapSum/lapCount:0,laplacianVariance=lapCount?Math.max(0,lapSq/lapCount-lapMean*lapMean):0,glare=bright/n,darkness=dark/n,minSide=Math.min(w,h);
  const checks={resolution:minSide>=480,light:brightness>=60&&brightness<=225&&glare<.15,dynamic:contrast>=25,focus:laplacianVariance>=55&&edgeScore>=7,highlight:glare<.15,shadow:darkness<.20,clipping:glare<.15&&darkness<.20};
  const passed=[checks.resolution,checks.light,checks.dynamic,checks.focus,checks.clipping].filter(Boolean).length,grade=passed===5?'good':passed>=3?'fair':'poor';
  return {version:'legacy-whole-frame-fallback-v1',grade,width:w,height:h,brightness:Number(brightness.toFixed(1)),contrast:Number(contrast.toFixed(1)),edge:Number(edgeScore.toFixed(1)),laplacianVariance:Number(laplacianVariance.toFixed(1)),glare:Number((glare*100).toFixed(1)),darkness:Number((darkness*100).toFixed(1)),qualityScore:passed*20,checks};
}
function renderQc(q,chips){
  if(!q)return;
  const labels=[['Độ phân giải',q.checks.resolution],['Ánh sáng',q.checks.light],['Tương phản',q.checks.dynamic],['Độ nét',q.checks.focus],['Cháy sáng',q.checks.highlight??q.checks.clipping],['Vùng tối',q.checks.shadow??q.checks.clipping]];
  chips.innerHTML=labels.map(([label,ok])=>`<span class="chip ${ok?'good':'warn'}">${ok?'✓':'!'} ${label}</span>`).join('')
    +`<span class="chip ${q.grade==='good'?'good':q.grade==='poor'?'bad':'warn'}">QC: ${q.grade.toUpperCase()}</span>`
    +(q.roiDetected===false?'<span class="chip warn">ROI chưa chắc chắn</span>':'')
    +((q.checks?.focus&&q.checks?.focusOptimal===false)?'<span class="chip">Nét đủ phân tích · chưa tối ưu</span>':'')
    +(q.capture?.frontCamera?'<span class="chip">Camera trước · lấy nét liên tục</span>':'');
}

async function checkHealth(attempt=0){
  setHealth(attempt?'Đang kết nối lại hệ thống':'Đang kiểm tra kết nối A.I','warn');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
  try{
    const r=await fetch('/api/health',{cache:'no-store',signal:controller.signal}),d=await r.json();
    if(!r.ok||!d.ok)throw new Error('health');
    state.serverKey=Boolean(d.consultation?.configured??d.providerConfigured);
    state.knowledgeVersion=d.knowledgeVersion||'';
    state.model=d.model||'';
    const localReady=d.vision?.provider==='local'&&d.vision?.analysisRequiresProvider===false;
    const ragReady=Boolean(d.caseReasoningRetrieval?.ready);
    const collectionReady=Boolean(d.caseCollection?.storeReady);
    if(localReady&&ragReady&&collectionReady)setHealth('A.I + RAG + dữ liệu sẵn sàng','good');
    else if(localReady&&ragReady)setHealth('A.I + RAG sẵn sàng · dữ liệu đang nối','good');
    else if(localReady)setHealth('A.I cục bộ sẵn sàng · RAG đang nối','warn');
    else setHealth('A.I đang khởi động','warn');
  }catch{
    setHealth('Chưa xác minh A.I · máy chủ chưa kết nối','warn');
    if(attempt<2)setTimeout(()=>checkHealth(attempt+1),2500*(attempt+1));
  }finally{clearTimeout(timer);}
}
async function apiFetch(url,body){
  const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await r.json().catch(()=>({}));
  if(r.status===428){setHealth('A.I máy chủ chưa cấu hình','warn');throw new Error('Khóa Gemini dùng chung chưa được cấu hình trên máy chủ.');}
  if(r.status===429)throw new Error(`Đang vượt giới hạn bảo vệ khóa dùng chung. Thử lại sau ${d.retryAfter||'ít phút'} giây.`);
  if(!r.ok)throw new Error(d?.message||d?.error||`HTTP ${r.status}`);return d;
}
async function apiGet(url){const r=await fetch(url,{cache:'no-store'}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.message||d?.error||`HTTP ${r.status}`);return d;}

async function awaitStorageWorkerControl(timeoutMs=2600){
  if(!('serviceWorker' in navigator))return true;
  if(navigator.serviceWorker.controller)return true;
  const delay=ms=>new Promise(resolve=>setTimeout(()=>resolve(null),ms));
  try{await Promise.race([navigator.serviceWorker.ready,delay(timeoutMs)]);}catch{}
  if(navigator.serviceWorker.controller)return true;
  await Promise.race([
    new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(true),{once:true})),
    delay(timeoutMs)
  ]);
  return Boolean(navigator.serviceWorker.controller);
}

async function analyze(){
  if(els.analyze.disabled)return;els.analyze.disabled=true;const old=els.analyze.textContent;els.analyze.textContent='Đang phân tích…';
  try{
    if('serviceWorker' in navigator&&!(await awaitStorageWorkerControl()))throw new Error('Lớp truyền ảnh trực tiếp chưa sẵn sàng. Hãy tải lại trang rồi thử lại.');
    const top=state.images.top,bottom=state.images.bottom;
    const d=await apiFetch('/api/analyze',{mode:state.mode,topImage:top.data,topMimeType:top.mimeType,topQc:top.qc,bottomImage:state.mode==='general'?bottom.data:null,bottomMimeType:bottom.mimeType,bottomQc:state.mode==='general'?bottom.qc:null});
    state.assessment=d.assessment||d.analysis;state.knowledgeVersion=d.knowledgeVersion||state.knowledgeVersion;state.model=d.model||state.model;renderResult();
    setHealth(d.collection?.ok?'A.I + dữ liệu học máy hoạt động':'A.I hoạt động · chưa lưu được dữ liệu',d.collection?.ok?'good':'warn');
    if(!d.collection?.ok)appendBubble('Ca đã phân tích nhưng chưa đồng bộ vào kho dữ liệu học máy.');
  }catch(err){appendBubble(`Không thể phân tích: ${err.message}`);}finally{updateAnalyzeState();els.analyze.textContent=old;}
}

function fieldGrid(fields){return fields.map(([k,v])=>`<div class="result-item"><span>${escapeHtml(k)}</span><strong>${escapeHtml(v??'Không xác định')}</strong></div>`).join('');}
function renderLimitations(node,items){const list=Array.isArray(items)?items.filter(Boolean):[];node.hidden=!list.length;node.innerHTML=list.length?`<strong>Giới hạn</strong><ul>${list.map(v=>`<li>${escapeHtml(v)}</li>`).join('')}</ul>`:'';}
function cleanMachineLearningSummary(value){
  let text=String(value||'').replace(/\r/g,' ').replace(/\s+/g,' ').trim();
  if(!text)return '';
  text=text
    .replace(/Đã đối chiếu\s+\d+\s+ca tương tự từ corpus[^.]*\.[^G]*?(?:không được dùng để tự tạo triệu chứng\.)?/giu,' ')
    .replace(/Giới hạn:\s*.*$/giu,' ')
    .replace(/Tầng thị giác hiện tại chỉ khẳng định[^.]*\./giu,' ')
    .replace(/Độ tương đồng atlas là đối chiếu hình ảnh, không phải chẩn đoán\./giu,' ')
    .replace(/Tín hiệu điểm tối thô không được phép tự chuyển thành kết luận nứt lưỡi;[^.]*\./giu,' ')
    .replace(/Độ ẩm được đọc từ tín hiệu gloss \+ microtexture sau QC;[^.]*\./giu,' ')
    .replace(/Chất lượng ảnh chưa đạt mức tốt nên độ tin cậy quan sát bị giới hạn\./giu,' ')
    .replace(/Ảnh không có chuẩn kích thước tuyệt đối:[^.]*\./giu,' ')
    .replace(/\s{2,}/g,' ')
    .trim();
  return text;
}
function semanticKey(value){
  return String(value||'').toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9\s]/g,' ').replace(/\b(?:mat tren|mat duoi|tong hop|quan sat|doi chieu|hien co|du kien)\b/g,' ').replace(/\s+/g,' ').trim();
}
function dedupeBullets(items,max=6){
  const out=[],keys=[];
  for(const raw of items){
    const item=String(raw||'').trim();if(!item)continue;
    const key=semanticKey(item);if(!key)continue;
    const duplicate=keys.some(prev=>prev===key||(key.length>28&&prev.includes(key))||(prev.length>28&&key.includes(prev)));
    if(duplicate)continue;
    keys.push(key);out.push(item);if(out.length>=max)break;
  }
  return out;
}
function proseBullets(value,max=4){
  const text=String(value||'').trim();
  if(!text)return [];
  return dedupeBullets(text.split(/(?<=[.!?])\s+|\s*[•|]\s*/).map(x=>x.trim()).filter(Boolean),max);
}
function cleanDiscussionSummary(value){
  let text=String(value||'').replace(/\r/g,' ').replace(/\s+/g,' ').trim();
  if(!text)return '';
  return text.replace(/Giới hạn:\s*.*$/giu,' ').replace(/\s{2,}/g,' ').trim();
}
function recognitionSummary(a){
  const top=a?.top||{},bottom=a?.bottom||null,v=bottom?.vessels||{};
  const known=v=>{const s=String(v??'').trim();return s&&!/không xác định|chưa đủ|unknown/i.test(s)?s:'';};
  const topParts=[
    known(top.tongueColor)&&`chất lưỡi ${known(top.tongueColor)}`,
    known(top.coatingColor)&&`rêu ${known(top.coatingColor)}`,
    known(top.coatingThickness)&&`độ dày ${known(top.coatingThickness)}`,
    known(top.coatingDistribution)&&`phân bố ${known(top.coatingDistribution)}`,
    known(top.moisture)&&`độ ẩm ${known(top.moisture)}`,
    known(top.shape)&&`hình thể ${known(top.shape)}`,
    known(top.toothmarks)&&`dấu răng: ${known(top.toothmarks)}`
  ].filter(Boolean);
  const out=[];if(topParts.length)out.push('Mặt trên: '+topParts.join('; ')+'.');
  if(bottom){
    const bottomParts=[known(bottom.undersideColor)&&`màu mặt dưới ${known(bottom.undersideColor)}`,v.visible===true?'thấy cấu trúc mạch hai bên':'',known(v.color)&&`màu mạch ${known(v.color)}`,known(v.prominence)&&`mức nổi ${known(v.prominence)}`].filter(Boolean);
    if(bottomParts.length)out.push('Mặt dưới: '+bottomParts.join('; ')+'.');
  }
  return dedupeBullets(out,3).join(' ');
}
function renderDiscussion(value){
  const items=proseBullets(cleanDiscussionSummary(value),5);
  if(!items.length){els.summary.innerHTML='<p class="discussion-empty">Chưa có nội dung bàn luận.</p>';return;}
  els.summary.innerHTML='<ul class="discussion-list">'+items.map(item=>`<li>${escapeHtml(item)}</li>`).join('')+'</ul>';
}
function renderTheoryAssessment(a){
  const combined=a?.combined||{},top=a?.top||{};
  const general=Array.isArray(combined.generalSignals)?combined.generalSignals:[];
  const stomach=Array.isArray(combined.stomachPatternSignals)?combined.stomachPatternSignals:[];
  const signals=[...general,...stomach].filter(item=>item&&typeof item==='object');
  const mlText=cleanMachineLearningSummary(recognitionSummary(a)||top.summary||'');
  const mlItems=proseBullets(mlText,4);
  const literatureItems=signals.slice(0,4).map(item=>({
    label:String(item.label||'').trim(),
    evidence:String(item.evidence||item.rule||'').trim()
  })).filter(item=>item.label||item.evidence);
  const signalMeta=item=>{
    const raw=Number(item?.confidence),has=Number.isFinite(raw),pct=has?Math.round(Math.max(0,Math.min(1,raw))*100):null;
    const warnEligible=item?.warningEligible!==false;
    const level=warnEligible&&pct!==null&&pct>=80?'high':warnEligible&&pct!==null&&pct>=70?'watch':'info';
    const label=level==='high'?'Cảnh báo mức cao':level==='watch'?'Cần lưu ý':'Mức tham khảo';
    const cls=level==='high'?'signal-alert high':level==='watch'?'signal-alert watch':'signal-alert';
    return {pct,level,label,cls};
  };
  const generalHtml=general.map(item=>{
    const meta=signalMeta(item);
    const score=meta.pct===null?'':`<small>Mức phù hợp dấu hiệu: ${meta.pct}% · không phải xác suất chẩn đoán.</small>`;
    const alert=meta.level==='info'?'':`<div class="${meta.cls}"><strong>${meta.label} ${meta.pct}%</strong><span>Cần đối chiếu thêm triệu chứng, mạch và Tứ chẩn trước khi nâng mức kết luận.</span></div>`;
    return `<li class="theory-signal ${meta.level}"><strong>${escapeHtml(item.label||'Tín hiệu')}</strong><span>${escapeHtml(item.evidence||'')}</span>${score}${item.rule?`<small>${escapeHtml(item.rule)}</small>`:''}${alert}</li>`;
  }).join('');
  const stomachHtml=stomach.map(item=>{const pct=Math.round(Math.max(0,Math.min(1,Number(item.confidence)||0))*100);const alert=pct>=80?`<div class="signal-alert high"><strong>Cảnh báo mức cao ${pct}%</strong><span>Cần phối hợp triệu chứng và Tứ chẩn trước khi kết luận.</span></div>`:pct>=70?`<div class="signal-alert watch"><strong>Cần lưu ý ${pct}%</strong><span>Cần phối hợp triệu chứng và Tứ chẩn trước khi kết luận.</span></div>`:'';return `<li><strong>${escapeHtml(item.label||'')}</strong><span>${escapeHtml(item.evidence||'')}</span><small>Mức phù hợp dấu hiệu: ${pct}% · không phải xác suất chẩn đoán.${item.missingForConclusion?` · Còn thiếu: ${escapeHtml(item.missingForConclusion)}`:''}</small>${alert}</li>`;}).join('');
  const mlHtml=(mlItems.length?mlItems:['Chưa đủ dữ liệu cấu trúc để tổng hợp.']).map(item=>`<li>${escapeHtml(item)}</li>`).join('');
  const literatureHtml=(literatureItems.length?literatureItems:[{label:'',evidence:'Chưa có tín hiệu y văn đủ mạnh để quy nạp thêm từ dữ kiện hiện có.'}]).map(item=>`<li>${item.label?`<strong>${escapeHtml(item.label)}</strong>`:''}${item.evidence?`<span>${escapeHtml(item.evidence)}</span>`:''}</li>`).join('');
  const preliminaryHtml=`<section class="preliminary-conclusion"><div class="theory-title">Tóm tắt nhận diện</div><div class="evidence-block"><h4>Quan sát trực tiếp</h4><ul class="evidence-list">${mlHtml}</ul></div><div class="evidence-block"><h4>Đối chiếu y văn</h4><ul class="evidence-list">${literatureHtml}</ul></div></section>`;
  els.theoryBox.innerHTML=`<strong>Đối chiếu lý thuyết thiệt chẩn</strong>${generalHtml?`<div class="theory-title">Các tín hiệu đối chiếu</div><ul>${generalHtml}</ul>`:''}${stomachHtml?`<div class="theory-title">Tín hiệu Vị quản</div><ul>${stomachHtml}</ul>`:''}${preliminaryHtml}`;els.theoryBox.hidden=false;
}
function renderResult(){
  const a=state.assessment||{},top=a.top||{},tv=top.visualValidity||{};
  const sulcus=top?.morphology?.medianSulcus||{};
  const sulcusText=sulcus.status==='visible-signal'?'Có tín hiệu rãnh dọc giữa':sulcus.status&&sulcus.status!=='unknown'?String(sulcus.status):'Không xác định';
  els.topResultGrid.innerHTML=fieldGrid([
    ['Đúng mặt trên',tv.tongueVisible===true?'Đã xác nhận':tv.tongueVisible===false?'Không xác nhận':'Không xác định'],['Toàn bộ lưỡi',tv.wholeTongueVisible===true?'Thấy rõ':tv.wholeTongueVisible===false?'Chưa đủ':'Không xác định'],['Phần sau/gốc lưỡi',tv.rootVisible===true?'Thấy rõ':tv.rootVisible===false?'Chưa thấy rõ':'Không xác định'],['Độ tin cậy màu',tv.colorReliability],['Màu lưỡi',top.tongueColor],['Hình thể',top.shape],['Màu rêu',top.coatingColor],['Độ dày rêu',top.coatingThickness],['Phân bố rêu',top.coatingDistribution||'Không xác định'],['Tính chất rêu',top.coatingTexture],['Độ ẩm',top.moisture],['Rãnh giữa',sulcusText],['Nứt',top.fissures],['Dấu răng',top.toothmarks],['Gai/điểm',top.pricklesSpots],['Ban/điểm ứ',top.stasisMarks],['Chất lượng A.I',top.quality]
  ]);renderLimitations(els.topLimitations,top.limitations);

  if(a.mode==='general'&&a.bottom){
    const bottom=a.bottom,bv=bottom.visualValidity||{},v=bottom.vessels||{};els.bottomResultSection.hidden=false;
    els.bottomResultGrid.innerHTML=fieldGrid([
      ['Đúng mặt dưới',bv.undersideVisible===true?'Đã xác nhận':bv.undersideVisible===false?'Không xác nhận':'Không xác định'],['Mạch dưới lưỡi',bv.vesselsVisible===true?'Thấy rõ':bv.vesselsVisible===false?'Chưa thấy rõ':'Không xác định'],['Độ tin cậy màu',bv.colorReliability],['Màu mặt dưới',bottom.undersideColor],['Màu mạch',v.color],['Mức nổi',v.prominence],['Giãn',v.dilation],['Uốn lượn/ngoằn ngoèo',v.tortuosity],['Dấu ứ nhìn thấy',v.stasisSigns],['Đo kích thước',v.measurement],['Chất lượng A.I',bottom.quality]
    ]);renderLimitations(els.bottomLimitations,bottom.limitations);els.combinedTitle.textContent='3. Tổng hợp nhận định';
  }else{els.bottomResultSection.hidden=true;els.bottomResultGrid.innerHTML='';els.bottomLimitations.hidden=true;els.combinedTitle.textContent='2. Tổng hợp nhận định';}

  renderTheoryAssessment(a);const combined=a.combined||{};renderDiscussion(combined.summary||top.summary||'');const conf=Math.max(0,Math.min(1,Number(combined.confidence)||0));els.confidence.textContent=`Tin cậy ${Math.round(conf*100)}%`;els.modelLabel.textContent=[a.mode==='general'?'Tổng quát · 2 ảnh':'Bình thường · 1 ảnh',state.model?`Mô hình: ${state.model}`:'',state.knowledgeVersion?`KB: ${state.knowledgeVersion}`:''].filter(Boolean).join(' · ');els.resultCard.hidden=false;els.resultCard.scrollIntoView({behavior:'smooth',block:'start'});
}

function renderCaseReport(data){
  const sections=Array.isArray(data?.sections)?data.sections:[];
  if(!sections.length){els.reportBox.textContent=data?.report||'Chưa có báo cáo.';els.reportBox.hidden=false;return;}
  const sectionHtml=sections.map(section=>{
    const items=Array.isArray(section?.items)?dedupeBullets(section.items,10):[];
    if(!items.length)return '';
    return `<section class="case-report-section"><h4>${escapeHtml(section.title||'')}</h4><ul>${items.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`;
  }).filter(Boolean).join('');
  els.reportBox.innerHTML=`<article class="case-report"><header class="case-report-head"><div><strong>BÁO CÁO TỔNG KẾT CA THIỆT CHẨN</strong><span>A.I THIỆT CHẨN · HIU CLB YHCT</span></div><span class="case-report-mode">${escapeHtml(data.modeLabel||'Thiệt chẩn')}</span></header>${sectionHtml}<footer class="case-report-foot">Kết quả hỗ trợ học tập và đối chiếu YHCT; không thay thế Tứ chẩn và khám trực tiếp.</footer></article>`;
  els.reportBox.hidden=false;
}
async function makeReport(){
  if(!state.assessment)return;els.report.disabled=true;const old=els.report.textContent;els.report.textContent='Đang tạo báo cáo…';
  try{const d=await apiFetch('/api/report',{mode:state.mode,assessment:state.assessment,topQc:state.images.top.qc,bottomQc:state.mode==='general'?state.images.bottom.qc:null});renderCaseReport(d);}catch(err){appendBubble(`Không tạo được báo cáo: ${err.message}`);}finally{els.report.disabled=false;els.report.textContent=old;}
}
async function sendChat(ev){ev.preventDefault();const message=els.chatInput.value.trim();if(!message)return;els.chatInput.value='';appendBubble(message,'user');const submit=els.chatForm.querySelector('button');submit.disabled=true;try{const d=await apiFetch('/api/chat',{assessment:state.assessment,message});appendBubble(normalizeChatReferences(d.reply||'Không có phản hồi.'));}catch(err){appendBubble(`Chatbot chưa trả lời được: ${err.message}`);}finally{submit.disabled=false;}}

function historyNodes(){
  return {list:$('historyList'),count:$('historyCount'),refresh:$('refreshHistoryBtn')};
}
function renderHistory(){
  const nodes=historyNodes();if(!nodes.list||!nodes.count)return;
  const cases=state.history||[];nodes.count.textContent=`${cases.length} ca gần nhất`;
  if(!cases.length){nodes.list.innerHTML='<div class="history-empty">Chưa có ca được lưu.</div>';return;}
  nodes.list.innerHTML=cases.map(item=>{
    const conf=Math.round(Math.max(0,Math.min(1,Number(item.confidence)||0))*100),mode=item.assessment_mode==='general'?'Tổng quát · 2 ảnh':'Bình thường · 1 ảnh';
    const bottom=item.assessment_mode==='general'&&item.bottom_vessels?` · Mạch dưới: ${escapeHtml(item.bottom_vessels)}`:'';
    return `<article class="history-item admin-compact-item"><div class="history-top"><strong>${escapeHtml(formatDate(item.created_at))}</strong><span class="chip">${mode}</span><span class="status-pill good">${conf}%</span></div><div class="history-features">${item.top_tongue_color?`Lưỡi: ${escapeHtml(item.top_tongue_color)}`:''}${item.top_coating_color?` · Rêu: ${escapeHtml(item.top_coating_color)}`:''}${bottom}</div><p>${escapeHtml(item.summary||'Không có tóm tắt.')}</p></article>`;
  }).join('');
}
async function loadHistory(){
  const nodes=historyNodes();if(!nodes.list)return;if(nodes.refresh)nodes.refresh.disabled=true;
  try{const d=await apiGet('/api/cases?limit=30');state.history=Array.isArray(d.cases)?d.cases:[];renderHistory();}
  catch{nodes.list.innerHTML='<div class="history-empty">Chưa tải được lịch sử ca.</div>';}
  finally{if(nodes.refresh)nodes.refresh.disabled=false;}
}

async function handleFile(target,input){const file=input.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){appendBubble('Tệp đã chọn không phải hình ảnh.');input.value='';return;}try{await acceptImage(target,await fileToDataUrl(file),file.type,{source:'upload',facingMode:'unknown'});}catch{appendBubble(`Không đọc được ảnh ${viewLabel(target)} đã chọn.`);}input.value='';}

els.normalMode.addEventListener('click',()=>setMode('normal'));els.generalMode.addEventListener('click',()=>setMode('general'));
els.topCamera.addEventListener('click',()=>openCamera('top'));els.bottomCamera.addEventListener('click',()=>openCamera('bottom'));els.switchCamera.addEventListener('click',switchCamera);els.capture.addEventListener('click',captureFrame);els.closeCamera.addEventListener('click',stopCamera);
els.topReset.addEventListener('click',()=>clearImage('top'));els.bottomReset.addEventListener('click',()=>clearImage('bottom'));els.topFile.addEventListener('change',()=>handleFile('top',els.topFile));els.bottomFile.addEventListener('change',()=>handleFile('bottom',els.bottomFile));
els.analyze.addEventListener('click',analyze);els.report.addEventListener('click',makeReport);els.chatForm.addEventListener('submit',sendChat);
document.addEventListener('click',event=>{if(event.target?.id==='refreshHistoryBtn')loadHistory();});
window.addEventListener('aitc:history-open',loadHistory);
window.addEventListener('beforeunload',stopCamera);document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.stream)stopCamera();});
setMode('normal');checkHealth();
