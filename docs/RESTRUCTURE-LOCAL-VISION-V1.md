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

### Stage 2 — Model runtime + bootstrap candidate
- trạng thái: IN PROGRESS, đã đạt gate kỹ thuật cho **candidate shadow**, chưa đạt gate gold/production;
- model thật đã được huấn luyện: `aitc-tongue-roi-mlp-bootstrap-v1`, pixel MLP 12→24→12→1, dùng cho tongue ROI segmentation;
- model JSON SHA-256: `43c64af91d4bf5b9cd6ad8a9d26b3c045817243966a7869743bbc72ff5e21174`;
- dữ liệu bootstrap thực tế: 479 ảnh trích từ TC1/DY1/MC1/AT1, gồm 298 weak-positive và 181 weak-negative;
- split chống leakage theo group nguồn+trang, SHA ảnh nguồn và dHash gần trùng (Hamming ≤ 8); kết quả audit: 0 group cross-split, 0 exact-SHA cross-split;
- split cố định: train 337, validation 60, test 82; toàn bộ 41 ảnh AT1 được giữ ở test làm source-external holdout;
- nhãn là **weak supervision từ runtime mask hiện hữu**, không phải nhãn bác sĩ/chuyên gia;
- metric lưu trong repo chỉ có nghĩa **agreement with weak bootstrap masks**, tuyệt đối không gọi là clinical accuracy;
- `04_Nhan_chuyen_gia_Annotations` hiện chưa có gold label; Supabase cũng chưa có approved feedback/learned knowledge đủ điều kiện làm gold;
- manifest chuyển sang `candidate-shadow`, `activation=shadow-only`, `clinicalGold=false`, `productionEligible=false`;
- candidate chạy bằng dedicated shadow worker **sau khi response chính đã trả về**, không thay đổi kết quả người dùng và không chặn pipeline chính;
- shadow telemetry chỉ lưu model/hash/latency/coverage/presence + hardware class; không đưa output candidate vào assessment;
- ONNX Runtime Web/WASM vẫn là runtime đích cho model production sau này; WebGPU chỉ bật sau parity gate;
- không tạo ONNX giả: môi trường huấn luyện hiện chưa có package ONNX để chuyển đổi candidate này;
- Gemini Vision vẫn bị cấm hoàn toàn.

Gate còn thiếu trước khi có thể gọi là model được kiểm định:
1. clinician-approved segmentation masks/labels độc lập;
2. gold holdout không dùng trong training/tuning;
3. metric thật trên gold holdout + error analysis;
4. physical-device shadow evidence;
5. candidate/champion promotion thủ công.

Các metric bootstrap hiện tại chỉ để regression kỹ thuật: validation Dice 0.9589 / IoU 0.9258; test Dice 0.9023 / IoU 0.8442; AT1 external Dice 0.8507 / IoU 0.7731. **Đây không phải độ chính xác lâm sàng và không được hiển thị như accuracy.**

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
