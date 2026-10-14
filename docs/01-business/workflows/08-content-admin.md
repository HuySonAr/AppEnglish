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
- Trình soạn mock test: Part 3, Part 4 và Part 5 có "Paste questions" để dán nhiều câu hỏi dạng văn bản, xem trước rồi điền vào bản nháp theo số câu (D73, D74). Part 6 có "Paste passages": dán đoạn văn có chỗ trống đánh số kèm các câu của nó (D75). Part 7 cũng có "Paste passages"; bảng trong passage Part 7 viết bằng `| ô | ô |` và được vẽ thành bảng cho học viên (D76). Trình soạn lesson test và placement có cùng cách dán cho Part 3–7, điền vào các câu cố định của part (D79). Part 1 và Part 2 của lesson/placement dán lời trong bản ghi (câu hỏi, lựa chọn, đáp án): thành transcript của part và chọn đáp án đúng (D81). Content Manager soạn bài luyện nghe ở mục Listening (D85): mỗi bài có chủ đề, cấp độ A1–C2, dạng Part 1–4 của TOEIC, một audio và các câu của transcript với mốc thời gian; Admin và Content Manager thêm, đổi tên chủ đề và chọn dạng bài của chủ đề (TOEIC parts, Songs, chưa có) ở Listening topics; bài Song là lời từng dòng có mốc thời gian, từ trong `[ ]` là chỗ trống (D88). Mốc thời gian có thể lấy từ file .srt, .vtt hoặc .lrc bằng "Import timed file", và "Shift all times" dời cả bài khi file lệch so với bản ghi âm (D89); "Export…" lưu các câu kèm thời gian ra .srt hoặc .lrc, chọn được thư mục và kiểu file trên Edge/Chrome (D90, D91). Tab Vocabulary có "Paste words": mỗi từ một dòng, các cột ngăn bằng `|` (D80).
- Giao diện Content Manager: `/content-manager/units` (unit, lesson, thứ tự, xuất bản) và trang soạn lesson (từ vựng, điền từ, lesson test, upload, lưu nháp, xuất bản).
