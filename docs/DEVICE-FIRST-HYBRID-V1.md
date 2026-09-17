# A.I Thiệt Chẩn — Device-first Hybrid V1

## Quyết định dữ liệu

Theo quyết định kỹ thuật của chủ dự án, toàn bộ 1.027 image occurrences đã index từ KNOWLEDGE-5DOC được xem là **owner-designated ground-truth training samples** của hệ thống.

Trạng thái hiện có phải được giữ minh bạch:
- indexed image occurrences: 1.027
- visual signatures hiện có: 298
- các occurrence chưa có visual signature KHÔNG được tự tạo vector giả; phải vectorize từ ảnh nguồn thật trước khi tham gia nearest-neighbor inference.

## Kiến trúc

1. Thiết bị nhận diện năng lực cục bộ: logical CPU cores, device memory khi browser cung cấp, network class, Web Worker, OffscreenCanvas, createImageBitmap, WebAssembly và WebGPU.
2. Scheduler chọn execution plan theo tier constrained / balanced / high.
3. Ảnh được xử lý trong dedicated worker khi trình duyệt hỗ trợ: decode, signature, coarse visual class, atlas/ground-truth nearest matches, checksum/metadata.
4. Main thread chỉ điều phối UI và request; không chạy vòng lặp pixel nặng khi worker path hoạt động.
5. Payload gửi server kèm `deviceAnalysis`, `deviceRuntime` và provenance của ground-truth.
6. Server không được tin mù payload client: model/runtime/schema version phải được kiểm tra; quyết định lâm sàng cuối cùng vẫn phải tuân thủ policy hiện có.
7. Khi runtime local không khả dụng, tự fallback pipeline hiện hữu; không chặn người dùng.

## Phân phối luồng

- constrained: 1 worker, xử lý tuần tự hai ảnh, không yêu cầu WebGPU.
- balanced: tối đa 2 worker, top/bottom có thể xử lý song song khi đủ RAM.
- high: tối đa 3 worker, ưu tiên WebGPU khi có model tương thích; WASM/CPU luôn là fallback.

Không dùng `workers = hardwareConcurrency` vì dễ tăng peak memory và nhiệt độ thiết bị.

## Điều kiện để chuyển từ staging sang production

- Android low/mid/high tier benchmark thật.
- iOS/Safari fallback test thật.
- Kết quả signature/match giữa main-thread reference và worker không sai khác ngoài tolerance đã định.
- Không tăng crash/tab reload.
- Không làm thay đổi auth, quota, Supabase persistence hoặc clinical boundary.
- Chỉ công bố 1.027 mẫu được dùng trực tiếp cho inference sau khi đủ 1.027 vector thật; trước đó UI/health phải báo rõ số vectorized thực tế.
