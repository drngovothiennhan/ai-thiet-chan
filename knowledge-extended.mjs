export const EXTENDED_KNOWLEDGE_DOCUMENTS = [
  {
    id:'MC1',
    title:'Chẩn đoán bằng mạch chẩn và thiệt chẩn',
    author:'GS. Trần Thúy; TS. Vũ Nam',
    publisher:'Nhà xuất bản Y học',
    edition:'Tái bản lần thứ nhất có sửa chữa, 2006',
    file:'Chẩn đoán bằng mạch chẩn và thiệt chẩn.pdf',
    driveFileId:'17kFAC-7WOFbzqpr-WGeq5eDkS9eXzQXS',
    sha256:'336de613f28b26b3122ccee33d395bd57ed91ee3342df42fd84a99d0eadf3dea',
    pages:92,
    role:'clinical-tongue-and-pulse-reference'
  },
  {
    id:'AT1',
    title:'Thiệt chẩn bằng hình ảnh',
    file:'Thiệt chẩn bằng hình ảnh_967525.pdf',
    driveFileId:'1wX4WhR9pcfsbVrfVhQQks4lS4UZWkjEn',
    sha256:'2105100126eba2fb7ea59ad7a048a1fdd269caed8d7de243ff8001617df4fc3f',
    pages:41,
    role:'visual-tongue-atlas'
  },
  {
    id:'TCATLAS1',
    title:'THIỆT CHẨN(1) - atlas hình người dùng bổ sung 2026-09-19',
    file:'15351142bc528dde2083f39297a0bf5f_THIỆT CHẨN(1).pdf',
    sha256:'9d7d3a359024fa137b697bd7bc698ebf840fbcef17e35eda199b04cf15639d2c',
    pages:41,
    role:'owner-supplied-silver-visual-atlas',
    policy:'visual-description-and-source-specific-teaching-association-only; not clinical gold'
  },
  {
    id:'PSY1',
    title:'Tâm bệnh học',
    author:'TS. Phạm Toàn',
    publisher:'Nhà xuất bản Trẻ, 2019',
    file:'Tâm bệnh học.pdf',
    driveFileId:'1pm6Rx0LoJKFjbJCqqS-cWqDZUTLhWdNd',
    sha256:'f4a78b248d83dfbaa2364fd203bc25c440956c92c568f98802ec8645c824fd67',
    pages:150,
    role:'psychopathology-context-reference'
  }
];

