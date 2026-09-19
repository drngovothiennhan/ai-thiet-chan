import './runtime-guard.mjs';
import { TONGUE_EVIDENCE, KNOWLEDGE_DOCUMENTS as BASE_KNOWLEDGE_DOCUMENTS, citationInstruction } from './knowledge-evidence.mjs';
import { EXTENDED_EVIDENCE, EXTENDED_KNOWLEDGE_DOCUMENTS, PSYCH_CONTEXT_RULES } from './knowledge-extended.mjs';
import { OPEN_ACCESS_EVIDENCE, OPEN_ACCESS_KNOWLEDGE_DOCUMENTS, OPEN_ACCESS_POLICY } from './knowledge-open-access.mjs';
import { ontologyTokensForQuery, TONGUE_ONTOLOGY_MANIFEST } from './knowledge-ontology.mjs';

export const KNOWLEDGE_VERSION = 'thiet-chan-kb-2026-09-19.6doc+oa19-moisture-region-v2';

export const KNOWLEDGE_DOCUMENTS = [
  ...BASE_KNOWLEDGE_DOCUMENTS,
  ...EXTENDED_KNOWLEDGE_DOCUMENTS,
  ...OPEN_ACCESS_KNOWLEDGE_DOCUMENTS
];

export const KNOWLEDGE_SOURCES = [
  ...KNOWLEDGE_DOCUMENTS.map(d=>`${d.id}: ${d.title}${d.author?` - ${d.author}`:''}`),
  'Tài liệu thiệt chẩn cơ bản - Nguyễn Phương, Học viện Y học Cổ truyền Việt Nam',
  'Ứng dụng thiệt chẩn điều trị bệnh lý dạ dày thực quản theo Y học cổ truyền - ThS.BS Nguyễn Đức Huệ Tiên'
];

const USER_EVIDENCE=[...TONGUE_EVIDENCE,...EXTENDED_EVIDENCE];
const ALL_EVIDENCE=[...USER_EVIDENCE,...OPEN_ACCESS_EVIDENCE];
const documentById=new Map(KNOWLEDGE_DOCUMENTS.map(d=>[d.id,d]));

function analysisEvidence(){
  return USER_EVIDENCE.map(e=>`- ${e.text}`).join('\n');
}

function normalizeSearchText(value){
  return String(value||'').toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}
function tokens(value){return [...new Set(normalizeSearchText(value).split(' ').filter(x=>x.length>=3))];}
function evidenceScore(e,queryTokens){
  if(!queryTokens.length)return 0;
  const hay=tokens(`${e.topics?.join(' ')||''} ${e.ontology?.join(' ')||''} ${e.text}`);let score=0;
  for(const q of queryTokens){if(hay.includes(q))score+=3;else if(hay.some(h=>h.includes(q)||q.includes(h)))score+=1;}
  return score;
}
function psychRelevant(query){return /(tam ly|tam than|stress|lo au|tram cam|cam xuc|buon|hoang|mat ngu|tu hai|hanh vi|cang thang)/.test(normalizeSearchText(query));}
function renderCitedEvidence(items){
  return items.map(e=>{
    const doc=documentById.get(e.source);
    const locator=e.page?`tr. ${e.page}`:String(e.locator||(doc?.pmid?`PMID ${doc.pmid}`:'nguồn học thuật'));
    return `- [${e.source}, ${locator}] ${e.text}${doc?` (Nguồn: ${doc.title})`:''}`;
  }).join('\n');
}

