export const MENTOR_CASE_20260921=Object.freeze({
  role:'visual-mentor-regression-not-gold',
  source:'user-supplied-screenshot-review',
  imageStored:false,
  privacy:'No source image or identity is stored in this fixture.',
  intendedUse:'Regression target for observable tongue features only; not a diagnostic label.',
  top:Object.freeze({
    tongueColor:'đỏ nhạt',
    coatingColor:'trắng',
    coatingThickness:'dày trung tâm–sau',
    moisture:'nhuận/ướt',
    shape:'bản rộng/mập vừa theo hình chiếu 2D',
    toothmarks:'không thấy dấu răng rõ hoặc chỉ nghi nhẹ nếu edge gate sát ngưỡng',
    medianSulcus:'có thể có rãnh giữa nông; không tự gọi là nứt bệnh lý',
    redSpots:'không thấy tín hiệu nổi bật',
    stasis:'không thấy dấu tím/ứ rõ ở mặt trên'
  }),
  bottom:Object.freeze({
    undersideVisible:true,
    bilateralVesselsVisible:true,
    vesselColor:'tím/xanh tím',
    prominence:'mức vừa',
    dilation:'không kết luận nếu thiếu chuẩn kích thước',
    tortuosity:'không kết luận nếu thiếu chuẩn hình học'
  }),
  guardrails:Object.freeze([
    'đỏ nhạt không được quy thành nhợt',
    'rêu trắng dày/nhuận không tự động đồng nghĩa hư hàn',
    'atlas similarity không phải xác suất chẩn đoán',
    'dấu răng cần mẫu lõm bờ lặp lại, không dùng một lõm đơn độc',
    'mặt dưới phải giữ mô tả màu/cấu trúc tách khỏi suy luận ứ trệ'
  ])
});
