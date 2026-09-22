// User-supplied real tongue still-image teaching batch R3, 2026-09-22.
// Raw images are intentionally NOT vendored because they contain identifiable faces.
// Only de-identified, reviewable visual observations and conditional YHCT interpretation are stored.
// Near-duplicate views are grouped to reduce double counting; grouping is by visible tongue/image similarity, not identity verification.

export const REAL_TONGUE_STILL_R3_20260922_DOCUMENTS=[
{
  id:'RTBSR3',
  title:'User-supplied real tongue still-image batch R3 — 10 assets / 6 correlated-view groups, 2026-09-22',
  role:'user-supplied-still-derived-silver-reference',
  license:'user-supplied-private-media-no-raw-redistribution',
  policy:'derived observations only; not clinical gold; candidate YHCT pattern labels remain conditional on Tứ chẩn and expert verification'
}
];

export const REAL_TONGUE_STILL_R3_20260922_EVIDENCE=[
// Group 1 — assets 29816 + 29815
{id:'RTBSR3-G1-E01',source:'RTBSR3',locator:'group 1 · assets 29816/29815',topics:['đỏ nhạt','hồng nhạt','rêu trắng mỏng','nhuận','bờ lưỡi trơn','gần bình thường'],ontology:['dataset.real_still_silver','tongue_body.color','tongue.coating.color','tongue.coating.thickness','tongue.coating.moisture'],evidenceType:'user-still-derived-silver-reference',text:'Hai ảnh nhóm 1 cho thấy chất lưỡi đỏ nhạt/hồng nhạt khá đồng đều, đầu lưỡi hơi đỏ hơn; rêu trắng mỏng, vùng giữa–sau phủ rõ hơn phần đầu và bề mặt có độ bóng ẩm. Bờ bên tương đối trơn, chưa thấy lõm lặp lại đủ mạnh để gọi dấu răng.'},
{id:'RTBSR3-G1-E02',source:'RTBSR3',locator:'group 1 · assets 29816/29815',topics:['không nứt rõ','không dấu răng rõ','negative control','rãnh giữa'],ontology:['dataset.real_still_silver','surface.fissure','surface.toothmarks','acquisition.qc'],evidenceType:'user-still-derived-silver-reference',text:'Không thấy nứt bệnh lý nổi bật; nếu có rãnh dọc giữa thì nông và không nên tự nâng thành fissure. Nhóm này là negative-control hữu ích cho dấu răng/nứt: bờ lưỡi phải có chuỗi lõm lặp lại và rãnh phải có hình học đủ rõ mới được gắn nhãn.'},
{id:'RTBSR3-G1-E03',source:'RTBSR3',locator:'group 1 · assets 29816/29815',topics:['bình hòa','không đủ xếp thể','biện chứng'],ontology:['dataset.real_still_silver','tcm.pattern.conditional'],evidenceType:'user-still-derived-silver-reference',text:'Tổ hợp đỏ nhạt + rêu trắng mỏng + độ ẩm vừa gần thiệt tượng bình thường hơn là một thể bệnh đặc hiệu. Không được ép nhãn Tỳ hư, nhiệt hay thấp chỉ từ nhóm ảnh này; nếu cần biện chứng phải dùng triệu chứng, mạch và các dữ kiện Tứ chẩn.'},

// Group 2 — assets 29814 + 29813
{id:'RTBSR3-G2-E01',source:'RTBSR3',locator:'group 2 · assets 29814/29813',topics:['hồng nhạt','hơi nhợt','rêu trắng mỏng','đầu lưỡi đỏ hơn','hình thể đầy vừa'],ontology:['dataset.real_still_silver','tongue_body.color','tongue_body.shape','tongue.coating.color','tongue.coating.thickness'],evidenceType:'user-still-derived-silver-reference',text:'Nhóm 2 cho thấy chất lưỡi hồng nhạt, có thể hơi nhợt tùy cân bằng trắng; hình thể đầy vừa, đầu lưỡi đỏ hơn thân; rêu trắng mỏng phủ phần giữa–sau, không thấy lớp rêu dày che khuất chất lưỡi.'},
{id:'RTBSR3-G2-E02',source:'RTBSR3',locator:'group 2 · assets 29814/29813',topics:['dấu răng nhẹ','không xác định','flash','màu'],ontology:['dataset.real_still_silver','surface.toothmarks','acquisition.qc'],evidenceType:'user-still-derived-silver-reference',text:'Bờ hai bên có vài chỗ lượn nhẹ nhưng chưa đủ chuỗi lõm lặp lại để gọi dấu răng chắc chắn; nên trả “không thấy rõ/nghi nhẹ” thay vì dương tính. Ánh sáng khá mạnh nên màu đỏ/nhợt phải được chuẩn hóa trước khi dùng cho suy luận.'},
{id:'RTBSR3-G2-E03',source:'RTBSR3',locator:'group 2 · assets 29814/29813',topics:['hư chứng','khí huyết hư','không đủ xếp thể','biện chứng'],ontology:['dataset.real_still_silver','tcm.pattern.conditional'],evidenceType:'user-still-derived-silver-reference',text:'Nếu chuẩn hóa màu vẫn xác nhận chất lưỡi thiên nhạt thì có thể tạo hướng đối chiếu hư chứng/khí huyết bất túc, nhưng mức gợi ý thấp vì rêu mỏng và hình thể không có dấu đặc hiệu. Ảnh đơn độc không đủ xếp thể.'},

// Group 3 — assets 29812 + 29811
{id:'RTBSR3-G3-E01',source:'RTBSR3',locator:'group 3 · assets 29812/29811',topics:['ám tím','xám tím','rêu trắng xám','rêu dày','trung tâm','gốc lưỡi','thô'],ontology:['dataset.real_still_silver','tongue_body.color','tongue.coating.color','tongue.coating.thickness','tongue.coating.texture'],evidenceType:'user-still-derived-silver-reference',text:'Nhóm 3 có chất lưỡi nhìn ám tối/tím-xám hơn các nhóm khác; rêu trắng-xám phủ khá dày và liên tục, nổi bật ở trung tâm–sau, bề mặt thiên thô/lì hơn bóng. Màu tím/xám phải qua color-normalization vì ánh sáng môi trường có thể gây ám màu.'},
{id:'RTBSR3-G3-E02',source:'RTBSR3',locator:'group 3 · assets 29812/29811',topics:['nứt giữa','rãnh giữa sâu','fissure','đường giữa'],ontology:['dataset.real_still_silver','surface.fissure'],evidenceType:'user-still-derived-silver-reference',text:'Có một rãnh dọc giữa rõ, tương đối sâu và liên tục hơn rãnh giữa sinh lý thông thường, kéo từ vùng giữa ra trước. Nhãn phù hợp cho dạy máy là “rãnh giữa rõ/nghi nứt trung tâm”; chỉ nâng thành nứt xác định khi extractor hình học chuyên biệt và QC đạt.'},
{id:'RTBSR3-G3-E03',source:'RTBSR3',locator:'group 3 · assets 29812/29811',topics:['thấp trọc','đàm thấp','huyết ứ','ứ trệ','rêu trắng xám dày','biện chứng'],ontology:['dataset.real_still_silver','tcm.pattern.conditional'],evidenceType:'user-still-derived-silver-reference',text:'Trong lý luận YHCT, rêu trắng-xám dày làm tăng hướng đối chiếu thấp trọc/đàm thấp; nếu sắc ám tím được xác nhận sau chuẩn hóa màu thì tăng tín hiệu ứ trệ/huyết ứ. Không được tự chốt hàn-thấp, Tỳ dương hư hay huyết ứ nếu thiếu triệu chứng và mạch.'},

// Group 4 — asset 29810
{id:'RTBSR3-G4-E01',source:'RTBSR3',locator:'group 4 · asset 29810',topics:['hồng nhạt','hơi nhợt','rêu trắng xám mỏng','lưỡi dài','hẹp tương đối'],ontology:['dataset.real_still_silver','tongue_body.color','tongue_body.shape','tongue.coating.color','tongue.coating.thickness'],evidenceType:'user-still-derived-silver-reference',text:'Ảnh 29810 cho thấy chất lưỡi hồng nhạt, hơi thiên nhợt; lưỡi tương đối dài/hẹp theo ảnh 2D; rêu trắng-xám mỏng phủ trung tâm, bờ bên khá trơn và không thấy dấu răng rõ.'},
{id:'RTBSR3-G4-E02',source:'RTBSR3',locator:'group 4 · asset 29810',topics:['độ ẩm','phản xạ','không nứt rõ','không dấu răng'],ontology:['dataset.real_still_silver','tongue.coating.moisture','surface.fissure','surface.toothmarks','acquisition.qc'],evidenceType:'user-still-derived-silver-reference',text:'Có phản xạ sáng cục bộ ở bề mặt nên không được suy “nhuận/trơn” chỉ từ highlight; không thấy nứt sâu hay chuỗi lõm bờ lặp lại. Đây là mẫu giúp guard chống gọi quá mức ẩm, nứt và dấu răng.'},
{id:'RTBSR3-G4-E03',source:'RTBSR3',locator:'group 4 · asset 29810',topics:['hư chứng','khí huyết hư','không đủ xếp thể'],ontology:['dataset.real_still_silver','tcm.pattern.conditional'],evidenceType:'user-still-derived-silver-reference',text:'Nếu màu nhạt được xác nhận bằng ảnh chuẩn hóa, có thể tạo hướng đối chiếu hư chứng/khí huyết bất túc ở mức yếu. Không có đủ đặc trưng để xếp một thể YHCT cụ thể từ ảnh này.'},

// Group 5 — assets 29808 + 29809
{id:'RTBSR3-G5-E01',source:'RTBSR3',locator:'group 5 · assets 29808/29809',topics:['đỏ nhạt','hồng tươi','ít rêu','rêu rất mỏng','nhuận','flash'],ontology:['dataset.real_still_silver','tongue_body.color','tongue.coating.thickness','tongue.coating.moisture','acquisition.qc'],evidenceType:'user-still-derived-silver-reference',text:'Nhóm 5 cho thấy chất lưỡi hồng/đỏ nhạt khá đều, rêu rất mỏng đến ít ở phần trước, bề mặt bóng ẩm. Flash khá mạnh nên độ đỏ và độ bóng có nguy cơ bị tăng giả; cần hạ độ tin cậy nếu không có cân bằng trắng và kiểm soát cháy sáng.'},
{id:'RTBSR3-G5-E02',source:'RTBSR3',locator:'group 5 · assets 29808/29809',topics:['không dấu răng rõ','không nứt rõ','negative control','nhiệt'],ontology:['dataset.real_still_silver','surface.toothmarks','surface.fissure','acquisition.qc'],evidenceType:'user-still-derived-silver-reference',text:'Bờ lưỡi tương đối trơn, không thấy dấu răng rõ hay nứt sâu. Nhóm này là negative-control cho lỗi “flash = nhiệt”: sắc đỏ sáng dưới flash không được tự chuyển thành thực nhiệt nếu rêu, độ khô và các dấu khác không hỗ trợ.'},
{id:'RTBSR3-G5-E03',source:'RTBSR3',locator:'group 5 · assets 29808/29809',topics:['bình hòa','không đủ xếp thể','biện chứng'],ontology:['dataset.real_still_silver','tcm.pattern.conditional'],evidenceType:'user-still-derived-silver-reference',text:'Sau khi trừ nguy cơ flash, thiệt tượng này không có tổ hợp đủ đặc hiệu để xếp thể; ưu tiên nhãn “không đủ xếp thể/gần bình thường” thay vì tự gán nhiệt chứng.'},

// Group 6 — asset 29807
{id:'RTBSR3-G6-E01',source:'RTBSR3',locator:'group 6 · asset 29807',topics:['nhợt ám tím','rêu trắng xám','rêu dày','lưỡi rộng','trung tâm','gốc lưỡi'],ontology:['dataset.real_still_silver','tongue_body.color','tongue_body.shape','tongue.coating.color','tongue.coating.thickness'],evidenceType:'user-still-derived-silver-reference',text:'Ảnh 29807 cho thấy chất lưỡi nhạt nhưng ám tối/tím nhẹ, hình thể tương đối rộng; rêu trắng-xám dày hơn ở trung tâm–sau. Màu ám tím chỉ là quan sát ứng viên và cần color-normalization trước khi dùng như tín hiệu ứ trệ.'},
{id:'RTBSR3-G6-E02',source:'RTBSR3',locator:'group 6 · asset 29807',topics:['rãnh giữa','nứt giữa','dấu răng không rõ','fissure'],ontology:['dataset.real_still_silver','surface.fissure','surface.toothmarks'],evidenceType:'user-still-derived-silver-reference',text:'Có rãnh dọc giữa khá rõ từ vùng giữa ra trước; có thể xem là “nghi nứt trung tâm” nhưng chưa nên gọi nứt xác định nếu chưa có đo hình học. Bờ lưỡi không bộc lộ đủ chuỗi lõm lặp lại để xác nhận dấu răng.'},
{id:'RTBSR3-G6-E03',source:'RTBSR3',locator:'group 6 · asset 29807',topics:['Tỳ khí hư','Tỳ dương hư','thấp','đàm thấp','ứ trệ','biện chứng'],ontology:['dataset.real_still_silver','tcm.pattern.conditional'],evidenceType:'user-still-derived-silver-reference',text:'Nếu chất lưỡi nhạt + hình thể rộng + rêu trắng-xám dày được xác nhận trong ảnh chuẩn hóa, tổ hợp có thể hỗ trợ hướng Tỳ khí/Tỳ dương hư kèm thấp hoặc đàm-thấp; nếu sắc tím vẫn tồn tại sau chuẩn hóa thì cần đối chiếu thêm ứ trệ. Đây chỉ là nhãn thể bệnh ứng viên, không phải chẩn đoán.'}
];

export const REAL_TONGUE_STILL_R3_20260922_POLICY=Object.freeze({
datasetId:'RTBSR3-20260922',
assetCount:10,
correlatedViewGroupCount:6,
independentCaseCountKnown:false,
rawImagesVendored:false,
containsIdentifiableFacesInSourceMedia:true,
derivedObservationsDeidentified:true,
clinicalGold:false,
goldEligible:false,
holdoutEligible:false,
promotionEligible:false,
modelWeightTrainingReady:false,
expertVerificationRequired:true,
role:'LLM retrieval/reasoning teacher + recognition-rule review candidate',
rule:'Use the derived visual labels for retrieval/reasoning and future feature-rule review only. Do not publish raw face-containing media, do not count correlated views as independent cases, and do not promote candidate syndrome labels to clinical gold without expert confirmation and Tứ chẩn context.'
});
