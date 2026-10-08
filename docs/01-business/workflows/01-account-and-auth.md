# Workflow: tài khoản và xác thực
1. Người dùng đăng ký hoặc đăng nhập.
2. Auth kiểm tra thông tin theo chính sách hiện có.
3. Hệ thống tạo/kiểm tra tài khoản và phiên.
4. Hệ thống phân quyền Student, Content Manager, Admin.
5. Người dùng nhận lỗi rõ ràng khi dữ liệu sai, xác thực thất bại, tài khoản bị khóa hoặc phiên hết hạn.

Không tự giả định OTP/OAuth, cookie/token, TTL hoặc reset password. Kiểm tra code và quyết định auth hiện có trước.
