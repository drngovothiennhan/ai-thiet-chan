export const MORPHOLOGY_STANDARD_DOCUMENTS=Object.freeze([
  {id:'MR01',title:'AITC morphology synthesis from user-provided tongue-diagnosis documents',role:'internal-reference-synthesis',policy:'paraphrased-derived-rules'},
  {id:'MR02',title:'Tongue shape classification based on IF-RCNet',pmid:'40025207',pmcid:'PMC11873170',doi:'10.1038/s41598-025-91823-1',year:2025,role:'shape-segmentation-classification',policy:'metadata+paraphrased-evidence'},
  {id:'MR03',title:'Weakly Supervised Deep Learning for Tooth-Marked Tongue Recognition',pmid:'35492602',pmcid:'PMC9039050',doi:'10.3389/fphys.2022.847267',year:2022,role:'toothmark-recognition-localization',policy:'metadata+paraphrased-evidence'},
  {id:'MR04',title:'Artificial intelligence in tongue diagnosis: tooth-mark recognition',pmid:'32368332',pmcid:'PMC7186367',doi:'10.1016/j.csbj.2020.04.002',year:2020,role:'toothmark-cnn',policy:'metadata+paraphrased-evidence'},
  {id:'MR05',title:'Tongue feature dataset construction and real-time detection',pmid:'38452007',pmcid:'PMC10919637',doi:'10.1371/journal.pone.0296070',year:2024,role:'feature-object-detection',policy:'metadata+paraphrased-evidence'},
  {id:'MR06',title:'Deep Learning Multi-label Tongue Image Analysis',pmid:'36212950',pmcid:'PMC9536899',doi:'10.1155/2022/3384209',year:2022,role:'expert-annotated-multilabel-features',policy:'metadata+paraphrased-evidence'},
  {id:'MR07',title:'ISO 23961-1:2021 Traditional Chinese medicine — Vocabulary for diagnostics — Part 1: Tongue',year:2021,role:'terminology-standard',policy:'terminology-paraphrase-only'}
]);

