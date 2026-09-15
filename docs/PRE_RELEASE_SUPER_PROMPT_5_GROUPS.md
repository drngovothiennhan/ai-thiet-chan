# A.I THIỆT CHẨN — SUPER PROMPT PRE-RELEASE 5 NHÓM

## 0. KHÓA PHẠM VI

Làm việc duy nhất trên nhánh `qa/pre-release-gate-20260915` cho A.I Thiệt Chẩn.

Mục tiêu: nâng chất lượng 5 nhóm trước deployment, ưu tiên nhóm điểm thấp để mọi nhóm đạt mức kỹ thuật mục tiêu >= 8/10. Không merge `main`, không deployment production, không đổi dữ liệu Knowledge, không giảm hoặc bỏ bất kỳ học liệu đã nạp, không thay đổi trọng số fusion 45% direct image / 35% atlas / 20% Gemini academic, không hạ điều kiện tối thiểu 2/3 tầng bằng chứng.

Cấm:
- dựng lại ứng dụng;
- thêm nhiều model/AI chỉ để tăng số lượng;
- tạo chẩn đoán giả khi vision thất bại;
- tự động đưa ca mới thành Knowledge đúng khi chưa duyệt;
- suy luận tâm bệnh từ ảnh lưỡi;
- chuyển bệnh danh từ atlas sang người dùng;
- sao chép mã/weights AGPL hoặc nguồn ngoài không tương thích giấy phép;
- thay đổi production trước khi toàn bộ release gate đạt.

## 1. NGUYÊN TẮC KIẾN TRÚC

Chỉ duy trì một pipeline chẩn đoán chuẩn:

`Capture -> QC -> Vision Provider Agent -> Normalize -> 5-doc Knowledge Fusion -> Safety/Evidence Gate -> Learning Decision -> Store -> UI`

Gemini 3.8 Flash là primary. Gemini 3.6 Flash chỉ là failover đa phương thức. Không bổ sung model thứ ba trong giai đoạn này.

Agent là bộ điều phối deterministic, không phải thêm một LLM: theo dõi trạng thái provider, circuit-breaker, timeout, failover, trace và quyết định lỗi an toàn.

## 2. ĐỐI CHIẾU GITHUB — CHỈ HỌC KIẾN TRÚC, KHÔNG CÀI Ồ ẠT

1. `TonguePicture-SKaRD/TongueDiagnosis`: tham chiếu chuỗi localization -> segmentation -> feature classification -> LLM. Repo AGPL-3.0 nên chỉ tham khảo kiến trúc, không sao chép mã/weights vào sản phẩm.
2. `cshan-github/TongueSAM` và `facebookresearch/segment-anything`: tham chiếu segmentation/mask để giảm nền ảnh; chưa thêm dependency/model trong phase này.
3. `Project-MONAI/MONAI`: tham chiếu chuẩn hóa preprocessing, evaluation metrics và reproducible medical-imaging workflow; không kéo PyTorch stack vào web app hiện tại.
4. `langchain-ai/langgraph`: tham chiếu state-machine, trace và deterministic workflow; triển khai nội bộ nhẹ, không thêm LangGraph dependency.
5. `evidentlyai/evidently`: tham chiếu data-quality/drift/novelty monitoring; triển khai metric tối thiểu bằng dữ liệu hiện có, không thêm package Python.
6. `microsoft/onnxruntime`: chỉ là hướng dự phòng tương lai nếu có model segmentation/classification đã kiểm định; không cài ở pre-release hiện tại.

## 3. 5 NHÓM NÂNG CẤP — MỖI NHÓM 5 VIỆC

### NHÓM A — UI/UX
1. Giữ luồng chính Capture -> QC -> Analyze -> Result rõ ở lớp đầu.
2. Phân biệt rõ trạng thái provider, pipeline và data store; không dùng trạng thái xanh giả khi AI vision không hoàn tất.
3. Lỗi vision/rate-limit phải diễn đạt ngắn, đúng nguyên nhân và không thay bằng chẩn đoán cục bộ.
4. Dashboard chỉ hiển thị chỉ số vận hành/dữ liệu; không biến confidence thành accuracy lâm sàng.
5. Gate responsive/touch target/mobile-desktop phải nằm trong CI.

Mục tiêu: >= 8.5/10.

