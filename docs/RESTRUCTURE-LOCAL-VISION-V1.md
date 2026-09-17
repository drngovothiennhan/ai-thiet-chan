# A.I Thiệt Chẩn — Restructure Local Vision V1

## Mục tiêu khóa

1. Gemini không nhận ảnh, base64 hoặc media nhúng.
2. Tầng thị giác nội bộ/local là nguồn duy nhất tạo quan sát hình ảnh.
3. Gemini chỉ nhận kết quả cấu trúc sau khi tầng thị giác hoàn tất để tư vấn, giải thích và tạo báo cáo.
4. Không tạo đặc điểm ảnh giả khi tầng thị giác không xác minh được dữ liệu.
5. Production hiện tại không bị thay đổi trong quá trình tái cấu trúc. Toàn bộ thay đổi thực hiện trên branch riêng và chỉ đưa lên production sau khi đủ gate.

## Kiến trúc đích

Ảnh
→ QC
→ Local Vision Runtime
→ Payload kiểm chứng bằng digest/schema
→ Local Vision Engine
→ Academic/Atlas Fusion
→ Kết quả JSON có provenance
→ Gemini text-only 3.8 → 3.6
→ tư vấn / báo cáo / hội thoại

Gemini không nằm trong đường đi từ ảnh đến feature vector.

## Phần giữ lại

- request-client + request-integrity;
- access-control và quota hiện hữu;
- hardware/device profiling;
- worker pool lazy allocation;
- academic signature + corpus/atlas đã có provenance;
- payload digest/schema verification phía server;
- Supabase case storage và benchmark telemetry, với model provenance được đổi sang local vision engine;
- UI/PWA đang ổn, không sửa ngoài những điểm cần để bỏ đường vision cũ.

## Phần loại bỏ khỏi runtime hoạt động

- đường gửi ảnh trực tiếp tới Gemini generateContent;
- Gemini Vision failover 3.8 → 3.6;
- analysis-hotfix cũ vừa chạy Gemini vừa tự dựng fallback CV song song;
- các tên/authority cũ cho phép hiểu server-provider là tầng quan sát ảnh.

Git history không bị rewrite. “Xóa dấu vết cũ” trong kế hoạch này nghĩa là loại bỏ mã cũ khỏi cây runtime hiện hành của branch tái cấu trúc để không còn hai đường xử lý cạnh tranh.

## Tham khảo mã nguồn mở

### TongueDiagnosis.AI — TonguePicture-SKaRD/TongueDiagnosis
Kiến trúc tham khảo: localization → segmentation → feature classification → LLM consultation.
License dự án: AGPL-3.0. Chỉ dùng làm tham khảo kiến trúc; không sao chép mã hoặc trọng số AGPL vào dự án này.

### RTDS-Tongue_Analysis
Mẫu thiết kế hai tầng: tách ROI bằng segmentation trước, sau đó classification. Điểm phù hợp là tách rõ “nhìn thấy gì” khỏi “diễn giải gì”. Chỉ tham khảo kiến trúc cho tới khi xác minh license từng artifact.

### ONNX Runtime Web
Runtime ưu tiên cho mô hình local đã chuyển ONNX. Mục tiêu backend: WASM làm baseline; WebGPU chỉ bật sau capability check và parity test. Không tuyên bố tăng tốc trước benchmark thiết bị thật.

### Transformers.js
Tham khảo adapter model chạy trực tiếp trong browser, hỗ trợ image classification và segmentation. Không dùng model generic làm kết luận thiệt chẩn; chỉ dùng runtime/adapter nếu model đã được huấn luyện hoặc hiệu chỉnh trên dữ liệu phù hợp.

### MediaPipe Tasks Vision
Tham khảo cách tổ chức on-device vision, lifecycle tài nguyên và worker/browser execution. Không dùng face/pose model của MediaPipe để suy luận thiệt tượng.

### OpenCV
Tham khảo QC, tiền xử lý, histogram/contrast, blur/exposure và ROI utilities. Không dùng threshold heuristic như ground truth lâm sàng.

## Giai đoạn thực thi

### Stage 0 — Isolation & contract
- branch riêng: restructure-local-vision-v1;
- production/main không thay đổi;
- khóa contract: Gemini text-only;
- health endpoint phải công bố geminiVision=false.

Trạng thái: DONE.

### Stage 1 — Remove provider vision path
- /api/analyze không gọi Gemini;
- runtime-guard chặn mọi Gemini request có inline media trước network;
- xóa analysis-hotfix cũ khỏi loader, SW cache và test chain;
- local-vision-engine-v1 nhận payload đã được server xác minh;
- các field chưa có classifier riêng phải trả “Không xác định”.

Trạng thái: DONE trên branch tái cấu trúc; CI #415 đã PASS trước khi bắt đầu Stage 2. Chưa merge production.

### Stage 2 — Model runtime mới
- trạng thái: IN PROGRESS;
- đã tạo `public/local-vision/model-manifest.js` và `public/local-vision/model-runtime.js` làm hạ tầng mới, chưa gắn model giả hoặc URL model từ xa;
- manifest hiện ở `awaiting-trained-artifacts`, chỉ cho phép shadow-only;
- runtime kiểm SHA-256 model trước khi tạo session, WASM là baseline, WebGPU chỉ được dùng khi artifact có `webgpuParityApproved=true`;
- tạo model adapter độc lập với UI;
- ưu tiên ONNX Runtime Web WASM;
- WebGPU optional, không bắt buộc;
- model manifest có version, SHA-256, input shape, labels, calibration metadata;
- worker sở hữu inference; main thread chỉ điều phối;
- tách model: tongue ROI/segmentation và feature classifiers;
- fallback: service-worker signature hoặc fail-closed, không gọi Gemini Vision.

Gate: model artifact thật + license/provenance + reproducible checksum. Hiện gate này CHƯA ĐẠT vì chưa có model huấn luyện/đánh giá hợp lệ; hệ thống không giả lập model để vượt gate.

### Stage 3 — Dataset & training/evaluation
- khóa split train/validation/test theo source/hash để tránh leakage;
- không biến 729 context/negative samples thành tongue-positive;
- đánh giá segmentation riêng với classification;
- confusion matrix cho từng feature class;
- threshold/calibration được lưu trong model manifest;
- không dùng benchmark giả.

Gate: metric thật trên holdout và error analysis.

### Stage 4 — Browser/device validation
- Android constrained / balanced / high;
- iOS Safari fallback;
- memory, thermal, reload, worker teardown, camera release;
- PWA distinct-release update race;
- parity cùng ảnh giữa CPU/WASM và WebGPU nếu WebGPU được bật.

Gate: physical-device evidence.

### Stage 5 — Shadow release
- preview/staging nhận traffic kiểm thử;
- production vẫn chạy bản hiện tại;
- so sánh output cấu trúc, failure rate, latency và persistence;
- chỉ merge khi không có regression auth/quota/storage/PWA.

### Stage 6 — Production cutover
- backup/checkpoint trước merge;
- deploy production;
- health + smoke + one real-case persistence;
- theo dõi lỗi;
- rollback ngay nếu local vision contract hoặc access/storage gate lỗi.

## Quy tắc không được phá

- không cho Gemini xem ảnh;
- không dùng Gemini để bù đặc điểm ảnh còn thiếu;
- không gán “độ giống atlas” thành chẩn đoán;
- không gọi heuristic hiện tại là model học sâu;
- không tuyên bố độ chính xác khi chưa có holdout metric;
- không merge production chỉ vì CI xanh;
- không xóa dữ liệu sản xuất hoặc rewrite Git history để “làm sạch”.
