# A.I Thiệt Chẩn — Local Runtime V1

Nhánh này là lát cắt local-first độc lập, không thay production và không merge `main` tự động.

## Đã thực thi trong lát cắt hiện tại

- Hợp đồng `LocalAnalysisEnvelope v1` và `AITC Pack Manifest v1` giữ nguyên.
- Bộ chọn `DeviceExecutionProfile` chỉ kích hoạt provider khi native probe báo `ready=true` và benchmark thực sự thành công; không suy đoán NPU/GPU từ tên chip.
- Native Vision adapter fail-closed: model shadow/candidate hoặc chưa `validationStatus=validated` + `productionEligible=true` không được nâng thành observation.
- Offline queue có idempotency, retry state và dead-letter semantics ở core; native shell đã có hàng đợi bền vững trong app-private data.
- Pack verifier kiểm chữ ký Ed25519 + SHA-256 artifact; native app fail-closed nếu chưa cấu hình khóa phát hành tin cậy lúc build.
- Signed-pack store dùng staging, health-check, thư mục version bất biến và state generation append-only để activation/rollback chịu lỗi tốt hơn; anti-rollback chặn hạ version trực tiếp.
- Native SQLite retrieval ưu tiên `cases.sqlite` của active signed pack.
- ONNX/provider probe chỉ báo `ready=true` sau khi runtime, model, session, benchmark và output validation đều có bằng chứng; ở checkpoint này production vision vẫn khóa.
- Tauri 2 shell cho Android/Windows, file-image input, native SHA-256, device probe tối thiểu và diagnostics.
- CI riêng tạo Windows NSIS và Android aarch64 APK nếu toolchain/build qua gate.

## Giới hạn đã khóa

Repository hiện chưa có ONNX artifact được kiểm định độc lập và chưa bundle `cases.sqlite`. Vì vậy shell **không được phép** tự tạo quan sát lâm sàng từ model shadow hiện có. GPU/NPU candidates hiển thị `ready=false` cho tới khi provider discovery + benchmark + quality validation có bằng chứng.

## Chạy smoke cục bộ

```bash
node local-runtime/tests/local-runtime-v1-smoke.mjs
```

## Native

```bash
cd local-runtime/native
npm install
npm run tauri build -- --bundles nsis
npm run tauri android init -- --ci
npm run tauri android build -- --apk --target aarch64
```

Không phát hành artifact này vào production cho tới khi các gate vision/retrieval/update pack được hoàn tất và kiểm định trên thiết bị thật.
