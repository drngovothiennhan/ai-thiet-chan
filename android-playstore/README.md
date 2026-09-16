# A.I Thiệt Chẩn · Android / Google Play

Gói Android này là lớp phát hành Google Play cho production web app `https://ai-thiet-chan.vercel.app/`.

## Định danh phát hành

- App name: **A.I Thiệt Chẩn**
- Package ID: `com.hiu.yhct.aithietchan`
- Version: `1.0.0` (`versionCode 1`)
- `compileSdk`: 36
- `targetSdk`: 36
- `minSdk`: 26
- Production URL: `https://ai-thiet-chan.vercel.app/`
- Privacy URL: `https://ai-thiet-chan.vercel.app/privacy.html`

## Quyền Android

- `INTERNET`: tải production app/API.
- `CAMERA`: chỉ được cấp cho origin production khi người dùng chủ động chụp ảnh lưỡi.
- Không khai báo vị trí, danh bạ, SMS, microphone hoặc quyền bộ nhớ rộng.

## Build nhanh bằng Android Studio

1. Mở thư mục `android-playstore` bằng Android Studio phiên bản hỗ trợ API 36.
2. Chờ Gradle sync.
3. Chọn **Build > Generate Signed App Bundle or APK > Android App Bundle**.
4. Dùng upload keystore của dự án; giữ an toàn keystore và mật khẩu để phát hành các bản cập nhật.
5. Tệp cần tải lên Play Console là `.aab` release đã ký.

## Build CI

Workflow `.github/workflows/android-playstore.yml` tạo AAB. Nếu chưa cấu hình signing secrets, workflow chỉ tạo bundle chưa ký để kiểm tra build. Khi có 4 secrets dưới đây, AAB được ký tự động:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Workflow giải mã keystore vào runner tạm thời, build và xóa cùng runner sau job.

## Lưu ý Play Store

Ứng dụng thuộc nhóm sức khỏe/y tế và phải hoàn thành Health apps declaration. Listing phải giữ tuyên bố: ứng dụng không phải thiết bị y tế, không chẩn đoán/điều trị/chữa khỏi/phòng ngừa bệnh và người dùng cần tham khảo nhân viên y tế có chuyên môn.
