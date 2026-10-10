# Workflow: quản lý nội dung và hệ thống
## Content Manager
Tạo/sửa unit, thứ tự lesson, vocabulary, fill-in exercise, review exercise, lesson test, placement và mock/practice questions theo quyền. Kiểm tra nội dung/đáp án/scoring trước khi xuất bản. Giữ version để truy nguyên attempt. Placement cố định không được đổi âm thầm. Mỗi mock test có số câu và thời lượng riêng (D37); mỗi câu hỏi có nhãn kỹ năng và giải thích đáp án (D34).

### Version (D40)
- Đề đã xuất bản là bất biến; mọi chỉnh sửa, kể cả sửa lỗi chính tả, tạo version mới.
- Lượt làm dở hoàn thành trên version nó bắt đầu; kết quả cũ giữ nguyên.
- XP và điểm cao nhất gắn với đề, không gắn với version, và so sánh theo tỉ lệ phần trăm.

## Admin
Quản lý tài khoản, vai trò, trạng thái và cấu hình chung, gồm các ngưỡng placement xác định unit bắt đầu (D35). Không thay vai trò biên tập nội dung của Content Manager.

## F02 đã triển khai
- Chỉ Content Manager quản lý unit, lesson, nội dung lesson và upload audio/hình; Admin không có quyền biên tập (D42).
- Lesson test soạn theo 7 part cố định, 23 câu; số câu và số lựa chọn mỗi part do hệ thống quy định, Content Manager chỉ điền nội dung, đáp án đúng, giải thích, audio và transcript (D45).
- Xuất bản bị chặn kèm danh sách lý do khi nội dung chưa đủ.
- Placement và mock/practice chưa có trong F02; thuộc F03 và F05.
- Giao diện Content Manager: `/content-manager/units` (unit, lesson, thứ tự, xuất bản) và trang soạn lesson (từ vựng, điền từ, lesson test, upload, lưu nháp, xuất bản).
