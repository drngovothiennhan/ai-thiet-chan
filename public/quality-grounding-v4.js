(()=>{
  'use strict';

  const VERSION='quality-grounding-v4.0.0';
  const previousFetch=window.fetch.bind(window);
  const originalAcceptImage=window.acceptImage;
  const originalComputeQc=window.computeQc;
  const originalRenderQc=window.renderQc;
  const ATLAS_VISIBLE_THRESHOLD=.72;
  const MAX_NOTE_CHARS=900;

  const checkLabels={resolution:'độ phân giải',light:'ánh sáng',dynamic:'tương phản',focus:'độ nét',clipping:'cháy/tối'};
  const gradeRank={poor:0,fair:1,good:2};

  function clamp(v,min=0,max=1){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):min;}
  function isAnalyze(url,method){
    try{const u=new URL(url,location.href);return u.origin===location.origin&&u.pathname==='/api/analyze'&&String(method||'GET').toUpperCase()==='POST';}
    catch{return false;}
  }
  function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
  function failedChecks(qc){return Object.entries(qc?.checks||{}).filter(([,ok])=>!ok).map(([key])=>checkLabels[key]||key);}
  function passedCount(qc){return Object.values(qc?.checks||{}).filter(Boolean).length;}
  function meaningfulImprovement(before,after){
    if((gradeRank[after?.grade]??-1)>(gradeRank[before?.grade]??-1))return true;
    if(passedCount(after)>passedCount(before))return true;
    if(after?.grade!==before?.grade)return false;
    const focusGain=Number(after?.laplacianVariance||0)-Number(before?.laplacianVariance||0);
    const contrastGain=Number(after?.contrast||0)-Number(before?.contrast||0);
    const lightBefore=Number(before?.brightness||0),lightAfter=Number(after?.brightness||0);
    const lightDistanceBefore=Math.abs(lightBefore-130),lightDistanceAfter=Math.abs(lightAfter-130);
    return focusGain>=12||contrastGain>=7||lightDistanceBefore-lightDistanceAfter>=12;
  }
  async function measureQc(dataUrl){
    if(typeof originalComputeQc!=='function')return null;
    const img=await loadImage(dataUrl),max=1440,scale=Math.min(1,max/Math.max(img.width,img.height));
    const w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const ctx=c.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,w,h);
    return originalComputeQc(ctx,w,h);
  }
  function remediationMeta(before,after,enhancement,applied){
    return {
      version:VERSION,
      attempted:true,
      applied:Boolean(applied),
      beforeGrade:before?.grade||'unknown',
      afterGrade:after?.grade||before?.grade||'unknown',
      beforeFailed:failedChecks(before),
      afterFailed:failedChecks(after||before),
      recoveredChecks:Object.keys(before?.checks||{}).filter(k=>before?.checks?.[k]===false&&after?.checks?.[k]===true).map(k=>checkLabels[k]||k),
      nonGenerative:true,
      colorIntegrityGuard:true,
      enhancement:enhancement?{
        profile:enhancement.profile||null,
        gamma:enhancement.gamma??null,
        contrastGain:enhancement.contrastGain??null,
        sharpenApplied:Boolean(enhancement.sharpenApplied),
        colorDrift:enhancement.colorDrift??null,
        glareDeltaPct:enhancement.glareDeltaPct??null,
        rollback:Boolean(enhancement.rollback),
        rollbackReason:Array.isArray(enhancement.rollbackReason)?enhancement.rollbackReason:[]
      }:null
    };
  }

  if(typeof originalAcceptImage==='function'&&typeof originalComputeQc==='function'){
    window.acceptImage=async function(target,dataUrl,mimeType,captureMeta={source:'upload',facingMode:'unknown'}){
      let chosen=dataUrl,meta={...captureMeta},before=null,after=null,enhancement=null,applied=false;
      try{
        before=await measureQc(dataUrl);
        const failures=failedChecks(before);
        const recoverable=before?.checks?.resolution===true&&failures.some(x=>['ánh sáng','tương phản','độ nét','cháy/tối'].includes(x));
        if(before&&before.grade!=='good'&&recoverable&&window.AITCImageEnhancement?.enhanceDataUrl){
          const candidate=await window.AITCImageEnhancement.enhanceDataUrl(dataUrl,{...before,capture:{...captureMeta,frontCamera:captureMeta?.facingMode==='user'}});
          enhancement=candidate?.meta||null;
          if(candidate?.dataUrl&&enhancement?.rollback!==true){
            after=await measureQc(candidate.dataUrl);
            if(meaningfulImprovement(before,after)){chosen=candidate.dataUrl;applied=true;}
          }
        }
        if(!after)after=before;
        meta.qualityRemediation=remediationMeta(before,applied?after:before,enhancement,applied);
      }catch(err){
        meta.qualityRemediation={version:VERSION,attempted:true,applied:false,error:String(err?.message||err),nonGenerative:true,colorIntegrityGuard:true};
      }
      return originalAcceptImage.call(this,target,chosen,mimeType,meta);
    };
  }

  if(typeof originalRenderQc==='function'){
    window.renderQc=function(q,chips){
      originalRenderQc(q,chips);
      if(!q||!chips)return;
      const remediation=q?.capture?.qualityRemediation;
      const failed=failedChecks(q);
      if(remediation?.applied){
        const recovered=Array.isArray(remediation.recoveredChecks)&&remediation.recoveredChecks.length?remediation.recoveredChecks.join(', '):'chất lượng ảnh';
        chips.insertAdjacentHTML('beforeend',`<span class="chip good">✓ Đã tự tối ưu: ${recovered}</span>`);
      }
      if(q.grade!=='good'){
        const reason=failed.length?failed.join(', '):'điều kiện ảnh';
        chips.insertAdjacentHTML('beforeend',`<span class="chip warn">↻ Cần chụp lại: ${reason}</span>`);
      }
    };
  }

  function qualityText(current,qc){
    if(String(current||'').toLowerCase()!=='fair')return current;
    const failed=failedChecks(qc);
    const rem=qc?.capture?.qualityRemediation;
    if(rem?.applied&&qc?.grade==='good')return 'Tốt · đã tự tối ưu ảnh trước phân tích';
    return `Trung bình · cần chụp lại: ${failed.length?failed.join(', '):'điều kiện ảnh chưa đạt đủ'}`;
  }
  function colorReliabilityText(current,qc){
    if(String(current||'').toLowerCase()!=='fair')return current;
    const colorIssues=[];
    if(qc?.checks?.light===false)colorIssues.push('ánh sáng');
    if(qc?.checks?.clipping===false)colorIssues.push('cháy/tối');
    const drift=Number(qc?.capture?.qualityRemediation?.enhancement?.colorDrift);
    if(Number.isFinite(drift)&&drift>.022)colorIssues.push('sai lệch màu');
    return colorIssues.length?`Trung bình · cần xử lý lại ${colorIssues.join(', ')}`:'Khá · màu qua kiểm soát, hạn chế còn lại không thuộc màu';
  }
  function annotateQuality(assessment,body){
    if(!assessment||typeof assessment!=='object')return assessment;
    const topQc=body?.topQc||body?.qc||{},bottomQc=body?.bottomQc||{};
    if(assessment.top){
      assessment.top.quality=qualityText(assessment.top.quality,topQc);
      if(assessment.top.visualValidity)assessment.top.visualValidity.colorReliability=colorReliabilityText(assessment.top.visualValidity.colorReliability,topQc);
    }
    if(assessment.bottom){
      assessment.bottom.quality=qualityText(assessment.bottom.quality,bottomQc);
      if(assessment.bottom.visualValidity)assessment.bottom.visualValidity.colorReliability=colorReliabilityText(assessment.bottom.visualValidity.colorReliability,bottomQc);
    }
    return assessment;
  }
  function safeText(v,max=MAX_NOTE_CHARS){const s=String(v||'').replace(/\s+/g,' ').trim();return s.length>max?`${s.slice(0,max-1)}…`:s;}
  function unshiftUnique(list,item,key){
    const k=key(item);const filtered=list.filter(x=>key(x)!==k);filtered.unshift(item);return filtered;
  }
  function injectGroundedEvidence(assessment){
    if(!assessment?.combined)return assessment;
    let signals=Array.isArray(assessment.combined.generalSignals)?assessment.combined.generalSignals.slice():[];

    const learned=Array.isArray(assessment.approvedClinicalKnowledge)?assessment.approvedClinicalKnowledge:[];
    for(const row of learned.slice(0,2).reverse()){
      const similarity=clamp(row?.similarity),pct=Math.round(similarity*100),note=safeText(row?.clinicalNote||row?.clinical_note);
      if(!note)continue;
      const item={
        label:`Ca đã duyệt tương đồng ${pct}%`,
        evidence:note,
        rule:`Nội dung từ ca lâm sàng đã được admin duyệt${row?.knowledgeRevision||row?.knowledge_revision?` · bản học #${row.knowledgeRevision||row.knowledge_revision}`:''}; chỉ áp dụng vì feature-vector của ca hiện tại đạt mức tương đồng đã lưu, không tự thêm triệu chứng.`,
        confidence:similarity
      };
      signals=unshiftUnique(signals,item,x=>String(x?.label||''));
    }

    const af=assessment.combined.academicFusion||assessment?.ml?.academicFusion||null;
    const atlas=Array.isArray(af?.atlasMatches)?af.atlasMatches:[];
    const topAtlas=atlas[0]||null;
    const atlasSimilarity=clamp(topAtlas?.similarity);
    const accepted=Array.isArray(af?.acceptedPatterns)?af.acceptedPatterns:[];
    const atlasLanguage=af?.atlasLanguage||null;

    if(atlasLanguage?.applied&&atlasLanguage?.wording){
      const pct=Math.round(clamp(atlasLanguage.similarity)*100),source=atlasLanguage.sourceId||topAtlas?.sourceId||'tài liệu đã nạp',page=atlasLanguage.page||topAtlas?.page||'—';
      const item={
        label:`Y văn đã nạp · ảnh tương đồng ${pct}%`,
        evidence:safeText(atlasLanguage.wording,980),
        rule:`Đối chiếu trực tiếp mẫu hình trong ${source}, trang ${page}. Văn bản lấy từ corpus đã nạp; độ giống ảnh chỉ là bằng chứng tham chiếu, không tự chuyển thành bệnh danh.`,
        confidence:clamp(atlasLanguage.similarity)
      };
      signals=unshiftUnique(signals,item,x=>String(x?.label||''));
    }else if(topAtlas&&atlasSimilarity>=ATLAS_VISIBLE_THRESHOLD&&accepted.length){
      const evidence=(Array.isArray(af?.evidence)?af.evidence:[]).find(x=>safeText(x?.text));
      if(evidence){
        const pct=Math.round(atlasSimilarity*100),atlasSource=topAtlas.sourceId||topAtlas.id||'atlas',atlasPage=topAtlas.page||'—';
        const item={
          label:`Y văn đã nạp · ảnh tương đồng ${pct}%`,
          evidence:safeText(evidence.text),
          rule:`Ảnh gần nhất: ${atlasSource}, trang ${atlasPage} (${pct}%). Y văn đối chiếu: ${evidence.source||'tài liệu đã nạp'}, trang ${evidence.page||'—'}. Chỉ hiển thị khi atlas ≥ ${Math.round(ATLAS_VISIBLE_THRESHOLD*100)}% và có mẫu nhận định đa lớp đã được chấp nhận.`,
          confidence:atlasSimilarity
        };
        signals=unshiftUnique(signals,item,x=>String(x?.label||''));
      }
    }

    assessment.combined.generalSignals=signals;
    return assessment;
  }
  async function requestBodyOf(input,init){
    try{
      if(input instanceof Request)return await input.clone().json();
      if(typeof init?.body==='string')return JSON.parse(init.body);
      return init?.body&&typeof init.body==='object'?init.body:null;
    }catch{return null;}
  }

  window.fetch=async(input,init)=>{
    const url=input instanceof Request?input.url:String(input||''),method=input instanceof Request?input.method:(init?.method||'GET');
    if(!isAnalyze(url,method))return previousFetch(input,init);
    const body=await requestBodyOf(input,init);
    const response=await previousFetch(input,init);
    if(!response.ok)return response;
    try{
      const data=await response.clone().json();
      let assessment=data?.assessment||data?.analysis||null;
      if(!assessment)return response;
      assessment=injectGroundedEvidence(annotateQuality(assessment,body||{}));
      data.assessment=assessment;data.analysis=assessment;data.qualityGrounding={version:VERSION,atlasVisibleThreshold:ATLAS_VISIBLE_THRESHOLD,nonGenerative:true};
      const headers=new Headers(response.headers);headers.delete('content-length');headers.set('x-aitc-quality-grounding',VERSION);
      return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers});
    }catch{return response;}
  };

  window.AITCQualityGrounding=Object.freeze({version:VERSION,atlasVisibleThreshold:ATLAS_VISIBLE_THRESHOLD,failedChecks});
})();
