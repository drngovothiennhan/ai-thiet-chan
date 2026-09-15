# A.I Thiệt Chẩn — kiểm định và nâng cấp tiếp nối

## Điểm bắt đầu xác minh

- Repository: `drngovothiennhan/ai-thiet-chan`; nhánh `qa/pre-release-gate-20260915`.
- PR #1 Draft, chưa merge; head `07b6bdfb6ede8e79405ca2411f5d4da7e27c9d4b`.
- GitHub CI #145, run `34986597145`: success.
- Vercel production mới nhất trong danh sách: `dpl_BLFwng7kNz9V56JLC6DSVEAu1hcA`, source `d34454e3061dff7de0cbbcc2dbb00828cd3c4aee`, READY. Không phát hành thay đổi phiên này.

## Thay đổi trong phạm vi được giao

1. Timeout bao trùm cả header/body; vẫn hoạt động khi caller có AbortSignal. Hủy stream và giới hạn kích thước phản hồi.
2. Tối đa 4 yêu cầu AI đồng thời mỗi process, không xếp hàng vô hạn; trả 503 và Retry-After trước khi parse ảnh lớn. Deadline request 45 giây, hủy công việc khi kết nối đóng.
3. Lưu ca có ngân sách tổng 6 giây, bỏ chuỗi retry ba lần; lỗi lưu giữ kết quả phân tích và trả collection error. Lỗi giao dịch có thể xảy ra sau khi server dữ liệu đã ghi; không tuyên bố chắc chắn chưa ghi.
4. Kiểm tra chữ ký ảnh hữu hạn/đủ chiều. Evidence readiness tính từ dữ liệu trước fusion; chỉ đếm tín hiệu đủ ngưỡng, không đếm tín hiệu suy ra như bằng chứng Gemini mới.
5. Một tín hiệu trực tiếp không được tính đồng thời thành tầng Gemini. Phủ định rõ như “không đỏ” không kích hoạt quy tắc dương tính. Đây là bộ lọc thận trọng, chưa phải phân tích ngôn ngữ lâm sàng đầy đủ.
6. Ảnh QC kém/không thấy lưỡi không sinh tín hiệu biện luận hoặc learning candidate. Vector lưu trữ đồng bộ với kết quả sau fusion. Vision JSON thiếu cấu trúc tối thiểu bị từ chối; lỗi fusion không bị nuốt rồi lưu ca như thành công.
7. Đồng nhất hash ảnh giữa trình duyệt/server; giới hạn chờ truy xuất ca đã duyệt và tổng hợp bổ sung. Chatbot dự phòng dùng thêm học liệu truy xuất liên quan câu hỏi; báo đúng nguồn local-knowledge/provider.
8. Trace trả model thực tế/failover/latency; benchmark đọc trace, có timeout và nhận academicSignature từ manifest. Không suy ra fallback từ model cấu hình.

Giữ nguyên chuỗi Gemini 3.8 Flash / 3.6 Flash, trọng số 45/35/20, điều kiện 2/3 tầng, 5 học liệu và toàn bộ chỉ mục. Không thêm model hoặc huấn luyện trọng số. Ba tầng bằng chứng không được xem là ba phép đo độc lập về thống kê.

## Bằng chứng kiểm tra

- Baseline `npm run check`: PASS trước sửa.
- Tái hiện trực tiếp baseline: một tín hiệu trực tiếp được nhận thành 2 tầng (1 accepted pattern); phủ định “không đỏ / không vàng” vẫn sinh 1 pattern. Bản sửa: cả hai bằng 0.
- `node tests/ai-upgrade-behavior.mjs`: PASS; stream treo, giới hạn body, caller cancellation, chặn tải/phục hồi, đồng nhất hash, nguồn gốc bằng chứng, QC, vector sau fusion và phủ định.
- `node tests/ai-upgrade-http.mjs`: PASS; Express thật, upstream giả lập, failover/trace, lưu vector cuối, body lưu ca treo được thoát trong ngân sách 6 giây, JSON vision thiếu bị từ chối.
- `npm run check`: PASS, gồm toàn bộ gate sẵn có và hai bộ kiểm tra mới; Node 24.19.0.
- `git diff --check`: PASS.
- Test corpus xác nhận 5 tài liệu, 1.157 trang, 1.027 lần xuất hiện ảnh được lập chỉ mục; 298 chữ ký trang + 298 chữ ký ảnh. Số chỉ mục không phải số mẫu đã huấn luyện hoặc số ca kiểm định.

## Tiêu chí còn chưa đạt bằng chứng để nghiệm thu >8,0

| Nhóm | Trạng thái |
|---|---|
| Chống treo và tính nhất quán pipeline | Kiểm tra hành vi và HTTP giả lập PASS; chưa stress test môi trường triển khai |
| Đối chiếu ảnh, biện luận, học ca | Các lỗi kỹ thuật nêu trên đã sửa; chưa có bộ ảnh giữ riêng kèm nhãn chuyên gia để đo độ đúng |
| Chatbot và ca đã duyệt | Có sửa timeout/hash/nguồn dự phòng; chưa kiểm định chất lượng trả lời và tích hợp kho duyệt thật |
| UI/UX | Gate cấu trúc responsive PASS; chưa visual regression trên QA build mới |
| P50/P95, success/fallback thực tế | Chưa có kết quả ảnh thật của bản nâng cấp; không dùng số giả lập để thay thế |

Không gán điểm >8,0 hoặc tỷ lệ chính xác khi chưa có dữ liệu thực nghiệm. Chưa merge hoặc deploy production. Điểm tiếp tục: chạy build QA từ commit chứa checkpoint này, dùng bộ ảnh good/fair/poor/non-tongue cố định và nhãn chuyên gia; kiểm tra UI, độ đúng và latency, rồi quyết định release. Không chạy fixture giả vào kho ca production.
