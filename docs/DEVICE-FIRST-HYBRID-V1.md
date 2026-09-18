# A.I Thiệt Chẩn — Device-first Hybrid V1

## 1. Quyết định dữ liệu và kết quả kiểm tra lại nguồn thật

Theo quyết định kỹ thuật của chủ dự án, toàn bộ 1.027 image occurrences đã index từ KNOWLEDGE-5DOC được đăng ký là **owner-designated ground-truth training samples** (`owner-designated-ground-truth-v1`). Đây là provenance do chủ dự án chỉ định, không được mô tả thành đồng thuận chuyên gia độc lập.

Kiểm tra lại trực tiếp 5 PDF nguồn trong thư mục Drive `A.I Thiệt Chẩn/Knowledge` cho kết quả đúng 1.027 image occurrences:

| Source | File | Image occurrences | Tongue-specific signatures |
|---|---|---:|---:|
| TC1 | Thiệt chẩn hoàn chỉnh.pdf | 44 | 0 |
| DY1 | Đông y chẩn đoán bệnh trên lưỡi.pdf | 302 | 257 |
| MC1 | Chẩn đoán bằng mạch chẩn và thiệt chẩn.pdf | 92 | 1 |
| AT1 | Thiệt chẩn bằng hình ảnh_967525.pdf | 41 | 40 |
| PSY1 | Tâm bệnh học.pdf | 548 | 0 |
| **Tổng** | 5 PDF | **1.027** | **298** |

Điểm cần phân biệt rõ sau kiểm tra lại:
- 1.027/1.027 image occurrences có **global visual vector** nguồn thật `[r,g,b,s,v]` và được dùng trong training/reference corpus.
- 298/1.027 có thêm **tongue-specific segmentation signature** đủ điều kiện tham gia positive atlas / nearest-neighbour hình lưỡi.
- 729/1.027 còn lại không phải “vector giả” hay “dữ liệu bị mất”. Chúng là background/negative/context vectors và được dùng để tạo context boundary; không ép thành mẫu dương tính thiệt chẩn.
- Vì vậy coverage của training vector là **100% (1.027/1.027)**, còn coverage của positive tongue signature là **298/1.027**.

SHA-256 của 5 PDF đã dùng để tái kiểm tra được khóa trong `public/ground-truth-profile.js` để truy nguyên nguồn.

## 2. Kiến trúc xử lý trên thiết bị

1. Thiết bị nhận diện năng lực cục bộ: logical CPU cores, device memory khi browser cung cấp, network class, Web Worker, OffscreenCanvas, createImageBitmap, WebAssembly và WebGPU availability.
2. Scheduler chọn tier `constrained / balanced / high`.
3. Backend đang thực thi thật là `worker-canvas-cpu`. WebGPU/WASM được ghi nhận là capability có sẵn nhưng **không được báo là đang sử dụng accelerator** khi chưa có kernel/model tương thích.
4. Worker xử lý ngoài main thread: visual signature, coarse visual features, global visual vector, đối chiếu positive atlas, context gate dựa trên profile 1.027 mẫu và SHA-256 ảnh.
5. Ảnh mặt dưới có schema riêng `bottom-device-feature-v1`, chỉ lưu đặc trưng số học (vessel-candidate ratio, dark-purple ratio, luminance, red/blue-minus-green); không tự suy đường kính, tortuosity hay bệnh danh.
6. Main thread chỉ điều phối UI/request. Ảnh tổng quát top/bottom chỉ chạy song song khi tier cho phép.
7. Worker tự terminate sau idle để giảm giữ RAM/nhiệt; lần phân tích sau tự tạo lại pool.
8. Nếu Worker/OffscreenCanvas/createImageBitmap không khả dụng, runtime fail-open về pipeline server hiện hữu; không làm app treo.

## 3. Phân phối luồng theo thiết bị