// Diễn giải ngắn có truy nguyên trang PDF. Nội dung PSY1 chỉ dùng cho bối cảnh
// thập vấn/tâm lý sau thiệt chẩn; tuyệt đối không suy bệnh tâm thần từ hình lưỡi.
export const EXTENDED_EVIDENCE = [
  {id:'MC1-077',source:'MC1',page:77,topics:['tứ chẩn','thiệt chẩn','vọng chẩn','phối hợp'],text:'Tài liệu đặt thiệt chẩn trong vọng chẩn và nhắc hệ chẩn đoán YHCT gồm vọng, văn, vấn, thiết; quan sát lưỡi là một phần của quy trình chẩn đoán chứ không phải nguồn dữ kiện duy nhất.'},
  {id:'MC1-078',source:'MC1',page:78,topics:['giải phẫu lưỡi','mô học','sinh lý','quan sát'],text:'Phần giải phẫu–mô học mô tả thân lưỡi, đỉnh lưỡi, rãnh giữa, các nhóm cơ và cấu trúc nền; đây là cơ sở để phân biệt cấu trúc giải phẫu nhìn thấy với dấu bệnh lý hoặc rêu lưỡi.'},
  {id:'MC1-080',source:'MC1',page:80,topics:['nhú lưỡi','niêm mạc','mạch máu','mặt dưới'],text:'Niêm mạc mặt lưỡi có nhiều loại nhú và mặt dưới có cấu trúc khác mặt trên; quan sát hình ảnh cần phân biệt nhú sinh lý, niêm mạc và mạch máu trước khi gán ý nghĩa bệnh lý.'},
  {id:'MC1-082',source:'MC1',page:82,topics:['khám lưỡi','tổn thương tại chỗ','chất lưỡi','rêu lưỡi','diễn tiến'],text:'Khi khám lưỡi cần phát hiện tổn thương khu trú, các biến đổi chất lưỡi và rêu lưỡi; phải kết hợp lưỡi với triệu chứng khác và dùng biến đổi lưỡi để theo dõi diễn tiến chứ không tách khỏi bối cảnh toàn thân.'},
  {id:'MC1-083',source:'MC1',page:83,topics:['loét lưỡi','u lưỡi','viêm lưỡi','cờ đỏ','chuyển khám'],text:'Tài liệu liệt kê viêm, loét, tổn thương lành tính và u ác tính tại lưỡi. Các tổn thương khu trú bất thường không nên bị quy thành thể YHCT từ ảnh; cần nêu cờ đỏ và khuyến nghị khám trực tiếp khi phù hợp.'},

  {id:'AT1-001',source:'AT1',page:1,topics:['bình thường','đỏ nhạt','rêu trắng mỏng','nhuận'],text:'Atlas minh họa lưỡi bình thường: chất lưỡi hơi hồng/đỏ nhạt, mềm mại, hoạt động tự nhiên, rêu trắng mỏng, sạch và phân bố tương đối đều, khô ướt vừa phải.'},
  {id:'AT1-003',source:'AT1',page:3,topics:['nhợt','bệu','dấu răng','rêu trắng','nhuận'],text:'Ca hình ảnh lưỡi trắng nhợt, non bệu, hai bên có dấu hằn răng, rêu trắng trong và nhuận được atlas xếp về nhóm hư/hàn, nhấn mạnh tổ hợp hình–màu–rêu thay vì một dấu riêng lẻ.'},
  {id:'AT1-005',source:'AT1',page:5,topics:['đỏ','gai','rêu vàng','rêu dày','nhiệt'],text:'Ca lưỡi đỏ, nhiều gai đỏ, rêu dày vàng là mẫu hình ảnh thiên nhiệt; khi ứng dụng phải mô tả dấu thấy được trước rồi mới nêu tín hiệu YHCT và giới hạn.'},
  {id:'AT1-008',source:'AT1',page:8,topics:['tím','dấu răng','rêu trắng','nhuận','hàn','ứ'],text:'Atlas có ca lưỡi xanh tím/tối, hai rìa có dấu hằn răng, rêu trắng mỏng và nhuận; đây là mẫu cho thấy màu tím phải được đối chiếu đồng thời độ ẩm, rêu và hình thể để phân biệt bối cảnh hàn/ứ.'},
  {id:'AT1-016',source:'AT1',page:16,topics:['đỏ','nứt','ít rêu','khô','tân dịch'],text:'Ca lưỡi đỏ nhiều rãnh nứt, rêu mỏng/ít được atlas liên hệ nhiệt lâu ngày làm tổn thương âm/tân dịch; hình ảnh đơn độc không đủ để xác định bệnh danh.'},
  {id:'AT1-018',source:'AT1',page:18,topics:['nhợt','dấu răng','rêu trắng dày','nhuận','thấp'],text:'Ca lưỡi nhợt, non bệu, dấu hằn răng, rêu trắng dày và nhuận là mẫu kết hợp thường được atlas liên hệ hàn thấp/Tỳ hư; cần giữ mức gợi ý khi chưa có vấn chẩn và mạch.'},
  {id:'AT1-022',source:'AT1',page:22,topics:['mặt dưới','tĩnh mạch dưới lưỡi','tím','giãn','huyết ứ'],text:'Atlas minh họa mặt dưới với mạch dưới lưỡi xanh tím và phình/giãn; đây là ví dụ hỗ trợ mô tả ứ trệ trong YHCT nhưng không được biến thành chẩn đoán bệnh hiện đại.'},
  {id:'AT1-029',source:'AT1',page:29,topics:['đỏ','rêu trắng','nứt','tân dịch'],text:'Ca lưỡi đỏ, rêu trắng, có nứt cho thấy cần đọc đồng thời màu thân lưỡi, rêu và độ ẩm; atlas liên hệ nhiệt kéo dài và tổn thương tân dịch trong bối cảnh phù hợp.'},
  {id:'AT1-031',source:'AT1',page:31,topics:['đỏ sẫm','rêu đen','khô','nhiệt','huyết ứ'],text:'Atlas có ca chất lưỡi đỏ sẫm/đỏ giáng với rêu đen khô; đây là mẫu lý chứng nặng trong ngôn ngữ YHCT, nhưng ứng dụng phải hạ tin cậy nếu màu ảnh hoặc yếu tố nhiễm màu không kiểm soát được.'},

  {id:'TCATLAS1-003',source:'TCATLAS1',page:3,topics:['nhuận','ướt','rêu trắng','nhợt','bệu','dấu răng'],text:'Trang 3 của atlas bổ sung mô tả lưỡi non bệu, sắc trắng nhợt, rêu trắng trong và nhuận; đây là ví dụ trực quan của bề mặt/rêu có độ ẩm, không phải ngưỡng số hóa phổ quát.'},
  {id:'TCATLAS1-004',source:'TCATLAS1',page:4,topics:['khô','rêu trắng','nhợt','mỏng nhỏ'],text:'Trang 4 mô tả lưỡi sắc nhạt, mỏng nhỏ với rêu trắng khô. Nhãn khô trong atlas là nhãn thị giác nguồn, phải được tách khỏi suy luận nguyên nhân và bệnh danh.'},
  {id:'TCATLAS1-018',source:'TCATLAS1',page:18,topics:['nhuận ướt','rêu trắng dày','nhợt','dấu răng','thấp'],text:'Trang 18 mô tả lưỡi nhợt, non bệu, dấu hằn răng, rêu trắng dày, nhuận và ướt; atlas liên hệ mẫu này với hàn thấp/Tỳ hư thấp thịnh trong ngôn ngữ YHCT. Ứng dụng chỉ được dùng như đối chiếu giáo khoa, không tự động gán thể từ ảnh.'},
  {id:'TCATLAS1-024',source:'TCATLAS1',page:24,topics:['lưỡi khô','rêu bẩn nát','đỏ','nứt','ít rêu','tân dịch'],text:'Trang 24 mô tả lưỡi đỏ mà khô, giữa có nứt, rêu vàng kiêm trắng bẩn/nát ở bốn bên và giữa lưỡi không có rêu; atlas gắn với các bối cảnh nhiệt/tân dịch trong lý luận YHCT, chỉ dùng làm bằng chứng nguồn có điều kiện.'},
  {id:'TCATLAS1-031',source:'TCATLAS1',page:31,topics:['khô nứt','rêu đen','đỏ giáng','nhiệt','tân dịch'],text:'Trang 31 mô tả lưỡi đỏ giáng, rêu đen dày đặc và khô nứt. Đây là ví dụ nguồn về phối hợp màu-rêu-độ ẩm, không cho phép suy mức độ bệnh nếu QC màu/ánh sáng không đạt.'},
  {id:'TCATLAS1-034',source:'TCATLAS1',page:34,topics:['rêu vàng khô','nứt nẻ','đỏ nhạt','tân dịch'],text:'Trang 34 mô tả lưỡi đỏ nhạt, nhiều đường nứt nhỏ, rêu vàng khô thành từng mảng và phần giữa ít rêu; atlas liên hệ với nhiệt thương tân/âm dịch hao tổn trong bối cảnh YHCT, không phải chẩn đoán từ ảnh đơn độc.'},

  {id:'PSY1-014',source:'PSY1',page:14,topics:['tâm bệnh học','định nghĩa','triệu chứng','chẩn đoán'],text:'Tâm bệnh học nghiên cứu các rối loạn tâm lý/tâm thần qua nguyên nhân, đặc tính, quá trình phát triển, phân loại, chẩn đoán và điều trị; một hiện tượng tâm lý riêng lẻ không tự động đồng nghĩa với bệnh.'},
  {id:'PSY1-018',source:'PSY1',page:18,topics:['chẩn đoán tâm thần','bối cảnh','chức năng','DSM'],text:'Việc xác định bất thường cần xét mức gây buồn khổ, rối loạn và thiệt hại chức năng sinh hoạt; các dấu hiệu phải được đặt trong bối cảnh chứ không chỉ dựa vào một biểu hiện.'},
  {id:'PSY1-022',source:'PSY1',page:22,topics:['lệch lạc','đau buồn','mất năng lực','nguy hại'],text:'Tài liệu trình bày bốn nhóm tiêu chí thường dùng để nhận diện tính bất thường: lệch lạc, đau buồn/distress, mất năng lực/dysfunction và nguy hại/danger; đây là khung lượng giá chứ không phải chẩn đoán từ ảnh.'},
  {id:'PSY1-027',source:'PSY1',page:27,topics:['chẩn đoán chuyên môn','nhiều yếu tố','không suy diễn'],text:'Tài liệu nhấn mạnh nhiều trường hợp không hội đủ cả bốn tiêu chí và chẩn đoán cần kinh nghiệm chuyên môn; không thể chỉ căn cứ vài biểu hiện riêng lẻ để kết luận bệnh tâm thần.'},
  {id:'PSY1-043',source:'PSY1',page:43,topics:['đa yếu tố','sinh học','tâm lý','xã hội','điều trị'],text:'Nguyên nhân rối loạn tâm thần được trình bày theo hướng đa yếu tố bên trong và bên ngoài; thực hành hiện đại thường phối hợp nhiều chuyên môn và không quy một triệu chứng cho một nguyên nhân duy nhất.'},
  {id:'PSY1-044',source:'PSY1',page:44,topics:['liên ngành','đánh giá','điều trị phối hợp'],text:'Tài liệu nhấn mạnh cách tiếp cận liên ngành khi lượng giá và điều trị; với A.I Thiệt Chẩn, kiến thức này chỉ dùng để định hướng câu hỏi an toàn sau phân tích, không dùng làm nhãn thị giác cho lưỡi.'}
];

export const PSYCH_CONTEXT_RULES = `
NGUYÊN TẮC DÙNG TÂM BỆNH HỌC:
- Không suy rối loạn tâm thần, stress, lo âu, trầm cảm hoặc nguy cơ tự hại từ hình lưỡi.
- Chỉ kích hoạt kiến thức Tâm bệnh học trong chatbot/Thập vấn sau khi đã có kết quả thiệt chẩn và người dùng chủ động nêu triệu chứng tâm lý, cảm xúc, hành vi hoặc suy giảm chức năng.
- Khi có dữ kiện tâm lý, tách rõ: điều người dùng tự báo cáo, ảnh lưỡi quan sát được, và nhận định cần đánh giá chuyên môn.
- Không dùng tài liệu Tâm bệnh học để tạo quan hệ nhân quả mới giữa một dấu lưỡi và một chẩn đoán tâm thần.
`;
