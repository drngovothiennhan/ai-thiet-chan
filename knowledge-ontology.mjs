export const TONGUE_ONTOLOGY_V1 = Object.freeze([
  {id:'acquisition.qc',label:'Chất lượng thu ảnh',aliases:['qc','chất lượng ảnh','ánh sáng','góc chụp','focus','mờ','cháy sáng','ám màu','camera','white balance','filter']},
  {id:'acquisition.color',label:'Chuẩn hóa màu',aliases:['màu','hiệu chỉnh màu','color correction','icc','d65','white balance','color fidelity']},
  {id:'acquisition.occlusion',label:'Che khuất',aliases:['môi che','răng che','che khuất','occlusion']},
  {id:'normal_anatomy.papillae',label:'Giải phẫu và nhú lưỡi sinh lý',aliases:['nhú lưỡi','nhú dạng chỉ','nhú dạng nấm','papillae','giải phẫu lưỡi','sinh lý']},
  {id:'tongue_body.core',label:'Thân lưỡi',aliases:['thân lưỡi','chất lưỡi','tongue body']},
  {id:'tongue_body.color',label:'Màu chất lưỡi',aliases:['đỏ nhạt','nhợt','đỏ','đỏ sẫm','tím','xanh tím','màu lưỡi','tongue color']},
  {id:'tongue_body.shape',label:'Hình thể lưỡi',aliases:['hình thể','mập','bệu','to','gầy','mỏng','shape','swollen','thin tongue']},
  {id:'tongue_body.motion',label:'Vận động lưỡi',aliases:['run','lệch','co rút','đơ','liệt mềm','vận động lưỡi','motion']},
  {id:'surface.texture',label:'Kết cấu bề mặt',aliases:['kết cấu','texture','bề mặt']},
  {id:'surface.fissure',label:'Rãnh/nứt',aliases:['nứt','rãnh nứt','fissure','crack','cracked tongue','rãnh giữa','median sulcus']},
  {id:'surface.toothmarks',label:'Dấu răng',aliases:['dấu răng','hằn răng','tooth marks','tooth-marked']},
  {id:'surface.spots',label:'Điểm/gai/ban',aliases:['điểm đỏ','gai đỏ','ban','ứ điểm','ecchymosis','red dots','spots']},
  {id:'coating.core',label:'Rêu lưỡi',aliases:['rêu lưỡi','tongue coating','fur']},
  {id:'coating.color',label:'Màu rêu',aliases:['rêu trắng','rêu vàng','rêu xám','rêu đen','coating color']},
  {id:'coating.segmentation',label:'Phân đoạn rêu',aliases:['phân đoạn rêu','coating segmentation','vùng rêu']},
  {id:'coating.moisture',label:'Độ ẩm rêu',aliases:['nhuận','khô','trơn','ẩm','moisture','dry coating','slippery']},
  {id:'coating.biologic_basis',label:'Cơ sở sinh học rêu',aliases:['biểu mô bong','vi khuẩn miệng','nước bọt','saliva','oral bacteria']},
  {id:'coating.peeling',label:'Rêu bong/tróc',aliases:['bong rêu','tróc rêu','peeling coating','geographic']},
  {id:'sublingual.veins',label:'Tĩnh mạch dưới lưỡi',aliases:['tĩnh mạch dưới lưỡi','mạch dưới lưỡi','sublingual veins','varices','giãn tĩnh mạch']},
  {id:'vision.segmentation',label:'Phân đoạn thân lưỡi',aliases:['phân đoạn','segmentation','tongue segmentation']},
  {id:'vision.pipeline',label:'Pipeline thị giác',aliases:['tiền xử lý','phát hiện','phân đoạn','trích đặc trưng','phân loại','pipeline','feature extraction']},
  {id:'dataset.annotation',label:'Nhãn chuyên gia',aliases:['annotation','nhãn chuyên gia','gold label','adjudication']},
  {id:'dataset.quality',label:'Chất lượng dataset',aliases:['dataset','data leakage','chống leakage','split','holdout','ground truth']},
  {id:'dataset.active_learning',label:'Active/weak learning',aliases:['active learning','weak supervision','pseudo label','semi-supervised']},
  {id:'reliability.observer',label:'Độ tin cậy người đánh giá',aliases:['inter-rater','intra-rater','đồng thuận','kappa','reliability']},
  {id:'reliability.human_machine',label:'Đồng thuận người-máy',aliases:['human machine','ATDS','agreement','đồng thuận hệ thống bác sĩ']},
  {id:'evaluation.reliability',label:'Độ tin cậy đánh giá mô hình',aliases:['metric','accuracy','auc','validation','external validation','generalization']},
  {id:'reasoning.multimodal',label:'Tứ chẩn / hợp nhất đa nguồn',aliases:['tứ chẩn','vọng văn vấn thiết','thập vấn','multimodal','hợp nhất dữ kiện']},
  {id:'evidence.limitations',label:'Giới hạn bằng chứng',aliases:['giới hạn','uncertain','không đủ căn cứ','không chẩn đoán','limitations']},
  {id:'condition_association.gastric',label:'Liên hệ nghiên cứu dạ dày',aliases:['dạ dày','gastric','ung thư dạ dày']},
  {id:'condition_association.diabetes',label:'Liên hệ nghiên cứu đái tháo đường',aliases:['đái tháo đường','diabetes']},
  {id:'condition_association.cancer',label:'Liên hệ nghiên cứu ung thư',aliases:['ung thư','cancer']}
]);

function norm(value){
  return String(value||'').toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s-]/g,' ').replace(/\s+/g,' ').trim();
}

export function ontologyTokensForQuery(query){
  const q=norm(query);
  if(!q)return[];
  const out=new Set();
  for(const node of TONGUE_ONTOLOGY_V1){
    const hit=(node.aliases||[]).some(alias=>q.includes(norm(alias)));
    if(!hit)continue;
    for(const token of norm(node.id+' '+node.label+' '+node.aliases.join(' ')).split(' ')){
      if(token.length>=3)out.add(token);
    }
  }
  return [...out];
}

export const TONGUE_ONTOLOGY_MANIFEST = Object.freeze({
  id:'aitc-tongue-ontology-v1',
  nodeCount:TONGUE_ONTOLOGY_V1.length,
  principle:'Observation -> standardized feature -> evidence/limitation -> conditional YHCT interpretation; disease-specific papers remain association-only.',
  imageAuthority:'Local Vision',
  llmRole:'Retrieve and interpret structured observations; never invent a visual feature.'
});
