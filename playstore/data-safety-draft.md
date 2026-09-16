# Data Safety · bản nháp để khai Play Console

Bản này phải được đối chiếu lần cuối với production trước khi bấm Submit.

## Dữ liệu có thể được xử lý
- Photos and videos: ảnh lưỡi do người dùng chụp/chọn.
- Health info: dữ kiện sức khỏe/thiệt chẩn và nội dung Tham Vấn mà người dùng cung cấp.
- Personal info: thông tin tài khoản sinh viên do quản trị viên nạp để xác thực/quản lý quyền truy cập.
- App activity / diagnostics: lịch sử ca, chỉ số QC, thời gian xử lý, lỗi kỹ thuật và telemetry cần thiết.
- Device or other IDs: chỉ khai nếu production thực tế dùng mã định danh thiết bị/tài khoản có tính bền vững. Mã phân loại thiết bị thô không nên tự khai thành advertising ID.

## Mục đích
- App functionality
- Account management
- Analytics / diagnostics ở mức phục vụ độ ổn định hệ thống
- Fraud prevention / security nếu Play Console yêu cầu phân loại cho rate limiting, kiểm soát truy cập

## Chia sẻ / bên xử lý
Dữ liệu cần thiết có thể được truyền đến Google Gemini, Supabase và Vercel để cung cấp chức năng. Xác định lựa chọn “shared” trong Play Console theo định nghĩa của Google Play đối với service provider/data processor tại thời điểm khai báo; không tự khai “không chia sẻ” nếu chưa đối chiếu định nghĩa hiện hành.

## Security
- Data in transit: HTTPS/TLS.
- User deletion request: qua kênh hỗ trợ/nhà phát triển trên Google Play hoặc quản trị viên hệ thống.
- Không bán dữ liệu cho nhà quảng cáo theo chính sách công bố của ứng dụng.
