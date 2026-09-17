export const FUSION_VERSION='academic-fusion-v1.2-knowledge-5doc-complete';
export const KNOWLEDGE_VERSION='thiet-chan-kb-2026-09-15.5doc';
export const SOURCE=Object.freeze({
  id:'KNOWLEDGE-5DOC',
  title:'A.I Thiệt Chẩn/Knowledge',
  folderDriveId:'1SXEo1EPZDw3KTdlFgf1NV1ibM-p4baUT',
  registryDocId:'1QzoIeB3LWwiJ8roQtcU_KmE72rGkboMcX8pdg5rsje0',
  sourceCount:5,
  indexedPages:1157,
  indexedImageOccurrences:1027,
  ownerDesignatedGroundTruthSamples:1027,
  globalVisualVectors:1027,
  diagnosticTongueSignatures:298,
  contextOrNegativeSamples:729,
  pageVisualSignatures:298,
  imageVisualSignatures:298,
  groundTruthDesignation:'owner-designated-ground-truth-v1',
  groundTruthProfileVersion:'owner-ground-truth-profile-v1',
  noSilentOmission:true
});
export const WEIGHTS=Object.freeze({directImage:.45,atlasSimilarity:.35,geminiAcademic:.20});
export const MODERN_EVIDENCE=[
  {source:'TC1',page:5,topics:['qc','ánh sáng','tư thế','nhiễm màu'],text:'Khám lưỡi cần ánh sáng phù hợp, tư thế tự nhiên và kiểm soát yếu tố làm sai lệch màu/rêu; ảnh không đạt điều kiện phải hạ độ tin cậy.'},
  {source:'TC1',page:20,topics:['hàn','nhiệt','rêu trắng','rêu vàng','nhợt','đỏ'],text:'Hàn thường đi với chất lưỡi nhạt, rêu trắng và ẩm; nhiệt thường đi với chất lưỡi đỏ/đỏ sẫm và khô, thực nhiệt thường có rêu vàng còn hư nhiệt có thể ít hoặc không rêu.'},
  {source:'TC1',page:22,topics:['khí hư','dương hư','bệu','dấu răng'],text:'Khí hư có thể biểu hiện lưỡi bệu; Tỳ khí hư thường có dấu răng; dương hư thường làm chất lưỡi nhợt và ẩm, nhưng phải phối hợp triệu chứng và mạch.'},
  {source:'TC1',page:23,topics:['huyết hư','âm hư','tróc rêu','khô'],text:'Huyết hư thường làm chất lưỡi nhạt; âm hư có thể làm lưỡi đỏ/đỏ sẫm, khô và tróc hoặc mất rêu; không kết luận từ một dấu đơn độc.'},
  {source:'TC1',page:25,topics:['huyết ứ','tím','đốm tím'],text:'Huyết ứ thường được hỗ trợ bởi chất lưỡi tím hoặc đốm đỏ sẫm/tím; vị trí đốm chỉ là dấu quy chiếu, không đủ chẩn đoán bệnh.'},
  {source:'TC1',page:47,topics:['mặt dưới','tĩnh mạch dưới lưỡi','tư thế'],text:'Mặt dưới lưỡi và tĩnh mạch dưới lưỡi cần được quan sát bổ sung; không đưa lưỡi quá mạnh vì có thể làm tĩnh mạch căng giả.'},
  {source:'TC1',page:48,topics:['tĩnh mạch dưới lưỡi','khí trệ','huyết ứ','giãn'],text:'Tĩnh mạch dưới lưỡi căng hoặc sắc tối chỉ là tín hiệu YHCT cần phối hợp dữ kiện khác, không được dùng đơn độc để chẩn đoán bệnh.'},
  {source:'DY1',page:14,topics:['chất lưỡi','rêu','kết hợp','hàn nhiệt','hư thực'],text:'Chất lưỡi và rêu phải được kết hợp khi biện hư thực, hàn nhiệt và nông sâu của bệnh; không tách một dấu riêng lẻ khỏi toàn cảnh.'},
  {source:'DY1',page:18,topics:['nhợt','đỏ','đỏ sẫm','xanh tím'],text:'Màu thân lưỡi gồm nhợt, đỏ nhạt, đỏ, đỏ sẫm và xanh/tím; ý nghĩa phải được xét theo rêu, độ ẩm, hình thể và bối cảnh.'},
  {source:'DY1',page:20,topics:['dấu răng','gai','chấm đỏ','ứ huyết'],text:'Dấu răng, gai/chấm đỏ và ban sẫm là các đặc điểm hình thái cần mô tả trước khi diễn giải, đồng thời phải xét vị trí và dấu kèm theo.'},
  {source:'DY1',page:24,topics:['rêu dày','rêu mỏng','nhuận','khô','nhầy'],text:'Rêu mỏng/dày, khô/nhuận và nhầy/dính hỗ trợ đánh giá tà khí, tân dịch và thấp trọc nhưng không tự tạo thành chẩn đoán xác định.'},
  {source:'MC1',page:77,topics:['tứ chẩn','thiệt chẩn','phối hợp'],text:'Thiệt chẩn là một phần của vọng chẩn trong hệ tứ chẩn; quan sát lưỡi không phải nguồn dữ kiện duy nhất.'},
  {source:'MC1',page:80,topics:['nhú lưỡi','niêm mạc','mạch máu','mặt dưới'],text:'Quan sát hình ảnh cần phân biệt nhú sinh lý, niêm mạc và mạch máu trước khi gán ý nghĩa bệnh lý.'},
  {source:'MC1',page:83,topics:['loét lưỡi','u lưỡi','viêm lưỡi','cờ đỏ'],text:'Tổn thương khu trú bất thường không nên bị quy thành thể YHCT từ ảnh; khi phù hợp cần nêu cờ đỏ và khuyến nghị khám trực tiếp.'},
  {source:'AT1',page:1,topics:['bình thường','đỏ nhạt','rêu trắng mỏng','nhuận'],text:'Atlas minh họa lưỡi bình thường với chất lưỡi hồng/đỏ nhạt, mềm mại và rêu trắng mỏng tương đối đều.'},
  {source:'AT1',page:3,topics:['nhợt','bệu','dấu răng','rêu trắng','nhuận'],text:'Mẫu nhợt, bệu, dấu răng, rêu trắng nhuận cho thấy phải đọc tổ hợp hình–màu–rêu thay vì một dấu riêng lẻ.'},
  {source:'AT1',page:5,topics:['đỏ','gai','rêu vàng','rêu dày','nhiệt'],text:'Mẫu lưỡi đỏ, gai đỏ và rêu dày vàng thiên về tín hiệu nhiệt; ứng dụng phải mô tả dấu nhìn thấy trước rồi mới diễn giải.'},
  {source:'AT1',page:8,topics:['tím','dấu răng','rêu trắng','hàn','ứ'],text:'Màu tím cần được đối chiếu đồng thời độ ẩm, rêu và hình thể để phân biệt bối cảnh hàn hoặc ứ.'},
  {source:'AT1',page:16,topics:['đỏ','nứt','ít rêu','khô','tân dịch'],text:'Mẫu đỏ, nứt, ít rêu cho thấy tín hiệu tổn thương tân dịch trong bối cảnh phù hợp, nhưng ảnh đơn độc không đủ xác định bệnh danh.'},
  {source:'AT1',page:22,topics:['mặt dưới','tĩnh mạch dưới lưỡi','tím','giãn','huyết ứ'],text:'Mạch dưới lưỡi xanh tím và giãn là ví dụ hỗ trợ mô tả ứ trệ trong YHCT, không phải chẩn đoán bệnh hiện đại.'}
];
export const SUPER_PROMPT=`[ACADEMIC_FUSION_KNOWLEDGE_5DOC]
Tổng hợp đúng 3 lớp bằng chứng: ảnh thực tế 45%, atlas hình ảnh 35%, học thuật Gemini 20%.
Chỉ giữ tín hiệu khi ít nhất 2/3 lớp đồng thuận.
Toàn bộ dữ liệu trong A.I Thiệt Chẩn/Knowledge được giữ trong corpus: mọi trang và mọi ảnh nhúng đều phải có bản ghi chỉ mục. Hình không đủ đặc trưng lưỡi vẫn được giữ làm dữ liệu nền/ngữ cảnh và không được ép thành mẫu dương tính.
PSY1 (Tâm bệnh học) chỉ là bối cảnh tâm lý sau khi người dùng chủ động cung cấp dữ kiện; tuyệt đối không dùng ảnh lưỡi để suy stress, lo âu, trầm cảm, bệnh tâm thần hay nguy cơ tự hại.
Bệnh danh của ca atlas không được chuyển sang người dùng. Nếu QC kém, atlas yếu hoặc bằng chứng xung đột thì hạ confidence và ghi chưa đủ căn cứ.
Không bịa triệu chứng, mạch, tiền sử, bệnh danh hiện đại, điều trị hay phương thuốc.`;
