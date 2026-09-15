(()=>{
  const $=id=>document.getElementById(id);
  const els={
    total:$('qualityTotal'),general:$('qualityGeneral'),qc:$('qualityQc'),confidence:$('qualityConfidence'),
    dataState:$('qualityDataState'),device:$('qualityDevice'),camera:$('qualityCamera'),pwa:$('qualityPwa'),refresh:$('qualityRefreshBtn')
  };
  if(!els.total) return;
  let loaded=false;
  const pct=n=>`${Math.round(Math.max(0,Math.min(1,Number(n)||0))*100)}%`;
  const grid=els.total.closest('.quality-grid');
  function ensureMetric(id,label){
    let value=$(id);if(value)return value;
    if(!grid)return null;
    const card=document.createElement('div');card.className='quality-metric';
    const span=document.createElement('span');span.textContent=label;
    value=document.createElement('strong');value.id=id;value.textContent='…';
    card.append(span,value);grid.appendChild(card);return value;
  }
  const pipelineMetric=ensureMetric('qualityPipeline','Ca theo pipeline chuẩn');
  const legacyMetric=ensureMetric('qualityLegacy','Ca legacy/local cần loại khỏi đánh giá');
  const knowledgeMetric=ensureMetric('qualityKnowledge','Knowledge 5-doc');
  const providerMetric=ensureMetric('qualityProvider','A.I thị giác');
  function deviceClass(){
    const ua=navigator.userAgent||'';
    if(/Android/i.test(ua)) return 'Android';
    if(/iPhone|iPad|iPod/i.test(ua)) return 'iOS/iPadOS';
    if(/Windows/i.test(ua)) return 'Windows';
    if(/Macintosh|Mac OS X/i.test(ua)) return 'macOS';
    if(/Linux/i.test(ua)) return 'Linux';
    return 'Thiết bị khác';
  }
  function renderDevice(){
    els.device.textContent=deviceClass();
    els.camera.textContent=navigator.mediaDevices?.getUserMedia?'Camera API sẵn sàng':'Không có Camera API';
    const standalone=window.matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone===true;
    els.pwa.textContent=standalone?'Đang chạy dạng ứng dụng':'Đang chạy trong trình duyệt';
  }
  function isLegacyCase(item){
    const model=String(item?.model||'').toLowerCase();
    const knowledge=String(item?.knowledge_version||'').toLowerCase();
    return model.includes('browser-local-vision')||knowledge.includes('local-open-source-vision');
  }
  async function load(){
    if(els.refresh) els.refresh.disabled=true;
    try{
      const [casesResponse,healthResponse]=await Promise.all([
        fetch('/api/cases?limit=100',{cache:'no-store'}),fetch('/api/health',{cache:'no-store'})
      ]);
      const casesData=await casesResponse.json();const health=await healthResponse.json();
      if(!casesResponse.ok) throw new Error(casesData?.error||`HTTP ${casesResponse.status}`);
      if(!healthResponse.ok||!health?.ok) throw new Error(health?.error||`HTTP ${healthResponse.status}`);
      const cases=Array.isArray(casesData.cases)?casesData.cases:[];
      const total=cases.length;
      const general=cases.filter(x=>x.assessment_mode==='general').length;
      const goodTop=cases.filter(x=>x.top_qc_grade==='good').length;
      const qcCandidate=cases.filter(x=>x.top_qc_grade!=='poor'&&(x.assessment_mode!=='general'||x.bottom_qc_grade!=='poor')).length;
      const legacy=cases.filter(isLegacyCase).length;
      const canonical=Math.max(0,total-legacy);
      const knowledgeOk=Boolean(health?.academicVision?.sourceCount===5&&health?.academicVision?.noSilentOmission===true&&health?.academicVision?.allPagesIndexed===true&&health?.academicVision?.allEmbeddedImageOccurrencesIndexed===true);
      els.total.textContent=String(total);
      els.general.textContent=total?`${general}/${total}`:'0';
      els.qc.textContent=total?pct(goodTop/total):'—';
      els.confidence.textContent=total?pct(qcCandidate/total):'—';
      const metricLabel=els.confidence.closest('.quality-metric')?.querySelector('span');if(metricLabel)metricLabel.textContent='Ca đạt QC tối thiểu';
      if(pipelineMetric)pipelineMetric.textContent=total?`${canonical}/${total}`:'—';
      if(legacyMetric)legacyMetric.textContent=String(legacy);
      if(knowledgeMetric)knowledgeMetric.textContent=knowledgeOk?'5/5 · toàn vẹn':'Chưa đạt';
      if(providerMetric)providerMetric.textContent=health.providerConfigured?String(health.model||'Đã cấu hình'):'Chưa cấu hình';
      const legacyText=legacy?` Có ${legacy} ca legacy/local trong lịch sử; các ca này không được xem là ground truth và phải tách khỏi đánh giá pipeline chuẩn.`:'';
      els.dataState.textContent=total
        ?`Kho hiện có ${total} ca. ${qcCandidate}/${total} ca đạt bộ lọc QC tối thiểu; ${canonical}/${total} ca thuộc pipeline chuẩn hiện hành.${legacyText} Knowledge 5-doc: ${knowledgeOk?'đủ 5 nguồn và không bỏ ngầm dữ liệu':'chưa đạt gate toàn vẹn'}. Production chưa có nhãn đồng thuận chuyên gia nên các chỉ số này không phải độ chính xác chẩn đoán.`
        :`Kho chưa có ca. Knowledge 5-doc: ${knowledgeOk?'đủ 5 nguồn và không bỏ ngầm dữ liệu':'chưa đạt gate toàn vẹn'}. Chưa có dữ liệu để đánh giá pipeline lịch sử.`;
      els.dataState.classList.toggle('warn',true);loaded=true;
    }catch{
      els.total.textContent=els.general.textContent=els.qc.textContent=els.confidence.textContent='—';
      if(pipelineMetric)pipelineMetric.textContent='—';if(legacyMetric)legacyMetric.textContent='—';if(knowledgeMetric)knowledgeMetric.textContent='—';if(providerMetric)providerMetric.textContent='—';
      els.dataState.textContent='Không tải được thống kê dữ liệu lúc này. Chức năng phân tích chính không bị ảnh hưởng.';
      els.dataState.classList.toggle('warn',true);
    }finally{if(els.refresh)els.refresh.disabled=false;}
  }
  renderDevice();
  els.dataState.textContent='Nhấn “Xem” để tải thống kê hệ thống và dữ liệu.';
  window.addEventListener('aitc:quality-open',()=>{if(!loaded)load();});
  els.refresh?.addEventListener('click',load);
})();
