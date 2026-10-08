# Workflow: tài khoản và xác thực
1. Người dùng đăng ký hoặc đăng nhập.
2. Auth kiểm tra thông tin theo chính sách hiện có.
3. Hệ thống tạo/kiểm tra tài khoản và phiên.
4. Hệ thống phân quyền Student, Content Manager, Admin.
5. Người dùng nhận lỗi rõ ràng khi dữ liệu sai, xác thực thất bại, tài khoản bị khóa hoặc phiên hết hạn.

Không tự giả định OTP/OAuth, cookie/token, TTL hoặc reset password. Kiểm tra code và quyết định auth hiện có trước.

## F01 đã triển khai

- `POST /auth/register` qua API Gateway tạo tài khoản Student trong `app_identity`.
- `POST /auth/login` qua API Gateway xác minh email/password và từ chối credential
  sai hoặc account bị `DISABLED`.
- Role vocabulary được giới hạn ở `STUDENT`, `CONTENT_MANAGER`, `ADMIN`.
- Password dùng scrypt-derived hash; không lưu plaintext.
- Backend có `AuthorizationService.assertRole()` để dùng cho protected handlers.

## F01 còn chặn

Đăng nhập hiện chỉ trả principal đã xác minh, chưa tạo session/JWT/cookie/refresh
token. Vì các policy này chưa được chốt, chưa thể gắn principal vào request và
enforce role trên public protected routes. Không được coi việc ẩn/hiện UI là
authorization.
