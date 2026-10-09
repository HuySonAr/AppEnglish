# Workflow: tài khoản và xác thực
1. Người dùng đăng ký hoặc đăng nhập.
2. Auth kiểm tra thông tin theo chính sách hiện có.
3. Hệ thống tạo account chờ xác minh, gửi OTP và chỉ tạo phiên sau xác minh.
4. Hệ thống phân quyền Student, Content Manager, Admin.
5. Người dùng nhận lỗi rõ ràng khi dữ liệu sai, xác thực thất bại, tài khoản bị khóa hoặc phiên hết hạn.

Không tự giả định OTP/OAuth, cookie/token, TTL hoặc reset password. Kiểm tra code và quyết định auth hiện có trước.

## F01 đã triển khai

- `POST /auth/register` qua API Gateway tạo tài khoản Student trong `app_identity`.
- `POST /auth/login` qua API Gateway xác minh email/password và tạo phiên.
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
