# A.I THIỆT CHẨN — LOCAL-FIRST RUNTIME V1

Ngày khởi tạo: 2026-09-21  
Nhánh: `feat/local-runtime-v1-20260921`  
Base production checkpoint: `a9394a8db80e2c5818b8febee50d37a2c8d99a91`

## 1. Mục tiêu

Xây dựng phiên bản cài trực tiếp trên Android và Windows 11, xử lý ảnh và tri thức cục bộ bằng phần cứng của thiết bị, sau đó chỉ gửi kết quả cấu trúc cần thiết lên AI server để bàn luận, bổ sung và tạo báo cáo cuối.

Mục tiêu cốt lõi:
- Giảm phụ thuộc mạng và hạ tầng cloud.
- Tận dụng CPU/GPU/NPU/RAM/SSD/ROM của thiết bị.
- Cho phép làm việc offline ở mức Local Vision + local retrieval + local grounded reasoning.
- Khi có mạng, server chỉ nhận kết quả đã chuẩn hóa để thảo luận và tổng hợp; ảnh gốc không bắt buộc phải gửi.
- Thiết bị cấu hình cao được tự động mở mức xử lý cao hơn.
- Dữ liệu/models/tri thức có thể cập nhật tự động hoặc thủ công.
- Không làm thay đổi production hiện tại cho đến khi Local Runtime qua kiểm định độc lập.

## 2. Kiến trúc tổng thể

### 2.1. Lớp giao diện
Giữ tối đa giao diện web hiện tại và đóng gói bằng Tauri 2 để chạy Windows + Android. Tauri dùng WebView cho UI, Rust cho logic điều phối chung, và plugin native cho phần cứng nền tảng.

### 2.2. Device Runtime Coordinator
Một bộ điều phối local chịu trách nhiệm:
- nhận diện phần cứng;
- benchmark ngắn lần đầu;
- chọn execution backend;
- chọn độ phân giải/model/quantization;
- quản lý RAM/VRAM/NPU budget;
- quản lý hàng đợi ảnh;
- điều phối pipeline;
- theo dõi nhiệt độ/điện năng khi API nền tảng cho phép;
- hạ cấp tự động nếu lỗi hoặc quá tải.

### 2.3. Inference Broker
Không khóa app vào một backend duy nhất.

Windows:
- Windows ML + ONNX Runtime là backend chính.
- Windows 11 24H2+: ưu tiên EP phù hợp NPU/GPU/CPU.
- Windows 11 cũ hơn: ONNX Runtime CPU/DirectML fallback.

Android:
- ONNX Runtime là baseline tương thích.
- LiteRT/ExecuTorch adapter dùng khi phần cứng hỗ trợ tốt hơn.
- NPU/GPU backend được probe + benchmark thay vì chỉ suy đoán theo tên SoC.
- Luôn có CPU fallback.

### 2.4. Local Vision Pipeline
Chuỗi chuẩn:
1. Capture/import.
2. Decode + EXIF orientation.
3. QC: blur, exposure, framing, tongue visibility.
4. ROI detection/segmentation.
5. Color normalization có kiểm soát.
6. Feature extraction.
7. Chuyên biệt:
   - chất lưỡi;
   - màu/rêu;
   - dày/mỏng/phân bố;
   - moisture;
   - rãnh giữa vs fissure;
   - toothmarks khi có classifier hợp lệ;
   - mặt dưới lưỡi / bilateral vessel signal.
8. Confidence + limitations.
9. Xuất JSON cấu trúc.

### 2.5. Local Knowledge + Case Retrieval
- SQLite read-only snapshot.
- FTS5 cho truy vấn từ khóa/thuật ngữ.
- Có thể bổ sung vector index ở V2.
- Dùng lại logic `case-retrieval.mjs` và `local-grounded-reasoning.mjs`.
- Chỉ lấy top-k ca liên quan; không nạp toàn bộ corpus vào RAM.

### 2.6. Local Reasoning
Local reasoning không được tự bịa quan sát ảnh.
Đầu vào chỉ gồm:
- output thị giác;
- QC;
- atlas/case retrieval;
- ontology/rule pack;
- metadata phiên bản.

Đầu ra:
- `LocalAnalysisEnvelope`;
- đặc điểm quan sát;
- độ tin cậy;
- thể bệnh tương đồng dạng hỗ trợ học tập/tham vấn;
- điểm chưa đủ căn cứ;
- các ca/nguồn đối chiếu;
- provenance.

### 2.7. Server Augmentation
Khi online:
- gửi `LocalAnalysisEnvelope` lên AI server;
- mặc định KHÔNG gửi ảnh gốc;
- server bàn luận, đối chiếu tri thức bổ sung, hỏi thêm triệu chứng khi cần;
- tạo báo cáo cuối;
- trả kết quả về local;
- local lưu cache kết quả.