export const MORPHOLOGY_STANDARD_EVIDENCE=Object.freeze([
  {id:'MR01-E01',source:'MR01',topics:['hình thể','mập','gầy','dấu răng'],ontology:['tongue_body.shape','surface.toothmarks'],evidenceType:'internal-synthesis',text:'Tài liệu nội bộ mô tả lưỡi mập/to và gầy/mỏng như đặc điểm hình thể, đồng thời xem dấu răng ở rìa là một đặc điểm riêng; không nên đồng nhất một tỷ lệ hình học duy nhất với chẩn thể.'},
  {id:'MR01-E02',source:'MR01',topics:['bình thường','hình thể'],ontology:['tongue_body.shape'],evidenceType:'internal-synthesis',text:'Mốc bình thường là hình thể tương đối mềm mại, không quá thon cũng không quá bệu; đánh giá cần đặt trong bối cảnh tư thế và độ bộc lộ toàn bộ lưỡi.'},
  {id:'MR02-E01',source:'MR02',locator:'PMID 40025207',topics:['hình thể','mập','bình thường','gầy','phân đoạn','môi che'],ontology:['tongue_body.shape','acquisition.occlusion'],evidenceType:'classification-study',text:'Nghiên cứu phân loại hình thể dùng bước phân đoạn lưỡi trước phân loại và nhấn mạnh môi che, khác biệt cá thể và dữ liệu nhỏ là các nguồn gây nhầm giữa lưỡi mập, bình thường và gầy.'},
  {id:'MR02-E02',source:'MR02',locator:'PMID 40025207',topics:['shape model','feature fusion'],ontology:['tongue_body.shape','vision.pipeline'],evidenceType:'classification-study',text:'Hình thể nên được nhận diện từ nhiều đặc trưng sau phân đoạn thay vì một tỷ lệ rộng-dài đơn độc; feature fusion giúp giảm nhầm giữa các nhóm hình thể gần nhau.'},
  {id:'MR03-E01',source:'MR03',locator:'PMID 35492602',topics:['dấu răng','bờ lưỡi','lõm','màu tối','tooth marks'],ontology:['surface.toothmarks'],evidenceType:'recognition-study',text:'Tiêu chí nhận diện dấu răng tập trung vào biến dạng/lõm do răng ép ở bờ bên; khi lõm không rõ, vùng nghi ngờ có thể có thay đổi màu tối hơn và được dùng như tín hiệu hỗ trợ.'},
  {id:'MR03-E02',source:'MR03',locator:'PMID 35492602',topics:['dấu răng','localization','weak supervision'],ontology:['surface.toothmarks','vision.pipeline'],evidenceType:'recognition-study',text:'Mô hình dấu răng có giá trị hơn khi vừa phân loại vừa định vị vùng nghi ngờ; nhãn ảnh tổng thể đơn độc làm giảm khả năng giải thích.'},
  {id:'MR04-E01',source:'MR04',locator:'PMID 32368332',topics:['dấu răng','ROI','ánh sáng','CNN'],ontology:['surface.toothmarks','acquisition.qc'],evidenceType:'classification-study',text:'Tách vùng lưỡi khỏi nền cải thiện nhận diện dấu răng; thay đổi thiết bị và ánh sáng là biến nhiễu cần được kiểm soát khi đánh giá khả năng tổng quát.'},
  {id:'MR05-E01',source:'MR05',locator:'PMID 38452007',topics:['dấu răng','nứt','object detection','annotation'],ontology:['surface.toothmarks','surface.fissure','dataset.annotation'],evidenceType:'object-detection-study',text:'Dấu răng và các đặc trưng khu trú có thể được chú thích theo vùng và phát hiện như đối tượng; điều này ủng hộ việc giữ riêng tín hiệu vị trí/bờ thay vì chỉ trả nhãn toàn ảnh.'},
  {id:'MR06-E01',source:'MR06',locator:'PMID 36212950',topics:['đa nhãn','dấu răng','hình thể','feature'],ontology:['surface.toothmarks','tongue_body.shape'],evidenceType:'multilabel-study',text:'Các đặc trưng lưỡi có thể đồng thời tồn tại và nên được biểu diễn đa nhãn; dấu răng không nên làm mất các trường hình thể, màu, rêu hoặc nứt.'},
  {id:'MR07-E01',source:'MR07',topics:['enlarged tongue','thin tongue','kích thước','độ dày'],ontology:['tongue_body.shape','tongue_body.size'],evidenceType:'terminology-standard',text:'Chuẩn thuật ngữ phân biệt lưỡi to/mập với lưỡi gầy/mỏng theo kích thước và độ dày so với bình thường; vì ảnh mặt trên 2D không chuẩn tỷ lệ không đo trực tiếp độ dày, hệ thống chỉ được mô tả rộng/hẹp tương đối trừ khi có chuẩn đo phù hợp.'},
  {id:'MR07-E02',source:'MR07',topics:['dấu răng','hình thể'],ontology:['surface.toothmarks','tongue_body.shape'],evidenceType:'terminology-standard',text:'Dấu răng được xem là một đặc điểm hình thể riêng; hệ thống phải tách nhãn dấu răng khỏi nhãn mập/gầy và không suy dấu răng chỉ từ bản lưỡi rộng.'}
]);

export const MORPHOLOGY_STANDARD_POLICY=Object.freeze({
  version:'aitc-morphology-knowledge-v1',
  llmRole:'retrieval/reference teaching',
  visionRole:'shadow comparator',
  productionAuthority:false,
  clinicalGold:false,
  absoluteSizeFromUnscaled2d:false,
  toothmarkPrimarySignal:'repeated lateral contour indentation',
  toothmarkSecondarySignal:'localized darker edge color',
  forcedSyndromeInference:false
});
