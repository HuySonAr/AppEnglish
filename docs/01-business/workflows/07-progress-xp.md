# Workflow: progress, XP, leaderboard
## Progress
- Mức hoàn thành: số lesson đã hoàn thành / tổng số lesson.
- Mức thành thạo, riêng cho Reading và Listening: trung bình điểm cao nhất của các lesson test và mock test đã làm, tính trên các câu hỏi thuộc kỹ năng đó (D33). Làm lại không bao giờ làm giảm tiến độ.
- Loại placement và practice.
- Lưu raw attempt và breakdown theo kỹ năng; câu hỏi mang nhãn kỹ năng (D34).
- Lưu giá trị chính xác, hiển thị phần trăm nguyên. Kỹ năng chưa có bài test nào hiển thị "Chưa có dữ liệu", không hiển thị 0% (D39).
- Mức thành thạo tính như sau: với mỗi bài test đã làm (một lesson test hoặc một đề mock làm full), lấy tỉ lệ đúng cao nhất trên các câu của kỹ năng đó qua các lần làm; mức thành thạo = trung bình các tỉ lệ đó. Mức hoàn thành chỉ đếm lesson còn đang xuất bản. Kết quả đi từ learning-service sang progress-service bằng sự kiện RabbitMQ (D110); trang "Progress" của học viên (`/student/progress`) hiện mức hoàn thành theo unit và hai kỹ năng.

## XP
Chỉ lượt full đầu tiên của mỗi đề mock được tính XP (D63, D112): XP = số câu đúng / tổng số câu × 100, làm tròn thành số nguyên, tối đa 100 XP trên đề; làm lại đề không đổi XP. Không XP cho mini test, placement, lesson test, practice thường hoặc hoạt động học (D10, D14). XP được ghi khi progress-service nhận sự kiện `mock.submitted` của lượt đầu; học viên xem XP và các đề đã cộng ở trang Progress.

## Streak (D154)
- Streak là số ngày học liên tiếp. Một ngày học là ngày học viên làm xong ít nhất một việc: một bước lesson (vocabulary, word quiz, fill-in đạt), nộp lesson test hoặc unit review, bấm "Check my answers" một bài luyện nghe, làm xong một lượt Word memory, nộp một mock test (full hoặc mini), trả lời một câu khi ôn câu sai mock test (D167). Chỉ mở app không tính.
- Ngày tính theo giờ Việt Nam, cắt lúc 0 giờ.
- Mỗi tuần (thứ 2 đến chủ nhật) được nghỉ một ngày mà chuỗi không đứt; nghỉ ngày thứ hai trong tuần thì chuỗi về 0. Hôm nay chưa học không làm đứt chuỗi. Lưu chuỗi dài nhất.
- Không XP, không phần thưởng, không phạt, không bảng xếp hạng. Chỉ học viên tự xem: dashboard (số ngày, 7 chấm của tuần, nhắc nhẹ khi hôm nay chưa học), Profile (chuỗi hiện tại, dài nhất, lịch 8 tuần).
- Chỉ đếm từ ngày triển khai (2026-10-22); không tính ngược dữ liệu cũ.

## Thông báo (D163)
- Chuông thông báo trên thanh trên cùng của web, chỉ trong app (chưa có email hay push). Số chưa đọc trên chuông, "Mark all as read", bấm một thông báo là đánh dấu đã đọc và mở đúng trang. Giữ 30 ngày, hiện 30 thông báo mới nhất.
- Học viên:
  - Kết quả full mock test: điểm TOEIC ước tính và mức tăng/giảm so với lượt trước của cùng đề (mini test không báo). Mở lịch sử đúng lượt đó.
  - Qua unit review lần đầu: unit kế tiếp đã mở. Mở trang Lessons.
  - Nhắc streak: từ 18 giờ (giờ Việt Nam), khi chuỗi đang có và hôm nay chưa học; tối đa 1 lần mỗi ngày; học xong trong ngày thì nhắc tự thành đã đọc. Tạo khi học viên mở app, không có job chạy nền.
- Content Manager: Transcribe hoặc Auto-time của chính mình xong hoặc lỗi (bài nghe, mock test) trong 7 ngày gần nhất. Mở trình soạn của nội dung đó.
- Luồng duyệt nội dung (D192): Content Manager nhận "Waiting for review" cho mỗi bài đang chờ duyệt (mọi loại nội dung và đề Speaking/Writing), kèm người gửi; giáo viên nhận "Approved" hoặc "Returned" (kèm góp ý) cho bài mình gửi, và thông báo Transcribe/Auto-time của mình. Bấm mở đúng trang.
- Admin (D164), mỗi Admin có trạng thái đã đọc riêng:
  - Số học viên mới của tuần trước (thứ 2 đến chủ nhật, giờ Việt Nam) và chênh lệch so với tuần trước nữa. Mở trang Accounts.
  - Content Manager gỡ xuất bản một unit, unit review, lesson, mock test hay bài nghe.
  - Speech job lỗi trong ngày (gồm job quá hạn và lỗi gửi RabbitMQ): số job lỗi và lỗi gần nhất, mỗi ngày một thông báo; có lỗi mới thì thành chưa đọc lại.
  - Đăng nhập sai nhiều lần chưa báo: giới hạn đăng nhập (D117) đếm ở gateway bằng Redis với email đã băm và không lưu lại.
- Chưa có tùy chọn tắt từng loại.

## Leaderboard
Có hai loại bảng: bảng XP chung (tổng XP mock) và bảng riêng của từng lesson dùng điểm lần làm đầu tiên của lesson test (D30). Bảng theo lesson không cộng XP và không gộp thành bảng chung.

Bảng XP chỉ có bảng tổng, không có bảng theo tuần/tháng; hòa điểm thì ai đạt mức XP đó sớm hơn xếp trên (D39). Bảng theo lesson xếp theo điểm lần đầu, rồi thời gian làm bài ngắn hơn, rồi nộp sớm hơn (D36). Bảng XP và bảng theo lesson hiện tên hiển thị và ảnh đại diện của học viên (D113; chưa đặt tên thì phần email trước @; không còn hiện email đầy đủ như D60/D112 cũ). Gateway ghép tên/ảnh từ auth-service (`GetProfiles`) theo `accountId`; learning/progress-service không lưu tên. Bảng XP top 50, có tìm theo tên và phân trang; học viên luôn thấy hạng của mình (`/student/leaderboard`). Không có tùy chọn ẩn khỏi bảng.