Nếu offline:
- hiển thị kết quả local;
- tạo job `pending-server-discussion`;
- tự gửi khi mạng trở lại nếu người dùng bật đồng bộ.

## 3. Tự nhận diện và hiệu chỉnh thiết bị

### 3.1. Dữ liệu phần cứng cần thu
- OS/version.
- CPU arch + logical cores.
- RAM khả dụng.
- storage free/total.
- GPU API/capability.
- NPU/accelerator availability.
- supported model precisions.
- execution providers có thể tải/chạy.
- camera capability.
- pin/thermal state nếu nền tảng cho phép.

### 3.2. Quy tắc chọn cấu hình
Không dựa hoàn toàn vào tên chip. Mỗi thiết bị chạy micro-benchmark an toàn ở lần đầu và sau khi đổi model lớn.

Tier dự kiến:
- L0 Compatibility: CPU fallback, model INT8 nhỏ, ảnh 256–384.
- L1 Standard: CPU/GPU, ảnh 384–512.
- L2 Accelerated: GPU/NPU, ảnh 512–640, nhiều head hơn.
- L3 High: NPU/GPU mạnh, 640–768, multipass chọn lọc.
- L4 Workstation/Flagship: ensemble/second-pass + local text model tùy chọn.

Tier cuối cùng = capability probe + benchmark + thermal/memory guard.

### 3.3. Dynamic degradation
Nếu OOM/thermal/backend error:
1. giảm batch về 1;
2. giảm input size;
3. tắt multipass;
4. chuyển FP16 -> INT8 nếu có;
5. đổi NPU/GPU -> CPU;
6. vẫn trả kết quả với cờ `degraded=true`.

## 4. Gói dữ liệu local

Định dạng logic: `.aitcpack`

Cấu trúc:
- `manifest.json`
- `manifest.sig`
- `models/vision/*.onnx`
- `models/config/*.json`
- `knowledge/cases.sqlite`
- `knowledge/ontology.json`
- `knowledge/rules.json`
- `atlas/*`
- `prompts/*` nếu có local LLM
- `release-notes.json`

Mỗi artifact có:
- id;
- version;
- size;
- sha256;
- platform;
- minimum app/runtime version;
- optional hardware constraints.

## 5. Cập nhật từ Google Drive

Google Drive đóng vai trò nguồn phát hành admin, không nhúng khóa Drive dài hạn trong client.

### Auto update
1. App gọi manifest endpoint.
2. Endpoint lấy/đối chiếu manifest đã ký từ Drive.
3. Client tải artifact thay đổi.
4. SHA-256 verify.
5. Signature verify.
6. Giải mã local.
7. Staging.
8. Health-check.
9. Atomic swap.
10. Giữ 1 phiên bản rollback.

### Manual update
- Người dùng/admin chọn file `.aitcpack`.
- App verify signature + digest.
- Không đúng chữ ký => từ chối cài.

## 6. Mã hóa và bảo mật

### At rest
- Pack được mã hóa.
- DB/models nhạy cảm nằm trong app-private storage.
- Android: khóa bảo vệ bởi Android Keystore.
- Windows: khóa local bằng DPAPI/CNG.
- Không lưu API key/server secret trong frontend.

### In transit
- TLS.
- Gửi structured result trước.
- Raw image chỉ gửi khi tính năng yêu cầu và có quyền rõ ràng.

### Integrity
- SHA-256 từng artifact.
- Manifest ký Ed25519.
- Version anti-rollback.
- Provenance gắn vào mọi kết quả.

## 7. Hợp đồng dữ liệu chính

`LocalAnalysisEnvelope` gồm:
- schemaVersion
- appVersion
- runtimeVersion
- modelSetVersion
- knowledgeVersion
- deviceProfile
- executionProfile
- imageHashes
- qc
- observations
- localRetrieval
- localReasoning
- confidence
- limitations
- provenance
- degraded
- offline
- timestamp

Server không được sửa phần observation gốc; chỉ được thêm:
- discussion;
- differential reasoning;
- questions;
- source-grounded notes;
- finalReport.

## 8. Tận dụng trực tiếp từ code hiện tại

Có thể tái sử dụng:
- `public/hardware-profile.js`: logic tier sơ bộ.
- `public/local-vision/model-runtime.js`: manifest + digest + runtime contract.
- `local-vision-engine.mjs`: schema observation và chính sách bảo thủ.
- `local-grounded-reasoning.mjs`: grounded reasoning.
- `case-retrieval.mjs`: SQLite/FTS top-k.
- `public/sw.js`: release/cache semantics, nhưng native app sẽ thay Service Worker bằng Native Update Manager.

