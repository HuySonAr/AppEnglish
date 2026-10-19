# Workflow: quản lý nội dung và hệ thống
## Content Manager
Tạo/sửa unit, thứ tự lesson, vocabulary, fill-in exercise, review exercise, lesson test, placement và mock/practice questions theo quyền. Kiểm tra nội dung/đáp án/scoring trước khi xuất bản. Giữ version để truy nguyên attempt. Placement cố định không được đổi âm thầm. Mỗi mock test có số câu và thời lượng riêng (D37); mỗi câu hỏi có nhãn kỹ năng và giải thích đáp án (D34).

### Listening course (D106)
- Nội dung của Listening course soạn từ bộ sách Cambridge English Skills *Real Listening & Speaking* (Level 1–4): mỗi bài học lấy một bài nghe của sách (bản ghi đưa vào Listening library, lời có mốc thời gian), từ khóa, câu ý chính, câu chi tiết và câu chép; Unit check, Level test và placement nghe cũng lấy bản ghi của sách. Chỉ dùng phần Listening của sách.
- Listening placement soạn trên trang riêng "Listening placement" (D108): tạo một lần rồi mở trình soạn; trang Listening course chỉ còn các cấp.
- Soạn bài học theo sách (D109): câu chi tiết chọn dạng "Multiple choice" hoặc "Complete the sentence" (câu có `___`, nhập từ nghe được cho từng chỗ trống, lấy từ bài "Listen again and complete" của sách); mục "4 · Focus on" không bắt buộc: tiêu đề, hội thoại có `___`, danh sách từ cách nhau bằng dấu phẩy, chọn từ đúng cho từng chỗ trống (lấy từ khung Focus on của sách). Câu ý chính, Unit check, Level test và placement chỉ trắc nghiệm.
- Mỗi cấp có hai phần cố định (D107): Social and Travel và Work and Study. Khi thêm unit, Content Manager chọn phần; trang tổng quan liệt kê unit theo phần, nút lên/xuống đổi thứ tự trong phần; trang soạn unit đổi được phần (unit về cuối phần mới). Level test và placement không thuộc phần nào.
- Ánh xạ Level 1–4 của sách sang A1–C1 và điều kiện bản quyền chưa chốt (TBD). Bộ demo giọng máy (D105) chỉ để chạy thử.

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
- Trình soạn mock test: Part 3, Part 4 và Part 5 có "Paste questions" để dán nhiều câu hỏi dạng văn bản, xem trước rồi điền vào bản nháp theo số câu (D73, D74). Part 6 có "Paste passages": dán đoạn văn có chỗ trống đánh số kèm các câu của nó (D75). Part 7 cũng có "Paste passages"; bảng trong passage Part 7 viết bằng `| ô | ô |` và được vẽ thành bảng cho học viên (D76). Trình soạn lesson test và placement có cùng cách dán cho Part 3–7, điền vào các câu cố định của part (D79). Part 1 và Part 2 của lesson/placement dán lời trong bản ghi (câu hỏi, lựa chọn, đáp án): thành transcript của part và chọn đáp án đúng (D81). Content Manager soạn bài luyện nghe ở mục Listening (D85): mỗi bài có chủ đề, cấp độ A1–C2, dạng Part 1–4 của TOEIC, một audio và các câu của transcript với mốc thời gian; Admin và Content Manager thêm, đổi tên chủ đề và chọn dạng bài của chủ đề (TOEIC parts, Songs, chưa có) ở Listening topics; bài Song là lời từng dòng có mốc thời gian, từ trong `[ ]` là chỗ trống (D88). Mốc thời gian có thể lấy từ file .srt, .vtt hoặc .lrc bằng "Import timed file", và "Shift all times" dời cả bài khi file lệch so với bản ghi âm (D89); "Export…" lưu các câu kèm thời gian ra .srt hoặc .lrc, chọn được thư mục và kiểu file trên Edge/Chrome (D90, D91). "Auto-time" tìm thời gian cho lời đã có, "Transcribe" viết lời kèm thời gian từ audio; kết quả chỉ vào bài khi người soạn bấm áp dụng (D97, D98). Mục Listening course (D100): mỗi cấp A1–C1 có các Unit theo thứ tự và một Level test; trong Unit, mỗi bài học chọn một bài nghe đã xuất bản của thư viện, tick các câu học viên phải chép, thêm từ khóa, 1 câu hỏi ý chính và 2–5 câu chi tiết; Unit check và Level test gồm các bài nghe kèm câu hỏi trắc nghiệm; soạn nháp rồi xuất bản theo version. Listening placement (D103): một bài duy nhất, mỗi bản ghi chọn cấp nó kiểm tra (A1–C1), mỗi cấp ít nhất 2 câu. Tab Vocabulary có "Paste words": mỗi từ một dòng, các cột ngăn bằng `|` (D80).
- Giao diện Content Manager: `/content-manager/units` (unit, lesson, thứ tự, xuất bản) và trang soạn lesson (từ vựng, điền từ, lesson test, upload, lưu nháp, xuất bản).
