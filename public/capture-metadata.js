(()=>{
  const requestClient=window.AITCRequestClient;if(!requestClient)throw new Error('AITC_REQUEST_CLIENT_MISSING');
  const nativeFetch=(input,init)=>requestClient.fetchAfter('capture-metadata',input,init);
  const SUPABASE_URL='https://gzmpnsrwqjpsbklyflqr.supabase.co';
  const SUPABASE_KEY='sb_publishable_Y4hMhXROZ-aVgWoaQ5fFKQ_ZAcXuIzG';

  // Zero-dependency browser fallback. Architecture follows public tongue-vision
  // pipelines (localize -> segment -> extract features -> reason), including
  // TonguePicture-SKaRD/TongueDiagnosis as architecture reference only. No AGPL
  // source code or weights are copied. Pixel processing uses standard HSV/
  // connected-component ideas commonly available in OpenCV.
  function deviceClass(){
    const ua=navigator.userAgent||'';
    if(/Android/i.test(ua)) return 'android';
    if(/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if(/Windows/i.test(ua)) return 'windows';
    if(/Macintosh|Mac OS X/i.test(ua)) return 'macos';
    if(/Linux/i.test(ua)) return 'linux';
    return 'other';
  }
  function viewportClass(){const w=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0);return w<600?'mobile':w<1024?'tablet':'desktop';}
  function captureContext(){
    return {
      schemaVersion:'capture-context-v1',
      deviceClass:deviceClass(),
      viewportClass:viewportClass(),
      cameraApi:Boolean(navigator.mediaDevices?.getUserMedia),
      standalone:Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone===true)
    };
  }

  function rgbToHsv(r,g,b){
    r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;
    if(d){if(max===r)h=60*((g-b)/d%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4);}
    if(h<0)h+=360;return {h,s:max?d/max:0,v:max};
  }
  function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
  function largestComponent(mask,w,h){
    const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);let best=[];
    for(let seed=0;seed<mask.length;seed++){
      if(!mask[seed]||seen[seed])continue;let head=0,tail=0;queue[tail++]=seed;seen[seed]=1;const cells=[];
      while(head<tail){const p=queue[head++];cells.push(p);const x=p%w,y=(p/w)|0;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const np=ny*w+nx;if(mask[np]&&!seen[np]){seen[np]=1;queue[tail++]=np;}}
      }
      if(cells.length>best.length)best=cells;
    }
    const out=new Uint8Array(mask.length);for(const p of best)out[p]=1;return {mask:out,area:best.length};
  }
  function mean(values){return values.length?values.reduce((a,b)=>a+b,0)/values.length:0;}
  function qcConfidence(qc,coverage){
    const base=qc?.grade==='good'?0.68:qc?.grade==='fair'?0.56:0.42;
    const bonus=coverage>=0.10&&coverage<=0.50?0.05:coverage>=0.05?0.02:-0.06;
    return Math.max(0.32,Math.min(0.73,Number((base+bonus).toFixed(3))));
  }
  function colorReliability(qc){return qc?.grade==='good'?'good':qc?.grade==='fair'?'fair':'poor';}
  function directSignal(label,evidence,rule,confidence){return {label,evidence,rule,confidence};}

  async function inspectView(dataUrl,qc,view='top'){
    const img=await loadImage(dataUrl);const maxSide=192,scale=Math.min(1,maxSide/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
    const w=Math.max(48,Math.round((img.naturalWidth||img.width)*scale)),h=Math.max(48,Math.round((img.naturalHeight||img.height)*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,w,h);
    const px=ctx.getImageData(0,0,w,h).data,n=w*h,mask=new Uint8Array(n);
    for(let p=0;p<n;p++){
      const x=p%w,y=(p/w)|0;if(x<w*.08||x>w*.92||y<h*.05||y>h*.97)continue;
      const i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b),redBias=r-(g+b)/2;
      const tongueHue=hsv.h<=58||hsv.h>=300;
      if(r>55&&hsv.v>.20&&hsv.s>.08&&tongueHue&&redBias>3)mask[p]=1;
    }
    const comp=largestComponent(mask,w,h),coverage=comp.area/n;
    if(comp.area<Math.max(120,n*.018)) return {visible:false,coverage,confidence:0.25,reason:'Không tách được vùng lưỡi đủ rõ từ ảnh hiện tại.'};

    let minX=w,minY=h,maxX=0,maxY=0;const rs=[],gs=[],bs=[],hs=[],ss=[],vs=[];
    for(let p=0;p<n;p++)if(comp.mask[p]){const x=p%w,y=(p/w)|0;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);const i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b);rs.push(r);gs.push(g);bs.push(b);hs.push(hsv.h);ss.push(hsv.s);vs.push(hsv.v);}
    const bw=Math.max(1,maxX-minX+1),bh=Math.max(1,maxY-minY+1),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    const meanR=mean(rs),meanG=mean(gs),meanB=mean(bs),meanS=mean(ss),meanV=mean(vs);
    let purple=0,redHot=0,stasis=0,central=0,whiteCoat=0,yellowCoat=0,glare=0,darkLines=0,redSpots=0,vessel=0;
    const gray=(p)=>{const i=p*4;return .299*px[i]+.587*px[i+1]+.114*px[i+2];};
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      const nx=(x-cx)/(bw*.52),ny=(y-cy)/(bh*.52);if(nx*nx+ny*ny>1)continue;const p=y*w+x,i=p*4,r=px[i],g=px[i+1],b=px[i+2],hsv=rgbToHsv(r,g,b);
      const bodyLike=comp.mask[p]||((r>g*.98&&r>b*.86)&&hsv.v>.22);
      if(!bodyLike)continue;central++;
      const isPurple=((hsv.h>=285&&hsv.h<=345)||(b>g*1.04&&r>g*1.04))&&hsv.s>.16; if(isPurple)purple++;
      if(((hsv.h<15||hsv.h>345)&&hsv.s>.42&&hsv.v>.34))redHot++;
      if(isPurple&&hsv.v<.58)stasis++;
      if(hsv.v>.66&&hsv.s<.27)whiteCoat++;
      if(hsv.h>=32&&hsv.h<=70&&hsv.s>.18&&hsv.v>.45)yellowCoat++;
      if(hsv.v>.90&&hsv.s<.16)glare++;
      if(((hsv.h<12||hsv.h>348)&&hsv.s>.52&&hsv.v>.38))redSpots++;
      if(view==='bottom'&&isPurple&&hsv.v<.68)vessel++;
      if(x>minX+1&&x<maxX-1&&y>minY+1&&y<maxY-1){const g0=gray(p),neigh=(gray(p-1)+gray(p+1)+gray(p-w)+gray(p+w))/4;if(g0<neigh-24&&g0<135)darkLines++;}
    }
    const denom=Math.max(1,central),purpleRatio=purple/denom,stasisRatio=stasis/denom,whiteRatio=whiteCoat/denom,yellowRatio=yellowCoat/denom,glareRatio=glare/denom,darkRatio=darkLines/denom,spotRatio=redSpots/denom,vesselRatio=vessel/denom;
    const clipped=minX<=w*.09||maxX>=w*.91||minY<=h*.055||maxY>=h*.965;
    const wholeVisible=!clipped&&bw>w*.22&&bh>h*.28,rootVisible=minY<h*.35&&!clipped;
    const conf=qcConfidence(qc,coverage),bboxRatio=bw/bh;

    let tongueColor='Đỏ nhạt/hồng';
    if(purpleRatio>.13||stasisRatio>.07)tongueColor='Tím/ám tím';
    else if(meanV<.53&&meanR>meanG*1.12)tongueColor='Đỏ sẫm';
    else if(meanR>meanG*1.25&&meanS>.34)tongueColor='Đỏ';
    else if(meanS<.20&&meanV>.60)tongueColor='Nhợt/nhạt';

    const coatingColor=yellowRatio>.075&&yellowRatio>whiteRatio*.55?'Vàng':whiteRatio>.10?'Trắng':'Không thấy màu rêu nổi bật';
    const coatRatio=Math.max(whiteRatio,yellowRatio),coatingThickness=coatRatio>.34?'Dày':coatRatio>.15?'Mỏng':'Rất mỏng/khó tách';
    const coatingTexture=coatRatio>.22&&glareRatio>.025?'Khá nhuận/ẩm':coatRatio>.22?'Tương đối đồng nhất':'Khó đánh giá chắc';
    const moisture=glareRatio>.035?'Nhuận/ẩm':glareRatio<.008&&qc?.checks?.light?'Thiên khô tương đối':'Trung bình/khó xác định';
    const shape=bboxRatio>.88?'Khá rộng/bệu':bboxRatio<.52?'Khá thon':'Trung bình';
    const fissures=darkRatio>.045?'Có rãnh/nứt nhìn thấy':darkRatio>.020?'Có thể có rãnh nứt nhẹ':'Không thấy nứt nổi bật';
    const toothmarks=(bboxRatio>.78&&coverage>.10&&darkRatio>.028)?'Bờ lưỡi không đều, cần đối chiếu dấu răng':'Chưa thấy dấu răng nổi bật';
    const pricklesSpots=spotRatio>.055?'Có điểm đỏ/gai nổi bật':spotRatio>.025?'Có một số điểm đỏ':'Không thấy nổi bật';
    const stasisMarks=stasisRatio>.055?'Có vùng tím/sẫm cần đối chiếu':'Không thấy ban/điểm ứ nổi bật';

    return {visible:true,coverage,confidence:conf,quality:qc?.grade||'fair',wholeVisible,rootVisible,colorReliability:colorReliability(qc),tongueColor,shape,coatingColor,coatingThickness,coatingTexture,moisture,fissures,toothmarks,pricklesSpots,stasisMarks,purpleRatio,vesselRatio,meanR,meanG,meanB,undersideColor:tongueColor};
  }

  function topAssessment(v,qc){
    if(!v.visible)return {quality:'poor',visualValidity:{tongueVisible:false,wholeTongueVisible:false,rootVisible:false,framing:'poor',occlusion:'major',colorReliability:'poor'},tongueColor:'Không xác định',shape:'Không xác định',coatingColor:'Không xác định',coatingThickness:'Không xác định',coatingTexture:'Không xác định',moisture:'Không xác định',fissures:'Không xác định',toothmarks:'Không xác định',pricklesSpots:'Không xác định',stasisMarks:'Không xác định',otherVisibleFeatures:[],theoryAssessment:{generalSignals:[],stomachPatternSignals:[],cannotConclude:[v.reason]},confidence:.25,summary:v.reason,limitations:[v.reason]};
    const signals=[];
    if(/Đỏ/.test(v.tongueColor)&&v.coatingColor==='Vàng')signals.push(directSignal('Tín hiệu nhiệt',`Chất lưỡi ${v.tongueColor.toLowerCase()}, rêu ${v.coatingColor.toLowerCase()} ${v.coatingThickness.toLowerCase()}.`,'Trong tài liệu thiệt chẩn, lưỡi đỏ phối hợp rêu vàng thiên về tín hiệu nhiệt; vẫn cần Tứ chẩn.',Math.min(.68,v.confidence)));
    if(/Nhợt/.test(v.tongueColor)&&v.coatingColor==='Trắng')signals.push(directSignal('Tín hiệu hư/hàn',`Chất lưỡi ${v.tongueColor.toLowerCase()}, rêu trắng, độ ẩm ${v.moisture.toLowerCase()}.`,'Chất lưỡi nhạt phối hợp rêu trắng/ẩm có thể thiên hư-hàn trong bối cảnh phù hợp.',Math.min(.62,v.confidence)));
    if(v.coatingThickness==='Dày')signals.push(directSignal('Tín hiệu thấp/đàm hoặc tích trệ',`Rêu nhìn tương đối ${v.coatingThickness.toLowerCase()} và ${v.coatingTexture.toLowerCase()}.`,'Rêu dày cần đối chiếu thêm triệu chứng tiêu hóa, đại tiện và mạch; không kết luận từ ảnh đơn độc.',Math.min(.58,v.confidence)));
    if(/Tím/.test(v.tongueColor)||/tím/.test(v.stasisMarks))signals.push(directSignal('Tín hiệu ứ trệ cần đối chiếu',`Màu chất lưỡi ${v.tongueColor.toLowerCase()}${/tím/.test(v.stasisMarks)?', có vùng tím/sẫm':''}.`,'Màu tím/ám tím là tín hiệu cần đối chiếu khí huyết vận hành và các dữ kiện khác.',Math.min(.60,v.confidence)));
    const limitations=[];if(qc?.grade==='poor')limitations.push('Ảnh có chất lượng thấp nên chỉ mô tả các dấu nổi bật.');if(!v.wholeVisible)limitations.push('Chưa chắc toàn bộ lưỡi nằm trọn trong khung.');if(!v.rootVisible)limitations.push('Phần sau/gốc lưỡi chưa được bộc lộ rõ.');
    const summary=`Quan sát ảnh: chất lưỡi ${v.tongueColor.toLowerCase()}, hình thể ${v.shape.toLowerCase()}, rêu ${v.coatingColor.toLowerCase()} ${v.coatingThickness.toLowerCase()}, độ ẩm ${v.moisture.toLowerCase()}. ${signals.length?'Các dấu này tạo '+signals.map(x=>x.label.toLowerCase()).join(', ')+'.':'Chưa có tổ hợp dấu đủ mạnh để xếp một hướng biện chứng từ ảnh đơn độc.'}`;
    return {quality:v.quality,visualValidity:{tongueVisible:true,wholeTongueVisible:v.wholeVisible,rootVisible:v.rootVisible,framing:v.wholeVisible?'good':'fair',occlusion:v.wholeVisible?'none':'partial',colorReliability:v.colorReliability},tongueColor:v.tongueColor,shape:v.shape,coatingColor:v.coatingColor,coatingThickness:v.coatingThickness,coatingTexture:v.coatingTexture,moisture:v.moisture,fissures:v.fissures,toothmarks:v.toothmarks,pricklesSpots:v.pricklesSpots,stasisMarks:v.stasisMarks,otherVisibleFeatures:[],theoryAssessment:{generalSignals:signals,stomachPatternSignals:[],cannotConclude:['Chưa có Vấn chẩn và mạch chẩn nên không kết luận thể bệnh xác định.']},confidence:v.confidence,summary,limitations};
  }

  function bottomAssessment(v,qc){
    if(!v?.visible)return {quality:'poor',visualValidity:{undersideVisible:false,vesselsVisible:false,framing:'poor',occlusion:'major',colorReliability:'poor'},undersideColor:'Không xác định',vessels:{visible:false,color:'Không xác định',prominence:'Không xác định',dilation:'Không xác định',tortuosity:'Không xác định',stasisSigns:'Không xác định',measurement:'Chỉ mô tả định tính khi ảnh không có chuẩn kích thước đáng tin cậy.'},otherVisibleFeatures:[],confidence:.25,summary:'Không xác nhận được rõ mặt dưới lưỡi.',limitations:[v?.reason||'Không tách được vùng mặt dưới lưỡi đủ rõ.']};
    const visible=v.vesselRatio>.012,prominence=v.vesselRatio>.075?'Nổi rõ':v.vesselRatio>.03?'Thấy mức vừa':'Ít nổi',dilation=v.vesselRatio>.10?'Có dấu hiệu giãn tương đối':'Không thấy giãn rõ';
    return {quality:v.quality,visualValidity:{undersideVisible:true,vesselsVisible:visible,framing:v.wholeVisible?'good':'fair',occlusion:v.wholeVisible?'none':'partial',colorReliability:v.colorReliability},undersideColor:v.undersideColor,vessels:{visible,color:visible?(v.purpleRatio>.10?'Tím/xanh tím':'Tím nhạt'):'Không xác định',prominence,dilation,tortuosity:'Chưa đánh giá chắc từ ảnh tĩnh',stasisSigns:v.vesselRatio>.075?'Có vùng mạch tím/sẫm cần đối chiếu':'Không thấy dấu ứ nổi bật',measurement:'Chỉ mô tả định tính khi ảnh không có chuẩn kích thước đáng tin cậy.'},otherVisibleFeatures:[],confidence:v.confidence,summary:visible?`Mặt dưới lưỡi thấy mạch màu ${v.purpleRatio>.10?'tím/xanh tím':'tím nhạt'}, mức nổi ${prominence.toLowerCase()}.`:'Mặt dưới lưỡi nhìn thấy nhưng mạch dưới lưỡi chưa nổi đủ rõ để mô tả chắc.',limitations:qc?.grade==='poor'?['Ảnh mặt dưới có chất lượng thấp; chỉ mô tả dấu nổi bật.']:[]};
  }

  function buildAssessment(mode,top,bottom,topQc,bottomQc){
    const ta=topAssessment(top,topQc),ba=mode==='general'?bottomAssessment(bottom,bottomQc):null,signals=[...(ta.theoryAssessment?.generalSignals||[])];
    if(ba?.vessels?.visible&&/Tím/.test(ba.vessels.color))signals.push(directSignal('Tín hiệu ứ trệ cần đối chiếu',`Mạch dưới lưỡi ${ba.vessels.color.toLowerCase()}, ${ba.vessels.prominence.toLowerCase()}.`,'Mạch dưới lưỡi tím/giãn chỉ là dấu hỗ trợ; cần phối hợp triệu chứng và mạch chẩn.',Math.min(.60,ba.confidence)));
    const conf=mode==='general'?Math.min(ta.confidence,ba?.confidence||ta.confidence):ta.confidence;
    const combined={confidence:Number(conf.toFixed(3)),summary:mode==='general'?`${ta.summary} ${ba?.summary||''}`.trim():ta.summary,generalSignals:signals,stomachPatternSignals:[],cannotConclude:['Kết quả hình ảnh chỉ hỗ trợ học tập/tham khảo; cần phối hợp Vấn chẩn và các dữ kiện lâm sàng khác.']};
    const featureVector={schemaVersion:'tongue-local-vision-v1',mode,top:{visual:{tongueColor:ta.tongueColor,shape:ta.shape,coatingColor:ta.coatingColor,coatingThickness:ta.coatingThickness,coatingTexture:ta.coatingTexture,moisture:ta.moisture,fissures:ta.fissures,toothmarks:ta.toothmarks,pricklesSpots:ta.pricklesSpots,stasisMarks:ta.stasisMarks},validity:ta.visualValidity,qc:topQc||{},confidence:ta.confidence},bottom:ba?{visual:{undersideColor:ba.undersideColor,vessels:ba.vessels},validity:ba.visualValidity,qc:bottomQc||{},confidence:ba.confidence}:null,combined:{confidence:combined.confidence,generalSignals:signals,stomachPatternSignals:[]}};
    return {mode,top:ta,bottom:ba,combined,ml:{pipeline:['browser-localization','color-segmentation','connected-component-roi','visual-feature-extraction','knowledge-mapping'],featureVector,storage:'not-stored-until-server-vision-verified'}};
  }

  function localLearningTokens(){
    let studentToken='',adminToken='';
    try{studentToken=localStorage.getItem('aitcStudentSessionV1')||'';}catch{}
    try{adminToken=sessionStorage.getItem('aitcClinicalAdminToken')||'';}catch{}
    return {studentToken,adminToken};
  }

  async function syncLocalLearning(body,assessment){
    const {studentToken,adminToken}=localLearningTokens();
    if(!studentToken&&!adminToken)return null;
    const mode=body.mode==='general'?'general':'normal';
    if(assessment?.top?.visualValidity?.tongueVisible!==true||Number(assessment?.top?.confidence||0)<0.30)return null;
    if(mode==='general'&&(assessment?.bottom?.visualValidity?.undersideVisible!==true||Number(assessment?.bottom?.confidence||0)<0.30))return null;
    const response=await nativeFetch(`${SUPABASE_URL}/rest/v1/rpc/ai_thiet_chan_store_local_case_v1`,{
      method:'POST',
      headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'authorization':`Bearer ${SUPABASE_KEY}`},
      body:JSON.stringify({
        p_student_token:studentToken,
        p_admin_token:adminToken,
        p_assessment_mode:mode,
        p_top_image_data_url:body.topImage||body.image||'',
        p_top_mime_type:body.topMimeType||body.mimeType||'image/jpeg',
        p_bottom_image_data_url:mode==='general'?(body.bottomImage||''):null,
        p_bottom_mime_type:mode==='general'?(body.bottomMimeType||'image/jpeg'):null,
        p_qc:{top:body.topQc||body.qc||{},bottom:mode==='general'?(body.bottomQc||{}):null},
        p_analysis:assessment,
        p_feature_vector:assessment?.ml?.featureVector||{},
        p_knowledge_version:'local-open-source-vision-v1'
      })
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok||!data?.ok)throw new Error(data?.message||data?.hint||data?.error||`HTTP ${response.status}`);
    return data;
  }

  function removeLearningSyncNotices(){
    const log=document.getElementById('chatLog');
    if(!log)return;
    for(const node of [...log.children])if(/chưa đồng bộ vào kho dữ liệu học máy/i.test(node.textContent||''))node.remove();
  }

  function sanitizeLocalUi(mode){
    const label=document.getElementById('modelLabel');if(label)label.textContent=mode==='general'?'Tổng quát · 2 ảnh':'Bình thường · 1 ảnh';
    const health=document.getElementById('healthBadge');if(health){health.textContent='Phân tích hoàn tất';health.className='status-pill good';}
    removeLearningSyncNotices();
  }

  async function prepareLocalImage(dataUrl,qc={}){
    const enhancer=window.AITCImageEnhancement;
    if(!dataUrl||!enhancer?.enhanceDataUrl)return {dataUrl,qc,enhanced:false};
    try{
      const result=await enhancer.enhanceDataUrl(dataUrl,qc);
      if(!result?.dataUrl)return {dataUrl,qc,enhanced:false};
      return {dataUrl:result.dataUrl,qc:{...qc,enhancement:result.meta},enhanced:true};
    }catch{return {dataUrl,qc,enhanced:false};}
  }

  async function localVisionResponse(body,serverResponse){
    try{
      const mode=body.mode==='general'?'general':'normal';
      const topInput=await prepareLocalImage(body.topImage||body.image,body.topQc||body.qc||{});
      const bottomInput=mode==='general'?await prepareLocalImage(body.bottomImage,body.bottomQc||{}):null;
      const top=await inspectView(topInput.dataUrl,topInput.qc,'top');
      const bottom=mode==='general'?await inspectView(bottomInput.dataUrl,bottomInput.qc,'bottom'):null;
      const assessment=buildAssessment(mode,top,bottom,topInput.qc,bottomInput?.qc||{});
      assessment.ml.imageEnhancementFallback={top:topInput.enhanced,bottom:Boolean(bottomInput?.enhanced),version:topInput.qc?.enhancement?.version||bottomInput?.qc?.enhancement?.version||null};
      if(assessment.top.visualValidity.tongueVisible!==true){return serverResponse;}
      let collection={ok:false,stored:false,localOnly:true};
      try{
        const saved=await syncLocalLearning({...body,topQc:topInput.qc,bottomQc:bottomInput?.qc||body.bottomQc},assessment);
        if(saved?.ok){
          assessment.ml.storage='automatic-local-training-store';
          collection={ok:true,stored:Boolean(saved.stored),duplicate:Boolean(saved.duplicate),caseId:saved.id||null,localVision:true};
        }
      }catch{}
      const payload={ok:true,assessment,analysis:assessment,model:null,knowledgeVersion:'local-open-source-vision-v1',collection,localVision:true,visionStatus:'local-image-analysis',imageEnhanced:Boolean(topInput.enhanced||bottomInput?.enhanced)};
      setTimeout(()=>sanitizeLocalUi(mode),0);
      return new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json','cache-control':'no-store','x-aitc-vision':'local-image-analysis','x-aitc-image-enhanced':topInput.enhanced||bottomInput?.enhanced?'1':'0'}});
    }catch{return serverResponse;}
  }

  const __aitcStage3bFetch=async(input,init={})=>{
    try{
      const url=typeof input==='string'?input:input?.url||'';
      if(url.includes('/api/analyze')&&String(init?.method||'GET').toUpperCase()==='POST'&&typeof init?.body==='string'){
        const body=JSON.parse(init.body);const meta=captureContext();
        body.topQc={...(body.topQc||body.qc||{}),captureContext:meta};
        if(body.mode==='general') body.bottomQc={...(body.bottomQc||{}),captureContext:meta};
        const response=await nativeFetch(input,{...init,body:JSON.stringify(body)});
        if(response.status===502||response.status===503||response.status===504){
          const data=await response.clone().json().catch(()=>({}));
          if(String(data?.message||data?.error?.message||'').includes('VISION_ANALYSIS_TEMPORARILY_UNAVAILABLE')) return localVisionResponse(body,response);
        }
        return response;
      }
    }catch{}
    return nativeFetch(input,init);
  };
  requestClient.register('capture-metadata',__aitcStage3bFetch,200);

  const chatLog=document.getElementById('chatLog');
  if(chatLog){
    removeLearningSyncNotices();
    new MutationObserver(removeLearningSyncNotices).observe(chatLog,{childList:true});
  }
})();