Không bê nguyên:
- browser-only hardware detection;
- WebGPU/WASM làm backend chính;
- direct Storage upload bắt buộc;
- logic phụ thuộc navigator/service worker.

## 9. Kế hoạch phát triển theo giai đoạn

### Phase 0 — Contract freeze
Mục tiêu:
- khóa schema LocalAnalysisEnvelope;
- khóa manifest/update pack;
- khóa server API mới;
- không sửa behavior production.

Gate:
- JSON schema validate;
- backward-compatible mapping với API hiện tại.

### Phase 1 — Native shell + bridge
Android + Windows:
- Tauri app;
- UI hiện tại chạy local bundle;
- native command bridge;
- file access;
- camera/import;
- app-private storage;
- network status.

Gate:
- mở app offline;
- chọn ảnh;
- lưu local;
- không cần server.

### Phase 2 — Hardware probe + benchmark
- CPU/RAM/storage;
- GPU/NPU provider discovery;
- model micro-benchmark;
- tự tạo DeviceExecutionProfile;
- UI hiển thị profile kỹ thuật ở Admin/Diagnostics.

Gate:
- profile ổn định qua restart;
- fallback không crash.

### Phase 3 — Local Vision baseline
- đóng gói model hiện có;
- ONNX baseline;
- QC/ROI;
- top tongue pipeline;
- bottom tongue pipeline;
- local result JSON.

Gate:
- cùng ảnh phải cho output schema tương thích hệ thống hiện tại;
- không tự sinh kết luận ngoài model.

### Phase 4 — Local retrieval + reasoning
- SQLite snapshot;
- FTS;
- top-k;
- local grounded reasoning;
- provenance.

Gate:
- offline hoàn toàn vẫn tạo được local report;
- memory bounded.

### Phase 5 — Server discussion bridge
- endpoint nhận envelope;
- queue offline;
- retry/idempotency;
- final report merge.

Gate:
- mất mạng giữa chừng không mất ca;
- reconnect gửi đúng một lần logic.

### Phase 6 — Drive pack updater
- admin manifest;
- automatic delta update;
- manual import;
- signature/digest;
- atomic swap;
- rollback.

Gate:
- update lỗi không phá runtime đang chạy.

### Phase 7 — Accelerator optimization
Android:
- LiteRT/ExecuTorch adapters;
- QNN/MediaTek/Exynos/Vulkan khi tương thích.

Windows:
- Windows ML EP Catalog;
- NPU/GPU optimization;
- optional Foundry Local cho text model.

Gate:
- benchmark chứng minh cải thiện trước khi bật mặc định.

### Phase 8 — Validation
Ma trận:
- Android yếu / trung bình / flagship.
- Snapdragon / MediaTek / Exynos nếu có.
- Windows x64 không NPU.
- Windows x64 GPU rời.
- Copilot+ / NPU.
- mạng tốt / yếu / offline.
- RAM thấp / storage gần đầy.
- camera + upload file.

Không công bố % chính xác nếu chưa có bộ kiểm định thực tế.

### Phase 9 — Release
- Beta kín.
- telemetry chỉ số kỹ thuật, không lấy ảnh mặc định.
- crash/error diagnostics.
- signed installer:
  - Android APK/AAB;
  - Windows MSIX/installer.
- sau khi đạt gate mới xem xét merge production.

## 10. Ưu tiên triển khai

P0:
- schema;
- native shell;
- local file/camera;
- hardware probe;
- ONNX local baseline;
- SQLite retrieval;
- server envelope.

P1:
- secure pack updater;
- auto rollback;
- NPU/GPU acceleration;
- offline queue.

P2:
- local small LLM;
- vector retrieval;
- iOS/macOS;
- advanced ensemble.

## 11. Nguyên tắc an toàn kỹ thuật

- Local Vision là nguồn duy nhất cho observation ảnh.
- LLM không được tạo feature ảnh không có trong observation.
- Không tuyên bố chẩn đoán/chắc chắn vượt dữ liệu.
- Không gửi raw image lên server mặc định.
- Không kích hoạt model mới chỉ vì benchmark nhanh hơn; phải qua quality validation.
- Mỗi kết quả phải ghi model/data/runtime version.
- Production hiện tại không bị thay đổi trong giai đoạn phát triển local.

## 12. Checkpoint hiện tại

Đã tạo nhánh riêng từ production checkpoint:
- `feat/local-runtime-v1-20260921`
- base `a9394a8db80e2c5818b8febee50d37a2c8d99a91`

Bước code kế tiếp:
1. thêm schema `LocalAnalysisEnvelope`;
2. thêm schema `AITCPackManifest`;
3. scaffold `local-runtime/` cho Tauri;
4. dựng DeviceExecutionProfile bridge Windows/Android;
5. chưa tạo deployment production.
