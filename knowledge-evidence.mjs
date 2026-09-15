export const KNOWLEDGE_DOCUMENTS = [
  {
    id:'TC1',
    title:'Thiệt chẩn hoàn chỉnh',
    file:'967503752-Thiệt-chẩn-hoan-chỉnh.pdf',
    sha256:'72afb5595e20e0f6311b2166ad8103129cf42a1299528b58bfea09892d49218e',
    pages:174,
    role:'primary-theory'
  },
  {
    id:'DY1',
    title:'Đông y chẩn đoán bệnh trên lưỡi – Cẩm nang Y học cổ truyền',
    author:'Tống Thiên Bân; dịch: Lê Quý Ngưu, Lương Tú Vân',
    file:'đông-y-chẩn-đoán-bệnh-trên-lưỡi.pdf',
    sha256:'802d949b0e512fbe3ab34f699b9a1e73a75fc2679f282b98ab33b55736511c22',
    pages:302,
    role:'primary-atlas'
  }
];

// Các mệnh đề dưới đây là diễn giải ngắn, có truy nguyên trang PDF; không phải trích nguyên văn.
// Không dùng chúng để suy ra bệnh danh hiện đại hoặc thay thế Tứ chẩn.
export const TONGUE_EVIDENCE = [
  {id:'TC1-005',source:'TC1',page:5,topics:['qc','ánh sáng','tư thế','thời gian','nhiễm màu'],text:'Khám lưỡi cần ánh sáng phù hợp, ưu tiên ánh sáng tự nhiên; không đưa lưỡi quá gắng sức và mỗi lần quan sát chỉ ngắn khoảng 15–20 giây. Thức ăn màu, cay và hút thuốc có thể làm sai lệch màu/rêu.'},
  {id:'TC1-007',source:'TC1',page:7,topics:['chất lưỡi','màu sắc','bát cương'],text:'Màu chất lưỡi là một khía cạnh trọng yếu, phản ánh tạng, huyết và dinh khí; cần xem màu thân lưỡi bên dưới rêu và không kết luận từ một dấu đơn độc.'},
  {id:'TC1-008',source:'TC1',page:8,topics:['rêu','màu rêu','độ dày','phân bố','gốc rêu','độ nhuận'],text:'Màu rêu chủ yếu hỗ trợ phân biệt hàn–nhiệt; độ dày phản ánh mức mạnh của tà khí/hư–thực; phân bố gợi vị trí/tiến triển; rêu có gốc hay không liên quan trạng thái khí; độ nhuận phản ánh tân dịch.'},
  {id:'TC1-009',source:'TC1',page:9,topics:['bình thường','đỏ nhạt','rêu trắng mỏng','ẩm'],text:'Lưỡi bình thường được mô tả đỏ nhạt, mềm mại, không nứt hay bệu/mỏng bất thường, rêu trắng mỏng và hơi nhuận; rêu ở gốc có thể hơi dày hơn.'},
  {id:'TC1-013',source:'TC1',page:13,topics:['phân vùng','tâm','phế','tỳ','vị','can','đởm','thận'],text:'Phân vùng thường dùng: đầu lưỡi tương ứng Tâm; vùng giữa đầu và trung tâm tương ứng Phế; trung tâm tương ứng Tỳ–Vị; gốc liên hệ Thận/Đại–Tiểu trường/Bàng quang; rìa trái Can, rìa phải Đởm. Đây là quy chiếu YHCT, phải phối hợp Tứ chẩn.'},
  {id:'TC1-020',source:'TC1',page:20,topics:['hàn','nhiệt','rêu trắng','rêu vàng','nhợt','đỏ'],text:'Hàn thường đi với chất lưỡi nhạt, rêu trắng và ẩm; nhiệt thường đi với chất lưỡi đỏ/đỏ sẫm và khô, thực nhiệt thường có rêu vàng còn hư nhiệt có thể ít hoặc không rêu.'},
  {id:'TC1-021',source:'TC1',page:21,topics:['tâm nhiệt','can nhiệt','vị nhiệt','phế nhiệt','vị trí'],text:'Tài liệu mô tả nhiệt theo vùng: đầu đỏ/chấm đỏ gợi Tâm nhiệt; rìa đỏ gợi Can nhiệt; vùng trung tâm với rêu vàng dày/chấm đỏ gợi Vị nhiệt; phần trước với rêu vàng mỏng có thể gợi Phế nhiệt. Chỉ dùng như tín hiệu YHCT, không suy thành bệnh cơ quan.'},
  {id:'TC1-022',source:'TC1',page:22,topics:['khí hư','dương hư','tỳ khí hư','dấu răng','bệu'],text:'Khí hư có thể biểu hiện lưỡi bệu; Tỳ khí hư thường có dấu răng và hơi bệu. Dương hư thường làm chất lưỡi nhợt và rất ẩm, rêu trắng mỏng; hình thái cụ thể còn phụ thuộc tạng phủ và triệu chứng.'},
  {id:'TC1-023',source:'TC1',page:23,topics:['huyết hư','âm hư','tróc rêu','khô'],text:'Huyết hư thường làm chất lưỡi nhạt và hơi khô. Âm hư làm hao tân dịch, có thể khiến lưỡi đỏ/đỏ sẫm, khô và tróc hoặc mất rêu; Vị âm hư thường bắt đầu ở vùng trung tâm.'},
  {id:'TC1-024',source:'TC1',page:24,topics:['thận âm hư','tâm âm hư','phế âm hư','nứt'],text:'Thận âm hư có thể biểu hiện lưỡi đỏ/đỏ sẫm, khô, tróc rêu và nứt; Tâm âm hư thường đỏ hơn ở đầu; Phế âm hư có thể đỏ, tróc, khô và có nứt vùng trước. Phải đối chiếu triệu chứng lâm sàng.'},
  {id:'TC1-025',source:'TC1',page:25,topics:['thực','huyết ứ','tím','đốm tím'],text:'Thực chứng thường được hỗ trợ bởi rêu dày và chất lưỡi tương đối cứng/bệu tùy thể. Huyết ứ thường biểu hiện chất lưỡi tím hoặc có đốm đỏ sẫm/tím; vị trí đốm chỉ là dấu quy chiếu, không đủ chẩn đoán bệnh.'},
  {id:'TC1-026',source:'TC1',page:26,topics:['đàm','rêu dày','trơn','nhầy','bát cương'],text:'Đàm ẩm thường đi với rêu dày, trơn hoặc như phủ mỡ. Tổng hợp bát cương cần xét đồng thời màu/hình chất lưỡi với màu, độ dày và phân bố rêu.'},
  {id:'TC1-027',source:'TC1',page:27,topics:['bát cương','bảng','biểu','lý','hàn','nhiệt','hư','thực'],text:'Bảng bát cương tóm tắt: phong hàn thường rêu trắng mỏng; phong nhiệt ban đầu rêu mỏng trắng rồi có thể chuyển vàng; hàn thiên rêu trắng/chất nhạt; nhiệt thiên lưỡi đỏ/rêu vàng; hư và thực phải phân biệt bằng phối hợp màu, hình và rêu.'},
  {id:'TC1-047',source:'TC1',page:47,topics:['mặt dưới','tĩnh mạch dưới lưỡi','qc','tư thế'],text:'Mặt dưới lưỡi và hai tĩnh mạch hai bên nếp dưới lưỡi nên được quan sát bổ sung; không đưa lưỡi quá mạnh vì có thể làm tĩnh mạch căng giả. Cần quan sát chủ yếu kích thước và màu.'},
  {id:'TC1-048',source:'TC1',page:48,topics:['tĩnh mạch dưới lưỡi','khí trệ','huyết ứ','màu tối','giãn'],text:'Theo tài liệu, tĩnh mạch dưới lưỡi căng nhưng không tối gợi khí trệ; sắc tối gợi huyết ứ; căng giãn thiên thực, nhỏ mỏng thiên hư. Đây là diễn giải YHCT và không được dùng đơn độc để chẩn đoán bệnh.'},

  {id:'DY1-012',source:'DY1',page:12,topics:['ý nghĩa lâm sàng','chất lưỡi','rêu','tiến lui'],text:'Tài liệu nhấn mạnh thiệt chẩn giúp xét thịnh suy chính khí, nông sâu bệnh vị, tính chất bệnh và xu thế tiến/lui. Chất lưỡi và rêu là chỉ tiêu khách quan nhưng vẫn phải phối hợp toàn diện.'},
  {id:'DY1-014',source:'DY1',page:14,topics:['chất lưỡi','rêu','kết hợp','hàn nhiệt','hư thực'],text:'Xem chất lưỡi chủ yếu để biện hư–thực của chính khí; xem rêu để xét nông–sâu tà khí và tình trạng Vị khí. Chất và rêu phải được kết hợp, không tách rời.'},
  {id:'DY1-015',source:'DY1',page:15,topics:['qc','ánh sáng','tư thế','thứ tự'],text:'Phương pháp khám yêu cầu ánh sáng chuẩn, lưỡi đưa tự nhiên không gắng, quan sát nhanh; thứ tự gồm nhuận/khô, màu sắc, sạch/bẩn, dày/mỏng, tróc hay không rồi mới xem các dấu hình thái khác.'},
  {id:'DY1-016',source:'DY1',page:16,topics:['nhiễm màu','ăn uống','thời tiết','tứ chẩn'],text:'Ăn uống có thể gây nhiễm màu rêu; thức ăn kích thích hoặc lượng nước uống có thể làm đổi màu/độ nhuận. Tài liệu nhắc phải phối hợp tứ chẩn và không kết luận chỉ từ lưỡi.'},
  {id:'DY1-018',source:'DY1',page:18,topics:['màu chất lưỡi','nhợt','đỏ','đỏ sẫm','xanh tím'],text:'Phân loại màu thân lưỡi gồm nhợt, đỏ nhạt, đỏ, đỏ sẫm và xanh/tím. Nhợt thiên hư/hàn; đỏ thiên nhiệt; đỏ sẫm thiên nhiệt sâu; xanh/tím liên hệ hàn, huyết ứ hoặc tình trạng nhiệt cực tùy bối cảnh.'},
  {id:'DY1-019',source:'DY1',page:19,topics:['hình lưỡi','già non','mập','mỏng','nứt'],text:'Hình thái được xét qua già/non, mập/to, ốm/mỏng và vết nứt. Lưỡi mập thường liên hệ khí/dương hư kèm thủy thấp hoặc đàm thấp; lưỡi mỏng phải xét màu để phân biệt huyết/âm bất túc.'},
  {id:'DY1-020',source:'DY1',page:20,topics:['dấu răng','gai','chấm đỏ','ứ huyết'],text:'Dấu răng ở rìa thường được liên hệ Tỳ hư/thấp; gai/chấm đỏ thiên nhiệt; các chấm/ban sẫm có thể liên hệ huyết ứ. Cần xem vị trí, màu và các đặc điểm đi kèm.'},
  {id:'DY1-023',source:'DY1',page:23,topics:['rêu trắng','rêu vàng','rêu xám','rêu đen'],text:'Rêu trắng thiên biểu/hàn; rêu vàng thiên lý/nhiệt; rêu xám/đen thường thiên lý và bệnh nặng hơn, nhưng phải phân biệt khô hay nhuận để xét nhiệt cực hay hàn/thấp.'},
  {id:'DY1-024',source:'DY1',page:24,topics:['rêu dày','rêu mỏng','nhuận','khô','nhầy'],text:'Rêu mỏng thường gặp bệnh nhẹ/biểu; rêu dày gợi tà vào lý hoặc tích trệ. Rêu khô cho thấy tân dịch tổn thương; rêu nhuận/trơn gợi thủy thấp; rêu nhầy/dính thường liên hệ thấp trọc, đàm hoặc thực tích.'},
  {id:'DY1-025',source:'DY1',page:25,topics:['rêu tróc','mặt gương','gốc rêu','lệch rêu'],text:'Rêu tróc hoặc bóng/mặt gương liên hệ suy giảm Vị khí/Vị âm hay khí âm tùy màu thân lưỡi; rêu có gốc hay không và phân bố lệch giúp đánh giá chính–tà và vị trí nhưng không được dùng tách rời.'},
  {id:'DY1-026',source:'DY1',page:26,topics:['tóm tắt','màu','hình','rêu'],text:'Tóm tắt của tài liệu quy nạp: lưỡi nhợt thiên hư/hàn; đỏ thiên nhiệt; ốm mỏng thiên khí huyết/âm hư; già cứng thiên thực/nhiệt; mập non thiên khí hư, dương hư hoặc đàm thấp tùy phối hợp.'},
  {id:'DY1-027',source:'DY1',page:27,topics:['tóm tắt rêu','trắng','vàng','dày','mỏng','nhầy','bóng','ít rêu'],text:'Tóm tắt rêu: trắng thiên biểu/hàn, vàng thiên lý/nhiệt; dày thiên thực/tà sâu, mỏng thiên hư/tà nhẹ; nhầy thiên đàm thấp/thấp nhiệt; bóng hoặc ít rêu thiên Vị khí/Vị âm suy hay âm hư tùy bối cảnh.'},
  {id:'DY1-047',source:'DY1',page:47,topics:['ca mẫu','bình thường','đỏ nhạt','rêu trắng mỏng'],text:'Ca hình mẫu số 1 minh họa lưỡi đỏ nhạt, mập vừa, rêu trắng mỏng nhuận và được tài liệu xếp là hình ảnh bình thường.'},
  {id:'DY1-048',source:'DY1',page:48,topics:['ca mẫu','dấu răng','tỳ hư','thấp'],text:'Ca hình mẫu số 2 minh họa lưỡi đỏ nhạt có dấu răng, rêu trắng mỏng trơn nhuận; tài liệu liên hệ với Tỳ hư/thấp thịnh trong bối cảnh phù hợp.'}
];

