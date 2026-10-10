# Workflow: tài khoản và xác thực
1. Người dùng đăng ký hoặc đăng nhập.
2. Auth kiểm tra thông tin theo chính sách hiện có.
3. Hệ thống tạo account chờ xác minh, gửi OTP và chỉ tạo phiên sau xác minh.
4. Hệ thống phân quyền Student, Content Manager, Admin.
5. Người dùng nhận lỗi rõ ràng khi dữ liệu sai, xác thực thất bại, tài khoản bị khóa hoặc phiên hết hạn.

Không tự giả định OTP/OAuth, cookie/token, TTL hoặc reset password. Kiểm tra code và quyết định auth hiện có trước.

## F01 đã triển khai

- `POST /auth/register` qua API Gateway tạo tài khoản Student trong `app_identity`.
  Email PENDING_VERIFICATION đăng ký lại trả `ADDITIONAL` + `nextAction: VERIFY_EMAIL`
  (không tạo account trùng, không đổi password, không gửi lại OTP tự động);
  email ACTIVE trả `AUTH_EMAIL_ALREADY_REGISTERED` và UI hướng dẫn đăng nhập
  hoặc quên mật khẩu.
- `POST /auth/login` qua API Gateway xác minh email/password và tạo phiên.
  Chỉ sau khi email+password khớp, tài khoản PENDING_VERIFICATION trả 403
  `AUTH_EMAIL_NOT_VERIFIED` + `nextAction: VERIFY_EMAIL`; UI chuyển sang
  `/verify-email` với email trong route state. Sai password luôn trả
  `AUTH_INVALID_CREDENTIALS` (không lộ trạng thái xác minh).
- `POST /auth/verify-email` qua API Gateway tạo phiên cookie sau khi xác minh
  OTP; DISABLED/SUSPENDED bị từ chối 403 và không được kích hoạt lại; email đã
  ACTIVE trả `nextAction: LOGIN` (không verify lại, không tạo session thứ hai).
  OTP là một lần dùng: challenge có `usedAt` bị từ chối tường minh.
- `POST /auth/resend-verification` chỉ cấp lại OTP; tài khoản ACTIVE nhận
  `nextAction: LOGIN` và không nhận session (không cấp cookie chỉ theo email).
- `POST /auth/refresh` xoay refresh token; token cũ bị dùng lại sẽ thu hồi family.
- `GET /auth/me` xác minh chữ ký, hạn JWT, account status và trả principal.
- `POST /auth/logout` thu hồi family và xóa cookie.
- `POST /auth/forgot-password` và `/auth/reset-password` dùng OTP; reset tăng
  session version và thu hồi mọi refresh session.
- Role vocabulary được giới hạn ở `STUDENT`, `CONTENT_MANAGER`, `ADMIN`.
- Password dùng scrypt-derived hash; không lưu plaintext.
- Backend có `AuthorizationService.assertRole()` để dùng cho protected handlers.

Access token mặc định 15 phút và refresh token mặc định 7 ngày, đều cấu hình qua
env. Public registration luôn tạo `STUDENT`; UI không thay thế authorization
backend.

## Bổ sung 2026-10-10

- `verify-email` và `reset-password` trả `AUTH_OTP_INVALID` cho email không tồn
  tại (giống OTP sai), không tiết lộ email nào đã đăng ký.
- Khi access cookie hết hạn giữa phiên, web client tự gọi `/auth/refresh` một lần
  rồi gửi lại request; refresh thất bại thì request trả 401 như cũ.
- Thiếu quyền trả 403 với mã số `AUTH_FORBIDDEN_ROLE` (26).

## F01B Admin account list

- The Admin Accounts UI represents an unselected filter as an empty string.
  `listAdminAccounts()` omits empty email/role/status filters from the HTTP query;
  selecting a role/status sends its existing enum value, clearing it omits it again.
- `GET /auth/admin/accounts` still validates with `adminAccountQuerySchema`.
  Explicit `role=`/`status=` and unknown enum values are invalid and return HTTP
  400 with the existing validation envelope, rather than an unhandled 500.
- Empty filters do not change an account's status. Account status must pass
  `accountResponseSchema` before a successful list response is returned.
