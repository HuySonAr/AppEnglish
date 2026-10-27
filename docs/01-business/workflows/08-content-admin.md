# Workflow: quản lý nội dung và hệ thống

## Giáo viên soạn, Content Manager duyệt (D190, D191)
- Giáo viên soạn mọi nội dung: tạo và đặt tên unit, lesson, mock test, bài nghe; soạn từ vựng, bài tập, lesson test, Unit review, placement, mock test, bài nghe; tải media, Pronounce, Transcribe, Auto-time; khôi phục version cũ thành bản nháp. Mọi giáo viên sửa được mọi nội dung; mỗi mục chỉ có một bản đang soạn, ghi người sửa cuối. Đề Speaking/Writing vẫn theo luồng riêng (chỉ người soạn sửa, D170).
- Bản đang soạn: `DRAFT` → giáo viên bấm "Submit for review" (`PENDING_REVIEW`, hệ thống kiểm cùng điều kiện như xuất bản trước đây) → Content Manager "Approve" (xuất bản thành version mới) hoặc "Return" kèm góp ý bắt buộc (`RETURNED`). Đang chờ duyệt thì không sửa; giáo viên "Withdraw" để sửa tiếp. Bản bị trả lại hiện góp ý; sửa là về `DRAFT`. Bản đang xuất bản vẫn dùng cho tới khi bản mới được duyệt; mọi sửa đổi, kể cả lỗi chính tả, đều qua duyệt.
- Content Manager: hàng chờ duyệt (đang chờ, bị trả lại, nháp) gồm mọi loại nội dung; trang chỉ đọc của bản chờ duyệt có phần khác biệt so với bản đang xuất bản. Content Manager sắp thứ tự unit/lesson, bật/tắt xuất bản unit, gỡ xuất bản, xoá mục đã xuất bản, xoá version cũ, dọn media mồ côi; không soạn hay sửa nội dung.
- Xoá: giáo viên xoá được mục chưa từng xuất bản; mục đã từng xuất bản chỉ Content Manager xoá (vẫn kiểm tra đã có học viên dùng chưa).
- Danh mục chủ đề nghe (Admin, Content Manager) và loại đề (Admin) giữ nguyên quyền.

## Nội dung (trước D191 do Content Manager soạn)
Tạo/sửa unit, thứ tự lesson, vocabulary, fill-in exercise, review exercise, lesson test, placement và mock/practice questions theo quyền. Kiểm tra nội dung/đáp án/scoring trước khi xuất bản. Giữ version để truy nguyên attempt. Placement cố định không được đổi âm thầm. Mỗi mock test có số câu và thời lượng riêng (D37); mỗi câu hỏi có nhãn kỹ năng và giải thích đáp án (D34).

### Listening course
Đã bỏ theo D190.

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
- Trình soạn mock test: Part 1 và Part 2 có "Paste questions" để dán lời trong bản ghi của từng câu (câu hỏi, lựa chọn, đáp án): thành transcript của câu đó và chọn đáp án đúng, học viên vẫn chỉ thấy chữ cái (D160). Mỗi audio Part 1–4 có nút "Transcribe" cạnh ô Transcript: speech-service viết lời từ audio, kết quả chỉ vào transcript khi người soạn bấm "Use this transcript" (D161). Part 3, Part 4 và Part 5 có "Paste questions" để dán nhiều câu hỏi dạng văn bản, xem trước rồi điền vào bản nháp theo số câu (D73, D74). Part 6 có "Paste passages": dán đoạn văn có chỗ trống đánh số kèm các câu của nó (D75). Part 7 cũng có "Paste passages"; bảng trong passage Part 7 viết bằng `| ô | ô |` và được vẽ thành bảng cho học viên (D76). Trình soạn lesson test và placement có cùng cách dán cho Part 3–7, điền vào các câu cố định của part (D79). Part 1 và Part 2 của lesson/placement dán lời trong bản ghi (câu hỏi, lựa chọn, đáp án): thành transcript của part và chọn đáp án đúng (D81). Content Manager soạn bài luyện nghe ở mục Listening (D85): mỗi bài có chủ đề, cấp độ A1–C2, dạng Part 1–4 của TOEIC, một audio và các câu của transcript với mốc thời gian; Admin và Content Manager thêm, đổi tên chủ đề và chọn dạng bài của chủ đề (TOEIC parts, Songs, chưa có) ở Listening topics; bài Song là lời từng dòng có mốc thời gian, từ trong `[ ]` là chỗ trống (D88). Mốc thời gian có thể lấy từ file .srt, .vtt hoặc .lrc bằng "Import timed file", và "Shift all times" dời cả bài khi file lệch so với bản ghi âm (D89); "Export…" lưu các câu kèm thời gian ra .srt hoặc .lrc, chọn được thư mục và kiểu file trên Edge/Chrome (D90, D91). "Auto-time" tìm thời gian cho lời đã có, "Transcribe" viết lời kèm thời gian từ audio; kết quả chỉ vào bài khi người soạn bấm áp dụng (D97, D98). Tab Vocabulary có "Paste words": mỗi từ một dòng, các cột ngăn bằng `|` (D80).
- Giao diện: giáo viên soạn ở `/teacher/units`, `/teacher/lessons/:id`, `/teacher/placement`, `/teacher/mock-tests`, `/teacher/listening`; Content Manager xem và quản lý ở các trang tương ứng dưới `/content-manager` và duyệt ở `/content-manager/reviews`. Trang soạn lesson (từ vựng, điền từ với đáp án gõ vào từng chỗ trống (D119), lesson test, upload, lưu nháp, xuất bản).

## Gỡ xuất bản và xóa nội dung (D118)

1. Trong editor của lesson, mock test, bài nghe, và trên thẻ unit, menu "⋯" có *Unpublish* và *Delete*.
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
