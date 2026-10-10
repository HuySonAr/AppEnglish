# Quyết định nghiệp vụ và mục chưa chốt

## Đã chốt
| ID | Quyết định |
|---|---|
| D01 | Chỉ triển khai Reading và Listening |
| D02 | Không có giáo viên, Speaking/Writing, lớp học hoặc assignment |
| D03 | Không có khóa học; khoảng 50 lesson, nhóm theo unit |
| D04 | Unit có ít nhất 5 lesson, không cố định số lesson |
| D05 | Placement là đề cố định 23 câu, dùng chung |
| D06 | Placement chỉ lưu/hiển thị; không CEFR, progress hoặc XP (được sửa bởi D29: điểm cao mở khóa trước một số unit) |
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
| D22 | F01 fix 2026-10-09: verify-email rejects DISABLED/SUSPENDED accounts (403, không kích hoạt lại); resend-verification không bao giờ tạo session — tài khoản ACTIVE nhận `nextAction: LOGIN` mà không cấp cookie, chỉ PENDING_VERIFICATION nhận OTP mới. Web client luôn unwrap envelope `{code,msg,data}` của auth-api qua `accountFromEnvelope` trong `features/auth/flow/auth-flow.js`; verify OTP thành công nhưng tải session thất bại hiển thị lỗi tải session và chuyển về /login, không hiển thị "OTP sai" |
| D23 | F01 fix 2026-10-09: register email PENDING_VERIFICATION trả `ADDITIONAL` + `nextAction: VERIFY_EMAIL` (không tạo account trùng, không đổi password, không gửi OTP tự động); email ACTIVE trả `AUTH_EMAIL_ALREADY_REGISTERED` và UI hướng login/quên mật khẩu. Login chỉ trả `AUTH_EMAIL_NOT_VERIFIED` + `nextAction: VERIFY_EMAIL` sau khi password khớp; sai password luôn `AUTH_INVALID_CREDENTIALS`. Controller không double-wrap envelope của service và login phát hành `setCookies` (lỗi zod strip key lạ làm mất cookie); OTP đơn dùng được kiểm tra `usedAt` tường minh; verify email đã ACTIVE trả `nextAction: LOGIN` |
| D24 | F01B account administration uses backend ADMIN checks per request, append-only account audit rows, sessionVersion/refresh revocation on role/status changes, and a one-time env-driven bootstrap command; PENDING_VERIFICATION cannot be activated from the admin UI/API and the last active ADMIN is protected |
| D25 | F01B fix 2026-10-10: empty Admin list UI filters mean omission in the HTTP query. Explicit empty/invalid role/status queries remain invalid and use the existing 400 validation envelope. Isolated HTTP reproduction confirmed the former 500 before repository access; this finding does not establish empty account data in PostgreSQL, and no account status/default or migration is changed |
| D26 | F01/F01B fix 2026-10-10: mọi lỗi auth dùng envelope `{code,msg,data}` với mã số — thêm `AUTH_EMAIL_VERIFICATION_REQUIRED` (25), `AUTH_FORBIDDEN_ROLE` (26, thay chuỗi `FORBIDDEN_ROLE`) và `NextAction.RESET_PASSWORD` vào auth-contracts; lỗi do gateway phát sinh dùng `SYSTEM_ERROR` (32). Admin detail/update và resend-verification chuẩn hóa lỗi về 4xx thay vì 500. `verify-email`/`reset-password` trả `AUTH_OTP_INVALID` cho email không tồn tại để không lộ email. Web client refresh phiên qua một Axios interceptor dùng chung (một lần refresh, một lần replay). `lint` backend kiểm tra cú pháp toàn bộ `src`/`test` qua `scripts/check-syntax.mjs`. Không đổi schema, migration hay dữ liệu |
| D27 | 2026-10-10: Gateway → auth-service dùng gRPC. Contract là `packages/auth-contracts/proto/auth.proto` (package `appenglish.auth.v1`, service `AuthService`, 12 RPC auth + `Ready`). Gateway giữ HTTP surface và cookie; auth-service giữ validation Zod và nghiệp vụ, trả `AuthReply { http_status, code, msg, data_json, set_cookies }`. auth-service không còn route HTTP `/auth/*`, chỉ còn HTTP health; cổng gRPC cấu hình bằng `AUTH_GRPC_HOST`/`AUTH_GRPC_PORT` (mặc định `localhost:50051`). Không đổi nghiệp vụ, schema hay dữ liệu |
| D28 | 2026-10-10: Phát audio Listening áp dụng cho bài thi đầu vào (placement), bài test cuối lesson và mock test. Không có feature F09 riêng: việc phát audio thuộc F03, F04 và F05 tương ứng, dùng media-storage boundary của F02A |
| D29 | 2026-10-10 (sửa D06): placement đạt điểm cao được mở khóa trước một số unit. Placement vẫn không cấp CEFR, không vào progress và không cộng XP. Chi tiết ở D35 |
| D30 | 2026-10-10: điểm lần làm đầu tiên của lesson test (bài test cuối lesson) dùng để xếp hạng học viên trong chính lesson đó. Không có bảng xếp hạng chung từ lesson test; các lần làm lại chỉ để qua mốc 80%. Tách khỏi XP; D10/D14 giữ nguyên (chỉ mock cộng XP) |
| D31 | 2026-10-10: mỗi lần làm mock test và lesson test, thứ tự các lựa chọn A/B/C/D của từng câu được xáo ngẫu nhiên. Chỉ xáo lựa chọn: không xáo thứ tự câu hỏi, không dùng ngân hàng câu hỏi |
| D32 | 2026-10-10: Practice là luyện tự do theo kỹ năng Reading hoặc Listening (Listening có phát audio). Câu hỏi lấy từ các lesson học viên đã hoàn thành. Hiện đáp án đúng và giải thích ngay sau mỗi câu. Không XP, không xếp hạng, không vào progress, làm lại không giới hạn |
| D33 | 2026-10-10: Progress gồm (a) mức hoàn thành = số lesson đã hoàn thành / tổng số lesson, và (b) mức thành thạo riêng cho Reading và Listening = trung bình điểm cao nhất của các lesson test và mock test đã làm, tính trên các câu hỏi thuộc kỹ năng đó. Placement và practice không tính |
| D34 | 2026-10-10: mỗi câu hỏi được gắn nhãn kỹ năng Reading hoặc Listening và có trường giải thích đáp án ngay từ F02, vì practice (D32) và progress (D33) phụ thuộc vào chúng |
| D35 | 2026-10-10: placement quyết định unit bắt đầu. Mặc định: dưới 60% bắt đầu ở unit 1, từ 60% ở unit 2, từ 80% ở unit 3; Admin cấu hình được các ngưỡng này. Các unit trước unit bắt đầu được mở tự do; từ unit bắt đầu trở đi theo quy tắc tuần tự. Lesson được mở sẵn không tính là hoàn thành. Student phải làm placement trước lesson 1 nhưng được bỏ qua (bỏ qua thì bắt đầu ở unit 1). Placement chỉ làm một lần. Lesson đầu tiên của unit bắt đầu được miễn bài ôn từ vựng lesson trước |
| D36 | 2026-10-10: bảng xếp hạng theo lesson (D30) xếp theo điểm lần làm đầu tiên, rồi thời gian làm bài ngắn hơn, rồi thời điểm nộp sớm hơn |
| D37 | 2026-10-10: số câu và thời lượng là thuộc tính của từng mock test do Content Manager nhập. Thời gian tính ở server; hết giờ hệ thống tự nộp. Không quy đổi điểm: điểm = số câu đúng / tổng số câu |
| D38 | 2026-10-10: mỗi lượt practice có 10 câu, chọn ngẫu nhiên theo kỹ năng từ các lesson đã hoàn thành, ưu tiên câu Student từng trả lời sai |
| D39 | 2026-10-10: lưu giá trị chính xác, hiển thị phần trăm nguyên. XP mỗi đề làm tròn thành số nguyên; XP cộng thêm = XP mới đã làm tròn − XP cũ đã làm tròn. Kỹ năng chưa có bài test nào hiển thị "Chưa có dữ liệu", không hiển thị 0%. Bảng XP hòa điểm thì ai đạt mức XP đó sớm hơn xếp trên. Chỉ có bảng XP tổng, không có bảng theo tuần/tháng |
| D40 | 2026-10-10: đề đã xuất bản là bất biến; mọi chỉnh sửa tạo version mới. Lượt làm dở hoàn thành trên version nó bắt đầu; kết quả cũ giữ nguyên. XP và điểm cao nhất gắn với đề, không gắn với version, và so sánh theo tỉ lệ phần trăm. "Lần làm đầu tiên" của lesson test (D30) tính theo lesson, không tính lại khi có version mới |

## TBD — không tự giả định
- Quyền riêng tư của leaderboard (tên hiển thị, ai xem được).
- Rate limiting and operational account recovery are outside F01.
- ImageKit private-file/signed-URL behavior for protected audio must be verified
  from current official documentation before F03/F04/F05 and practice expose audio delivery (D28, D32).