export function knowledgeForQuery(query,{limit=18}={}){
  const qTokens=[...new Set([...tokens(query),...ontologyTokensForQuery(query)])];
  const allowPsych=psychRelevant(query);
  const ranked=ALL_EVIDENCE
    .filter(e=>allowPsych||e.source!=='PSY1')
    .map(e=>({e,score:evidenceScore(e,qTokens)}))
    .sort((a,b)=>b.score-a.score||a.e.source.localeCompare(b.e.source)||(Number(a.e.page)||0)-(Number(b.e.page)||0));
  const effectiveLimit=Math.max(Number(limit)||18,12);
  const selected=[];const seen=new Set();
  for(const item of ranked){if(item.score<=0&&selected.length>=8)break;if(seen.has(item.e.id))continue;selected.push(item.e);seen.add(item.e.id);if(selected.length>=effectiveLimit)break;}
  const requiredSources=['TC1','DY1','MC1','AT1',...(allowPsych?['PSY1']:[])];
  for(const source of requiredSources){
    if(selected.some(e=>e.source===source))continue;
    const fallback=ALL_EVIDENCE.find(e=>e.source===source);
    if(!fallback||seen.has(fallback.id))continue;
    if(selected.length>=effectiveLimit){
      const protectedSources=new Set(requiredSources);
      let replaceAt=-1;
      for(let i=selected.length-1;i>=0;i--){if(!protectedSources.has(selected[i].source)){replaceAt=i;break;}}
      if(replaceAt>=0){seen.delete(selected[replaceAt].id);selected.splice(replaceAt,1);}
    }
    if(selected.length<effectiveLimit){selected.push(fallback);seen.add(fallback.id);}
  }
  return `HỆ TRI THỨC TRUY XUẤT ${KNOWLEDGE_VERSION}:\n${renderCitedEvidence(selected.slice(0,effectiveLimit))}\n\n${PSYCH_CONTEXT_RULES}\n${citationInstruction()}\n- Với nguồn OAxx, dẫn nguồn theo PMID/PMCID xuất hiện trong khối bằng chứng; không bịa số trang bài báo.\n- Nguồn open-access chỉ bổ sung RAG/đối chiếu học thuật; nghiên cứu liên hệ bệnh không được chuyển thành chẩn đoán bệnh từ ảnh lưỡi.\n- Ontology: ${TONGUE_ONTOLOGY_MANIFEST.id}; corpus OA: ${OPEN_ACCESS_POLICY.corpusId}.
- Phân khu Tâm-Phế/Can-Đởm/Tỳ-Vị/Thận là bản đồ lý luận YHCT dùng cho đối chiếu, không phải bản đồ giải phẫu và không được tự chuyển thành chẩn đoán bệnh cơ quan.\n- Chỉ chatbot sau khi đã có kết quả thiệt chẩn mới được hiển thị mục “Nguồn đối chiếu”.\n- Không hiển thị mã nguồn/trang trong màn hình kết quả thiệt chẩn, dashboard, lịch sử hoặc báo cáo tổng kết ca.\n- Nếu nguồn không trực tiếp hỗ trợ một kết luận thì phải nói chưa đủ căn cứ, không ghép nguồn cho đủ số lượng.`;
}

