# Workflow: quản lý nội dung và hệ thống
## Content Manager
Tạo/sửa unit, thứ tự lesson, vocabulary, fill-in exercise, review exercise, lesson test, placement và mock/practice questions theo quyền. Kiểm tra nội dung/đáp án/scoring trước khi xuất bản. Giữ version để truy nguyên attempt. Placement cố định không được đổi âm thầm. Mỗi mock test có số câu và thời lượng riêng (D37); mỗi câu hỏi có nhãn kỹ năng và giải thích đáp án (D34).

### Listening course (D143–D147)
- Content Manager tạo chủ đề cho từng cấp A1–C2 (mỗi chủ đề một bài nghe, đổi thứ tự trong cấp) và bài test cho các cấp A1–C1 (bài test của một cấp mở cấp sau).
- Bản ghi (D147): Content Manager tải audio giọng người thật ngay trong trang soạn chủ đề, không lấy từ Listening library. Dán transcript (hoặc Transcribe), Auto-time gắn thời gian từng câu, nghe thử và chỉnh Start/End từng câu.
- Trang soạn chủ đề: bản ghi và các câu (dưới mỗi câu: chỗ trống viết bằng [ngoặc vuông], bản dịch tiếng Việt); 4–6 từ vựng (nút "Pronounce" tạo IPA và audio bằng giọng máy); câu trắc nghiệm; sắp xếp ý (bật/tắt, 3–8 ý theo thứ tự nghe). Xuất bản bị chặn kèm danh sách lý do khi thiếu (audio, thời gian hoặc bản dịch của câu, chưa có chỗ trống nào…).
- Bài test của cấp: mỗi bản ghi tải lên tại chỗ, kèm transcript (mỗi dòng một câu) và các câu trắc nghiệm.

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
- Giao diện Content Manager: `/content-manager/units` (unit, lesson, thứ tự, xuất bản) và trang soạn lesson (từ vựng, điền từ với đáp án gõ vào từng chỗ trống (D119), lesson test, upload, lưu nháp, xuất bản).

## Gỡ xuất bản và xóa nội dung (D118)

1. Trong editor của lesson, mock test, bài nghe, unit/level test/placement của
   Listening course, và trên thẻ unit, menu "⋯" có *Unpublish* và *Delete*.
2. *Unpublish*: học viên không thấy nội dung nữa ngay lập tức; kết quả đã có
   giữ nguyên; các version vẫn lưu; xuất bản lại tạo version mới. Lesson bị gỡ
   không chặn chuỗi mở khóa: học viên đi tiếp sang lesson kế.
3. *Delete*: chỉ khi chưa học viên nào có kết quả (gateway hỏi learning-service).
   Có kết quả thì báo "Learners already have results… unpublish it instead".
   Xóa unit kéo theo mọi lesson; bài nghe còn được course dùng thì không xóa được.
   File media chỉ nội dung đó dùng bị xóa khỏi kho.
4. Dashboard Content Manager có bảng "Storage clean-up": liệt kê file không
   version nào dùng (tải lên quá 1 giờ), chọn và xóa sau khi xác nhận.
- Lịch sử version (D122): mỗi trình soạn liệt kê mọi version của nội dung (nháp, đang xuất bản, đã gỡ), cho xem tóm tắt chỉ đọc và "Restore as draft" để chép version cũ thành bản nháp rồi xuất bản thành version kế. Unpublish khi chưa có bản nháp thì version vừa gỡ thành bản nháp.
- Import/Export JSON (D124): trình soạn lesson và Unit review nhập một file JSON theo định dạng soạn của `content-samples/600-words` (xem trước, báo lỗi, giữ audio và phiên âm đã có) và xuất bản đang soạn ra file cùng định dạng.
- Discard draft (D127): gỡ bản nháp của lesson, mock test, bài nghe, item course hoặc Unit review; file audio/ảnh chỉ bản nháp dùng bị xóa khỏi kho media, file của version khác giữ nguyên.
- Xóa version cũ (D128): trong Version history, version đã bị thay hoặc đã gỡ xóa được cùng file chỉ nó dùng, trừ khi còn lượt làm bài của học viên gắn với version đó (giữ để xem lại đáp án) hoặc là version đang dùng.
