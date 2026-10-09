# Quyết định nghiệp vụ và mục chưa chốt

## Đã chốt
| ID | Quyết định |
|---|---|
| D01 | Chỉ triển khai Reading và Listening |
| D02 | Không có giáo viên, Speaking/Writing, lớp học hoặc assignment |
| D03 | Không có khóa học; khoảng 50 lesson, nhóm theo unit |
| D04 | Unit có ít nhất 5 lesson, không cố định số lesson |
| D05 | Placement là đề cố định 23 câu, dùng chung |
| D06 | Placement chỉ lưu/hiển thị; không CEFR, progress hoặc XP |
| D07 | Lesson gồm từ vựng, bài điền từ và test cuối |
| D08 | Hoàn thành các phần bắt buộc và đạt >=80% mới mở lesson kế |
| D09 | Sang lesson mới phải ôn từ vựng lesson trước |
| D10 | Chỉ mock test cộng XP |
| D11 | XP một đề = best score / max score x 100, tối đa 100 mỗi đề |
| D12 | Làm lại mock chỉ tính thành tích cao nhất, không cộng trùng |
| D13 | Progress tách Reading/Listening, loại placement |
| D14 | Không XP hoặc streak từ lesson, từ vựng, ôn tập |
| D15 | F00 bootstrap 2026-10-08: tạo monorepo/apps/packages scaffold theo stack đã chốt; chỉ health/runtime boundaries, không triển khai nghiệp vụ hoặc domain contracts |
| D16 | F01 public registration tạo STUDENT, bắt buộc xác minh email bằng OTP trước login; password dùng scrypt |
| D17 | F02A uses a reusable content-service media-storage boundary with an ignored local adapter for development/tests and the official ImageKit Node SDK for configured environments; credentials stay backend-only and no upload endpoint or media database model is introduced |
| D18 | F01 uses a short-lived HS256 JWT access token (default 15 minutes, configurable) and a cryptographically random refresh token (default 7 days, configurable); only the SHA-256 refresh hash is stored in app_identity |
| D19 | Refresh tokens are rotated on every refresh. A reused/revoked token revokes its entire token family; refresh rows retain family, expiry, replacement and revocation timestamps |
| D20 | Access and refresh tokens use HttpOnly, SameSite=Lax cookies. Secure is false only for local development and must be true in production. Public registration always creates STUDENT |
| D21 | F01 includes email OTP verification/resend, login/session/refresh/logout/me and forgot/reset password; it excludes OAuth, SMTP delivery claims require configured SMTP |

## TBD — không tự giả định
- Công thức tổng hợp progress và loại test được tính vào progress.
- Lesson 1 có yêu cầu hoàn thành placement trước hay không.
- Số câu, thời lượng, scoring conversion cho từng mock test.
- Retake lesson test dùng câu hỏi cũ hay chọn câu ngẫu nhiên.
- Làm tròn XP, hòa hạng và chu kỳ leaderboard.
- Quy tắc versioning khi đề đã xuất bản được sửa.
- Rate limiting and operational account recovery are outside F01.
- ImageKit private-file/signed-URL behavior for protected audio must be verified
  from current official documentation before F09 exposes audio delivery.