- **constrained**: 1 worker, top/bottom tuần tự, không yêu cầu accelerator.
- **balanced**: tối đa 2 workers; có thể top/bottom song song.
- **high**: tối đa 3 workers; vẫn dùng worker-canvas-cpu ở phiên bản này, không giả báo WebGPU acceleration.

Không dùng `workers = hardwareConcurrency` vì có thể tăng peak memory và nhiệt độ thiết bị.

## 4. Thứ tự request bắt buộc

Pipeline browser phải giữ đúng thứ tự:

`image enhancement (priority 100) -> device compute (priority 90) -> các lớp request còn lại -> request-integrity seal -> server`

Device runtime phải được load trước `request-integrity.js`, nếu không request pipeline có thể bị seal trước khi local compute đăng ký.

## 5. PWA / Service Worker

Service Worker phải:
- cache `device-runtime.js`, `device-analysis-worker.js`, `ground-truth-profile.js` và các academic atlas dependencies;
- **không ghi đè** `academicSignature`/provenance khi request đã có `deviceRuntime.status=complete` và digest hợp lệ;
- chỉ tự tạo academic signature ở chế độ `service-worker-fallback` khi local device runtime không cung cấp được signature;
- fallback signature phải kèm SHA-256 của đúng base64 payload để server có thể kiểm tra.

## 6. Server trust boundary

Server không được tin mù dữ liệu client. `academic-server.mjs` kiểm tra trước fusion:
- runtime version = `device-runtime-v2`;
- schema = `device-analysis-payload-v2`;
- worker version = `device-analysis-worker-v2`;
- top image digest do client gửi phải bằng SHA-256 do server tự tính trên đúng ảnh request;
- bottom digest phải khớp trước khi bottom features được lưu;
- profile phải khai báo đúng 1.027 training samples / 1.027 global vectors / 298 diagnostic signatures / 729 context samples;
- signature và bottom numeric features phải nằm trong miền giá trị hợp lệ.

Server tự chạy lại `matchAtlas(signature)`; không sử dụng danh sách match do client gửi như kết quả đáng tin cậy.

Payload không vượt gate sẽ không được dùng cho academic fusion. Gemini/server pipeline chính vẫn hoạt động bình thường.

## 7. Phạm vi giảm tải đã có thật

Đã chuyển sang thiết bị:
- hardware capability detection;
- image enhancement (đã có trước);
- visual signature;
- coarse visual features;
- global vector;
- positive atlas nearest match;
- 1.027-sample diagnostic-vs-context profile gate;
- image SHA-256;
- bottom-view numeric feature extraction;
- top/bottom scheduling.

Chưa được phép tuyên bố “server chỉ đọc kết quả” ở production vì Gemini Vision vẫn là authoritative analysis path hiện tại. Không có benchmark thực tế thì không công bố phần trăm giảm CPU/server/Gemini.

## 8. Điều kiện để chuyển từ staging sang production

Bắt buộc còn các gate thực tế sau:
- Android low/mid/high tier test bằng browser/PWA thật.
- iOS/Safari fallback test thật.
- Kiểm tra signature parity giữa worker và reference implementation trên cùng ảnh.
- Đo elapsed time, peak memory/tab reload và nhiệt độ/thermal symptom ở thiết bị thật; không dùng số giả.
- Camera/PWA: chụp xong phải release camera như production hiện hành và không bị service-worker race.
- Supabase case persistence không thay đổi hoặc mất `featureVector`.
- Gemini/provider fallback không bị device layer làm thay đổi auth/quota/error semantics.
- Chỉ sau khi benchmark chứng minh local path ổn định mới xem xét feature flag cho chế độ server không nhận raw image ở các ca đủ điều kiện.

Nếu chưa có dữ liệu thiết bị thật, trạng thái benchmark phải ghi `INSUFFICIENT REAL-DEVICE TELEMETRY`, không suy diễn mức tăng tốc hay tỷ lệ tiết kiệm.