### NHÓM B — A.I / XỬ LÝ HÌNH ẢNH
1. Gemini 3.8 primary + 3.6 failover, không model thứ ba.
2. Thêm circuit-breaker nhẹ để không tiếp tục đập model đang lỗi liên tục.
3. Ghi trace latency/model/failover nhưng tuyệt đối không log ảnh/prompt chứa dữ liệu người dùng.
4. Khi cả hai model thất bại: trả unavailable, không tạo visual findings.
5. Benchmark bắt buộc success rate, fallback rate, P50/P95/max trên bộ ảnh cố định good/fair/poor/non-tongue.

Mục tiêu: >= 8.2/10 trước release; không tuyên bố độ chính xác chẩn đoán nếu chưa có ground truth chuyên gia.

### NHÓM C — AGENT / LOGIC PIPELINE
1. Dùng deterministic Provider Agent với state: select -> attempt -> failover -> safe-fail.
2. Mỗi ca phải có evidence profile cho 3 tầng direct / atlas / Gemini.
3. Giữ minimum 2/3 tầng bằng chứng; không thay đổi trọng số 45/35/20.
4. Chỉ lưu feature vector sau normalize + Knowledge fusion; cấm local bypass.
5. Trace phải đủ debug nhưng không chứa ảnh, token bí mật, prompt hoặc PII.

Mục tiêu: >= 9.0/10.

### NHÓM D — DỮ LIỆU / HỌC MÁY / CA MỚI
1. Giữ novelty threshold: novel <0.55, uncommon <0.72, covered >=0.72.
2. QC poor không được thành learning candidate; fair novel không được ưu tiên cao như good novel.
3. Learning candidate phải gắn evidence readiness; ca thiếu bằng chứng chuyển review, không tự học.
4. Không auto-promote ca mới vào Knowledge; chỉ hàng chờ duyệt.
5. Dashboard phải phát hiện legacy/local pipeline và theo dõi độ sạch pipeline lịch sử.

Mục tiêu: >= 8.8/10.

### NHÓM E — QA / RELEASE
1. CI bắt buộc syntax + smoke + pipeline safety + responsive gate.
2. Benchmark chạy trên QA/staging, mặc định từ chối production URL.
3. Không merge khi success rate/latency chưa có số thật hoặc còn blocker vision.
4. PR luôn Draft cho tới khi đủ gate; production không đổi trong giai đoạn này.
5. Rollback: giữ production hiện tại làm rollback candidate; mọi thay đổi phải độc lập và có test chống regression.

Mục tiêu: >= 9.2/10.

## 4. PHƯƠNG ÁN DỰ PHÒNG LỖI

- 429/5xx/timeout primary: failover sang 3.6; nếu lỗi lặp vượt ngưỡng thì circuit-breaker tạm bỏ qua model lỗi.
- Cả hai vision model lỗi: HTTP unavailable + thông báo thử lại; không fallback chẩn đoán cục bộ.
- Knowledge fusion lỗi: không làm giả academic evidence; ghi lỗi và chặn release nếu ảnh hưởng pipeline chính.
- Case store lỗi sau khi phân tích thành công: giữ kết quả phân tích nhưng báo storage failure; không chạy lại AI chỉ vì lỗi storage.
- CI regression: dừng tại commit lỗi, không merge; sửa tối thiểu đúng regression.
- Benchmark không đủ fixture/ground truth: đánh dấu BLOCKED, không bịa số.

## 5. RELEASE GATE CUỐI

Chỉ được đề nghị merge/deploy khi đồng thời:
- CI PASS;
- single diagnostic pipeline PASS;
- Knowledge 5-doc toàn vẹn, noSilentOmission=true;
- PSY1 context-only PASS;
- novelty/learning gate PASS;
- responsive UI gate PASS;
- benchmark có số thật P50/P95/success/fallback trên bộ fixture cố định;
- không còn blocker critical/high;
- PR vẫn chưa merge cho tới khi người dùng phê duyệt.

## 6. CÁCH BÁO CÁO

Chỉ báo: việc đã thực hiện, commit/head, CI, blocker thật, số benchmark thật nếu có, và điểm dừng. Không bịa, không mở rộng dự án, không thêm tính năng ngoài 5 nhóm trên.