const CORE_IDS = new Set([
  'TC1-005','TC1-007','TC1-008','TC1-009','TC1-013','TC1-020','TC1-025','TC1-026','TC1-047','TC1-048',
  'DY1-014','DY1-015','DY1-023','DY1-024','DY1-025','DY1-027'
]);

function sourceLabel(entry){
  const doc=KNOWLEDGE_DOCUMENTS.find(d=>d.id===entry.source);
  return `${entry.id} | ${doc?.title||entry.source} | trang PDF ${entry.page}`;
}
export function formatEvidence(entries){
  return entries.map(e=>`[${sourceLabel(e)}] ${e.text}`).join('\n');
}
export const CORE_TONGUE_EVIDENCE = formatEvidence(TONGUE_EVIDENCE.filter(e=>CORE_IDS.has(e.id)));

function normalize(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
export function selectTongueEvidence(input,limit=12){
  const q=normalize(input);
  const scored=TONGUE_EVIDENCE.map((e,index)=>{
    let score=CORE_IDS.has(e.id)?0.2:0;
    for(const topic of e.topics){const t=normalize(topic);if(t&&q.includes(t))score+=3;else for(const token of t.split(/\s+/)){if(token.length>=4&&q.includes(token))score+=0.45;}}
    if(q.includes(normalize(e.source)))score+=0.5;
    return {e,score,index};
  });
  scored.sort((a,b)=>b.score-a.score||a.index-b.index);
  const chosen=scored.filter(x=>x.score>0.2).slice(0,limit).map(x=>x.e);
  if(chosen.length<Math.min(8,limit)){
    for(const e of TONGUE_EVIDENCE){if(chosen.length>=Math.min(8,limit))break;if(CORE_IDS.has(e.id)&&!chosen.includes(e))chosen.push(e);}
  }
  return chosen.slice(0,limit);
}

export function citationInstruction(){
  return `QUY TẮC DẪN CHỨNG: chỉ được viện dẫn các mã nguồn xuất hiện trong KHỐI DẪN CHỨNG. Khi nêu một nhận định YHCT, gắn ít nhất một dẫn chứng ở dạng [TC1, tr. 20] hoặc [DY1, tr. 24]. Không bịa tên sách/trang. Nếu khối dẫn chứng không hỗ trợ kết luận, phải nói chưa đủ căn cứ. Dẫn chứng là trang PDF.`;
}