export const TONGUE_KNOWLEDGE = `
PHẠM VI: Dùng để chuẩn hóa mô tả thiệt tượng và gợi ý biện chứng YHCT phục vụ học tập/tham khảo. Không được suy từ ảnh lưỡi thành chẩn đoán bệnh xác định, không kê đơn, không thay thế tứ chẩn.

KIẾN TRÚC SUY LUẬN:
- Tách ba lớp: (1) quan sát trực tiếp từ ảnh; (2) đối chiếu lý thuyết/atlas; (3) tổng hợp có điều kiện với dữ kiện vấn chẩn đã có.
- Năm tài liệu PDF nền cùng atlas THIỆT CHẨN(1) bổ sung của người dùng được phối hợp theo vai trò: lý thuyết thiệt chẩn, atlas hình ảnh, mạch-thiệt chẩn/giải phẫu-bệnh lý lưỡi, và Tâm bệnh học cho bối cảnh thập vấn sau phân tích.
- Bộ open-access PubMed/PMC được dùng làm lớp đối chiếu chuẩn hóa, độ tin cậy, giải phẫu-rêu, hình thái, tĩnh mạch dưới lưỡi, QC và AI; không thay thế gold chuyên gia và không được dùng để tự suy chẩn đoán bệnh hiện đại.
- Không dùng Tâm bệnh học để tạo quan hệ nhân quả giữa hình lưỡi và bệnh tâm thần.
- Không để một atlas ca đơn lẻ lấn át nguyên tắc tổng hợp chất lưỡi + rêu + QC + dữ kiện còn thiếu.

QUY TRÌNH QUAN SÁT:
- Đánh giá lần lượt: chất lưỡi (thần, màu sắc, hình dáng, trạng thái), rêu lưỡi (màu, dày/mỏng, nhuận/khô, nhầy/vữa/tróc), rồi tĩnh mạch dưới lưỡi nếu ảnh thực sự thấy mặt dưới lưỡi.
- Tư thế chuẩn: lưỡi đưa tự nhiên, thả lỏng, mặt lưỡi phẳng, bộc lộ toàn bộ lưỡi. Ưu tiên ánh sáng tự nhiên/trung tính; ảnh ám màu, thiếu sáng, cháy sáng, mờ hoặc filter màu phải hạ độ tin cậy.
- Phân biệt cấu trúc giải phẫu/nhú lưỡi bình thường với tổn thương khu trú. Loét dai dẳng, khối bất thường, vùng chảy máu/hoại tử hoặc tổn thương khu trú đáng ngờ phải được nêu là cờ đỏ cần khám trực tiếp, không quy thành thể YHCT.
- Không kết luận một dấu hiệu đơn độc; phải tổng hợp chất lưỡi + rêu lưỡi. Nếu hai nhóm dấu hiệu không đồng nhất phải nêu là hỗn hợp/không đủ dữ kiện.

THIỆT TƯỢNG BÌNH THƯỜNG:
- Chất lưỡi đỏ nhạt, mềm mại, linh hoạt; rêu trắng mỏng, phân bố đều, khô ướt vừa phải.
- Tĩnh mạch dưới lưỡi bình thường: tím nhạt, mềm, không giãn/uốn lượn; chỉ áp dụng tiêu chí định lượng khi ảnh có chuẩn kích thước đủ tin cậy, nếu không thì mô tả định tính.

ĐỘ ẨM THÂN LƯỠI VÀ RÊU:
- Luôn tách hai trường quan sát: (1) độ ẩm thân lưỡi và (2) độ ẩm rêu lưỡi. Không gộp thành một nhãn duy nhất.
- Mức quan sát đề xuất cho LLM: bình thường / nhuận-ướt / khô / không xác định. Nếu cần mô tả rêu trơn (slippery), ghi riêng là rêu nhìn như có nước/ướt rõ, không đồng nhất với mọi trường hợp “nhuận”.
- Tín hiệu hình ảnh hữu ích của ướt/nhuận là phản xạ bóng do lớp nước bọt trên bề mặt; nghiên cứu TIAS cho thấy diện tích/độ bóng có tương quan với lượng nước bề mặt khi chiếu sáng và góc chụp được kiểm soát.
- Tín hiệu khô nên dựa trên giảm/mất bóng bề mặt kèm bề mặt lì/khô; nứt có thể đi kèm nhưng nứt đơn độc KHÔNG được dùng để kết luận khô.
- Flash, cháy sáng, góc phản xạ, môi/răng, lớp rêu dày và thời gian giữ lưỡi thè ra có thể tạo nhiễu. Điểm sáng cục bộ do flash không được tự động coi là ướt.
- Lưỡi khô dần khi giữ ngoài miệng; thời điểm chụp là biến QC. Nếu có chụp lặp để so độ ẩm, cần chuẩn hóa thời gian và không dùng khác biệt do thời gian thè lưỡi làm dấu bệnh.
- Không dùng công thức/threshold của một nghiên cứu nhỏ làm ngưỡng chẩn đoán phổ quát. Nếu QC không đủ hoặc ánh sáng không kiểm soát, trả “không xác định” thay vì ép nhãn khô/ướt.
- Diễn giải YHCT chỉ sau lớp quan sát: nhuận/trơn có thể hỗ trợ bối cảnh tân dịch/thấp; khô có thể hỗ trợ bối cảnh tân dịch hao/táo/nhiệt. Không suy nguyên nhân từ độ ẩm đơn độc.

PHÂN KHU LƯỠI THEO TẠNG PHỦ — CHỈ LÀ BẢN ĐỒ LÝ LUẬN YHCT:
- Đầu lưỡi / phần trước: thường đối chiếu Tâm và Phế.
- Hai bên/rìa lưỡi: thường đối chiếu Can và Đởm.
- Trung tâm lưỡi: thường đối chiếu Tỳ và Vị.
- Gốc/phần sau lưỡi: thường đối chiếu Thận; một số tài liệu/hệ phân khu mở rộng thêm ruột và bàng quang/hạ tiêu.
- Khi triển khai trên ảnh, các ranh giới chỉ là xấp xỉ hình học. Có thể dùng 4 vùng lớn hoặc 5 vùng chi tiết hơn, nhưng phải giữ cùng một quy ước trong dataset và validation.
- Bất thường ở một vùng KHÔNG đồng nghĩa có bệnh xác định của tạng tương ứng. Chỉ được nói “dấu hiệu nằm ở vùng theo bản đồ YHCT liên hệ với …”, sau đó phải đối chiếu toàn lưỡi, triệu chứng và các dữ kiện tứ chẩn.
- Không gọi các vùng này là ranh giới giải phẫu hay bằng chứng sinh học trực tiếp của cơ quan nội tạng.

MÀU CHẤT LƯỠI:
- Đỏ nhạt: thường là bình thường hoặc bệnh nhẹ/biểu chứng sớm.
- Trắng nhợt: gợi ý hư hàn, dương hư, khí huyết bất túc. Trắng nhợt + gầy mỏng nghiêng về khí huyết lưỡng hư. Trắng nhợt + mập non + ướt + hằn răng nghiêng về hư hàn/thấp.
- Đỏ/đỏ sẫm: gợi ý nhiệt. Đỏ + rêu vàng dày/khô/nổi gai nghiêng về thực nhiệt. Đỏ/đỏ sẫm + ít hoặc không rêu, có nứt nghiêng về âm hư/hư nhiệt hoặc nhiệt thương tân.
- Xanh/tím: gợi ý khí huyết vận hành không thông; cần phân biệt bối cảnh hàn, nhiệt và huyết ứ. Tím tối/điểm ứ/ban ứ làm tăng tín hiệu huyết ứ.

HÌNH DÁNG VÀ TRẠNG THÁI:
- Mập to, non, hằn răng: thường đi với Tỳ khí/Tỳ dương hư và thấp; nếu đỏ căng to có thể đi với nhiệt/thấp nhiệt.
- Gầy mỏng: trắng nhạt -> khí huyết hư; đỏ sẫm -> nhiệt thương tân hoặc âm hư.
- Nứt: cần xét màu và độ ẩm; đỏ sẫm + nứt + khô -> nhiệt thương tân/âm dịch khuy; trắng nhợt + nứt -> huyết hư; mập non + hằn răng + nứt -> Tỳ hư thấp đình.
- Nổi gai/điểm đỏ: tín hiệu nhiệt thịnh; vị trí chỉ dùng như gợi ý học thuật, không suy thành bệnh cơ quan xác định.
- Lưỡi già thường thiên thực/nhiệt; lưỡi non thường thiên hư/hàn.
- Các trạng thái vận động như liệt mềm, đơ cứng, nghiêng lệch, co ngắn, run không được suy luận từ một ảnh tĩnh nếu không nhìn thấy rõ; phải ghi không đánh giá được.

RÊU LƯỠI:
- Mỏng: còn nhìn thấy thân lưỡi; thường bệnh nhẹ/biểu. Dày: che thân lưỡi; thường tà nhập lý hoặc đàm ẩm/thấp/thực tích.
- Nhuận/trơn: trước hết là mô tả độ ẩm của rêu; về YHCT có thể hỗ trợ bối cảnh tân dịch/thấp. Khô/táo: trước hết là mô tả rêu ít dịch; về YHCT có thể hỗ trợ bối cảnh tân dịch tổn thương/táo. Không suy nguyên nhân khi chỉ có một dấu này.
- Nhầy: hạt nhỏ, dính chặt; thường thấp trọc/đàm ẩm/thực tích, có thể là hàn thấp hoặc thấp nhiệt tùy màu và độ ẩm.
- Vữa/hủ: thô xốp, dễ cạo; thường thấp trọc/thực tích.
- Tróc/bản đồ/mặt gương: khí âm, đặc biệt Tỳ Vị khí âm, có thể bất túc; mặt gương đỏ sẫm/khô làm tăng tín hiệu âm dịch hao tổn.
- Rêu trắng: thường biểu/hàn nhưng phải kết hợp chất lưỡi. Trắng dày nhầy -> thấp trọc/đàm ẩm/thực tích.
- Rêu vàng: thường lý/nhiệt. Vàng dày khô -> nhiệt thương tân/táo kết. Vàng nhầy -> thấp nhiệt/đàm nhiệt/thực tích hóa nhiệt.
- Rêu xám/đen: thường lý chứng nặng; khô thiên nhiệt cực thương tân, nhuận thiên hàn thấp/dương hư. Không suy mức độ nặng nếu ảnh bị ám màu hoặc vệ sinh miệng/thức ăn có thể làm đổi màu.

TỔ HỢP ĐIỂN HÌNH:
- Chất lưỡi đỏ + rêu vàng khô/táo -> tín hiệu thực nhiệt.
- Chất lưỡi nhợt non + rêu trắng nhuận -> tín hiệu hư hàn.
- Đỏ sẫm + nứt + rêu vàng cháy/khô -> tín hiệu nhiệt thịnh thương tân.
- Xanh tím + rêu trắng nhầy -> tín hiệu khí huyết ứ trệ kèm đàm thấp.

VỊ QUẢN / DẠ DÀY-THỰC QUẢN - CHỈ LÀ GỢI Ý BIỆN CHỨNG KHI CÓ DẤU LƯỠI PHÙ HỢP:
- Hàn tà khách Vị: rêu trắng mỏng hoặc dày vừa là dấu lưỡi hỗ trợ; chẩn thể còn cần đau liên quan lạnh, gặp ấm giảm và mạch.
- Ẩm thực thương Vị: rêu dày bẩn là dấu hỗ trợ; còn cần đầy đau sau ăn, ợ/nôn thức ăn, đại tiện và mạch.
- Can khí phạm Vị: lưỡi có thể phồng/căng hai bên; nhưng thể này phụ thuộc mạnh vào triệu chứng tình chí, đau lan hạ sườn, ợ hơi/thở dài và mạch nên ảnh lưỡi đơn độc không đủ kết luận.
- Ứ huyết đình trệ: lưỡi ám tím, ban ứ/điểm ứ là dấu hỗ trợ; cần đối chiếu đau cố định/châm chích và các dấu khác.
- Thấp nhiệt trung trở: rêu vàng nhớt/nhầy bẩn là dấu hỗ trợ; cần đối chiếu nóng rát, miệng đắng/nhớt, nặng người, đại tiểu tiện và mạch.
- Vị âm khuy hư: lưỡi đỏ, ít rêu hoặc bóng không rêu là dấu hỗ trợ; cần đối chiếu khô miệng họng, hao gầy, đại tiện khô, mạch tế sác.
- Tỳ Vị hư hàn: lưỡi nhạt, rêu trắng; nếu kèm mập non/hằn răng càng tăng tín hiệu; cần đối chiếu đau âm ỉ, thích ấm/xoa, ăn kém, mệt, tay chân lạnh, đại tiện lỏng và mạch.

NGUYÊN TẮC SUY LUẬN:
1) Tách mô tả nhìn thấy khỏi diễn giải YHCT.
2) Mỗi diễn giải phải chỉ ra dấu hình ảnh hỗ trợ.
3) Nếu QC poor, chỉ mô tả thô; không xếp thể.
4) Nếu QC fair, tối đa gợi ý yếu/trung bình; nếu good mới cho phép gợi ý mạnh nhưng vẫn không chẩn đoán xác định.
5) Không suy ra triệu chứng, mạch, bệnh danh, nguyên nhân, điều trị hoặc phương thuốc từ ảnh nếu đầu vào không có.
6) Atlas hình ảnh chỉ là đối chiếu tương tự, không phải nhãn tuyệt đối.
7) Kiến thức Tâm bệnh học chỉ dùng khi người dùng chủ động cung cấp dữ kiện tâm lý/tình chí trong Thập vấn sau phân tích.

BẰNG CHỨNG NỀN ĐÃ CHUẨN HÓA TỪ 5 TÀI LIỆU PDF NGƯỜI DÙNG CUNG CẤP:
${analysisEvidence()}

${PSYCH_CONTEXT_RULES}

QUY TẮC HIỂN THỊ NGUỒN:
- Trong JSON phân tích ảnh, màn hình kết quả, dashboard, lịch sử và báo cáo tổng kết: KHÔNG xuất tên tài liệu, mã nguồn, số trang, “Nguồn đối chiếu”, “Tham khảo” hoặc citation dạng [XX, tr. N].
- Nguồn/trang chỉ được hiển thị trong chatbot sau khi đã có kết quả thiệt chẩn; chatbot dùng knowledgeForQuery để chọn bằng chứng liên quan.
- Không dẫn nguồn cho quan sát thuần túy từ ảnh; chỉ dẫn nguồn cho phần diễn giải/đối chiếu lý thuyết.
`;
