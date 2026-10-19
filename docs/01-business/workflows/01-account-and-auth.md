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

## F09 Hồ sơ cá nhân (D113)

1. Người dùng (mọi vai trò) mở menu tài khoản ở thanh trên và chọn "Your profile"
   (`/student/profile`, `/content-manager/profile`, `/admin/profile`).
2. Trang hiện ảnh đại diện (hoặc chữ cái đầu khi chưa có ảnh), tên hiển thị,
   thông tin tài khoản chỉ đọc (email, vai trò, ngày tạo) và mục đổi mật khẩu.
   Học viên thấy thêm thẻ thành tích (lesson đã xong, Listening, Reading, XP)
   lấy từ `/progress` và `/progress/xp`.
3. Tên hiển thị tự do, tùy chọn, cho trùng, tối đa 50 ký tự; để trống thì hệ
   thống dùng phần email trước dấu @. `PATCH /auth/profile` `{ displayName }`.
4. Ảnh đại diện: chọn JPEG/PNG/WebP; trình duyệt cắt vuông và thu về 256px rồi
   gửi `POST /auth/profile/avatar` (multipart `file`, tối đa 2 MB); ảnh mới thay
   ảnh cũ. `DELETE /auth/profile/avatar` quay về chữ cái đầu. Backend lưu lên
   ImageKit (D68) khi `AVATAR_STORAGE_ADAPTER=imagekit`, còn local thì
   `storage/avatars` do auth-service phục vụ tại `/avatars/:name`.
5. Đổi mật khẩu đi hai bước trong hộp thoại: bước 1 nhập mật khẩu hiện tại,
   `POST /auth/profile/password/verify` kiểm tra ngay (sai thì báo tại chỗ, mã 27,
   không đổi gì); bước 2 nhập mật khẩu mới hai lần rồi
   `POST /auth/profile/password` `{ currentPassword, newPassword }`. Ô mật khẩu có
   nút con mắt hiện/ẩn (dùng chung cho đăng nhập, đăng ký, đặt lại mật khẩu).
   Sai mật khẩu hiện tại trả `AUTH_CURRENT_PASSWORD_INVALID` (27). Thành công
   thì mọi thiết bị khác bị đăng xuất (session version + thu hồi refresh),
   thiết bị đang dùng nhận cookie mới và vẫn đăng nhập.
6. Email không đổi được. Không có tùy chọn ẩn khỏi bảng xếp hạng.
7. Bảng xếp hạng lesson và bảng XP hiện tên hiển thị và avatar thay email:
   gateway ghép từ RPC nội bộ `GetProfiles` của auth-service (xem workflow 07).

## F01B mở rộng: quản lý tài khoản của Admin (D114)

1. `/admin/accounts` mở với bảng thống kê: tổng tài khoản (theo vai trò), số Active,
   số đăng nhập trong 7 ngày, số đăng ký chờ xác minh quá 7 ngày; biểu đồ đăng ký
   mới theo ngày (30 ngày) và phân bố theo trạng thái.
2. Danh sách tìm theo email hoặc tên hiển thị, lọc vai trò và trạng thái, công tắc
   "chỉ đăng ký cũ chưa xác minh", sắp xếp (mới nhất, cũ nhất, đăng nhập cuối,
   email), phân trang server. Mỗi hàng hiện avatar, tên, email, vai trò, trạng
   thái, lần đăng nhập cuối và mở trang chi tiết.
3. `/admin/accounts/:id` hiện hồ sơ và các mốc (đăng ký, xác minh, đăng nhập
   cuối), vai trò, trạng thái và lý do khóa, số thiết bị đang đăng nhập, với học
   viên thêm tóm tắt học tập chỉ đọc (lesson xong, XP và hạng, Listening,
   Reading), và lịch sử audit kèm người thực hiện.
4. Đổi vai trò/trạng thái trong hộp thoại. Chuyển sang DISABLED hoặc SUSPENDED
   bắt buộc nhập lý do; lý do được lưu, ghi audit và hiện cho người dùng khi họ
   đăng nhập thất bại ("Reason: …"). Mở lại ACTIVE xóa lý do. Mọi thay đổi vẫn
   đăng xuất tài khoản khỏi mọi thiết bị như F01B.
5. Hành động một lần, mỗi hành động có ghi chú tùy chọn vào audit: đăng xuất mọi
   thiết bị; gửi email đặt lại mật khẩu (tài khoản ACTIVE, admin không biết mật
   khẩu); xóa ảnh đại diện; đặt lại tên hiển thị.
6. Không có: đăng nhập thay học viên, xóa cứng tài khoản, khóa hàng loạt, đổi
   email, đặt mật khẩu thay người dùng.
