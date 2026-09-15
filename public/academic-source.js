export const FUSION_VERSION='academic-fusion-v1';
export const KNOWLEDGE_VERSION='thiet-chan-kb-2026-09-15.6doc-atlas';
export const SOURCE={id:'HD1',title:'Thiệt chẩn hiện đại - Nguyên lý & lâm sàng Đông Dược',translator:'Sách Y Phú',publication:'07/2022',pdfPages:150,sha256:'d05dedaeffcfcde847765739e744e987ebeaa8802d67990141af3688df6d282a'};
export const WEIGHTS=Object.freeze({directImage:.45,atlasSimilarity:.35,geminiAcademic:.20});
export const MODERN_EVIDENCE=[
{page:13,topics:['trung tuyến','hình thái'],text:'Đường trung tuyến và tính cân xứng của thân lưỡi là đặc điểm hình thái cần quan sát có hệ thống; sai lệch phải được phân biệt với đường nứt hoặc góc chụp.'},
{page:47,topics:['âm dương','nhợt','đỏ','rêu'],text:'Biện âm dương phải phối hợp chất lưỡi, rêu và trạng thái nhuận khô; một dấu riêng lẻ không đủ để kết luận.'},
{page:49,topics:['biểu lý','rêu trắng','rêu dày'],text:'Rêu trắng mỏng và chất lưỡi gần bình thường thiên về biểu/nhẹ hơn; rêu dày bẩn thiên về tà vào lý hoặc thấp trọc, cần đối chiếu triệu chứng.'},
{page:50,topics:['hư thực','chất lưỡi','rêu'],text:'Hư thực phải xét phối hợp độ mềm/non hay cứng/già của chất lưỡi, màu sắc và tình trạng rêu; không nên xếp thể từ một dấu đơn độc.'},
{page:52,topics:['hàn nhiệt','rêu trắng','rêu vàng','khô','nhuận'],text:'Hàn nhiệt được đối chiếu bằng màu chất lưỡi, màu rêu và độ nhuận: trắng/nhợt/nhuận thiên hàn hoặc hư; đỏ và rêu vàng/khô thiên nhiệt, nhưng phải xét toàn cảnh.'},
{page:54,topics:['tổng hợp','toàn tức','giới hạn'],text:'Thiệt tượng cần được quan sát toàn diện về màu, hình, rêu, nứt và phân bố; tài liệu nhấn mạnh phải kiểm tra chéo với biểu hiện lâm sàng thay vì suy diễn từ vị trí đơn lẻ.'},
{page:93,topics:['lệch lưỡi','trúng phong','giới hạn'],text:'Các ca atlas có lưỡi lệch minh họa giá trị của hình thái vận động, nhưng bệnh danh của ca nguồn không được dùng để suy bệnh hiện tại nếu không có dữ kiện thần kinh và tứ chẩn.'},
{page:118,topics:['amydal','điểm đỏ','vùng lưỡi'],text:'Ca vùng Amydal cho thấy thay đổi khu trú trên lưỡi cần được mô tả như dấu quan sát và đối chiếu triệu chứng; không quy trực tiếp thành chẩn đoán cơ quan.'},
{page:139,topics:['phế','ho','nứt','rêu'],text:'Các ca Phế/khái thấu trong atlas cho thấy cùng một triệu chứng có thể xuất hiện với nhiều hình lưỡi khác nhau; vì vậy ảnh tương đồng chỉ là bằng chứng hỗ trợ, không phải quan hệ nhân quả.'},
{page:150,topics:['nhũ tuyến','khối','giới hạn'],text:'Các ca có bệnh danh hiện đại trong atlas chỉ cung cấp bối cảnh ca bệnh; vùng màu/khối trên lưỡi phải được xem là quan sát hình thái, không dùng để chẩn đoán ung thư hay bệnh cơ quan.'}
];
export const SUPER_PROMPT=`[ACADEMIC_FUSION_V1]
Bạn là tầng tổng hợp học thuật của A.I Thiệt Chẩn.
MỤC TIÊU: tổng hợp đúng 3 lớp bằng chứng, không để bất kỳ lớp nào tự quyết định:
1) ẢNH THỰC TẾ người dùng và các đặc điểm đã quan sát trực tiếp;
2) MỨC TƯƠNG ĐỒNG với atlas hình ảnh từ tài liệu người dùng cung cấp;
3) KIẾN THỨC HỌC THUẬT do Gemini đối chiếu với các quy tắc nguồn.
TRỌNG SỐ CỐ ĐỊNH: ảnh trực tiếp 45%, atlas 35%, học thuật Gemini 20%.
QUY TẮC:
- Chỉ giữ một thể bệnh/tín hiệu khi ít nhất 2/3 lớp bằng chứng đồng thuận.
- Bệnh danh của ca atlas KHÔNG được chuyển sang người dùng; ca atlas chỉ dùng so hình thái.
- Nếu ảnh QC kém, ánh sáng sai hoặc atlas tương đồng thấp, phải hạ độ tin cậy.
- Không bịa triệu chứng, mạch, tiền sử, bệnh danh hiện đại, điều trị hay phương thuốc.
- Phân biệt rõ: quan sát trực tiếp / tương đồng atlas / diễn giải học thuật / dữ kiện còn thiếu.
- Nếu bằng chứng xung đột, ưu tiên ảnh trực tiếp; ghi “chưa đủ căn cứ” thay vì ép kết luận.
- Trả JSON duy nhất:
{"academicSummary":"...","patternCandidates":[{"label":"...","directEvidence":"...","atlasEvidence":"...","academicEvidence":"...","missing":"...","score":0.0}],"cannotConclude":["..."]}`;
