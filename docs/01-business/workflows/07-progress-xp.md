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

## Leaderboard
Có hai loại bảng: bảng XP chung (tổng XP mock) và bảng riêng của từng lesson dùng điểm lần làm đầu tiên của lesson test (D30). Bảng theo lesson không cộng XP và không gộp thành bảng chung.

Bảng XP chỉ có bảng tổng, không có bảng theo tuần/tháng; hòa điểm thì ai đạt mức XP đó sớm hơn xếp trên (D39). Bảng theo lesson xếp theo điểm lần đầu, rồi thời gian làm bài ngắn hơn, rồi nộp sớm hơn (D36). Bảng XP hiện email học viên như bảng theo lesson (D60, D112), top 50, có tìm theo email và phân trang; học viên luôn thấy hạng của mình (`/student/leaderboard`).
