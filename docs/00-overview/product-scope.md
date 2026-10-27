# Phạm vi sản phẩm

AppEnglish hỗ trợ học viên học và luyện TOEIC đủ 4 kỹ năng (D190): Reading/Listening qua unit, lesson, bài luyện và mock test; bài thi thật theo đúng quy chuẩn ETS; luyện Speaking và Writing theo đề cấp CEFR có chấm tự động và giáo viên chấm (D169); xem kết quả, tiến độ, hồ sơ năng lực CEFR và bảng xếp hạng XP.

## Actors
- Student: placement, lesson, practice/mock, xem tiến độ và XP.
- Content Manager: duyệt, xuất bản, trả lại và gỡ xuất bản mọi nội dung do giáo viên gửi; không soạn nội dung (D190).
- Teacher: soạn mọi nội dung (unit, lesson, từ vựng, bài tập, lesson test, placement, bài nghe, mock test, đề luyện Reading, đề Speaking/Writing) rồi gửi duyệt; chấm bài học viên gửi qua hàng chờ chung (D170, D173, D190). Không có lớp học.
- Admin: quản lý tài khoản, vai trò và cấu hình chung.

## Nội dung
- Không có khóa học.
- Dự kiến khoảng 50 lesson, được nhóm vào unit.
- Mỗi unit có một hoặc nhiều lesson, số lượng không cố định (D55).
- Mỗi lesson gồm học từ vựng (có phiên âm, phát âm Anh-Anh/Anh-Mỹ, loại từ, ví dụ kèm bản dịch), bài điền từ vào một đoạn văn và bài test cuối 7 part, 23 câu (Part 1–4 Listening, Part 5–7 Reading).
- Hoàn thành hết phần bắt buộc và đạt ít nhất 80% test cuối mới mở lesson kế tiếp.
- Bắt đầu lesson mới phải làm bài ôn từ vựng lesson trước.

## Test, tiến độ, XP
- Placement dùng đề cố định 23 câu cho mọi học viên; chỉ lưu/hiển thị kết quả.
- Placement không cấp CEFR, không vào tiến độ và không cộng XP; kết quả quyết định unit bắt đầu (dưới 60% unit 1, từ 60% unit 2, từ 80% unit 3; Admin cấu hình được). Làm trước lesson 1, được bỏ qua, chỉ làm một lần.
- Điểm lần làm đầu tiên của lesson test dùng để xếp hạng học viên trong chính lesson đó, tách khỏi XP.
- Mock test và lesson test xáo ngẫu nhiên thứ tự lựa chọn A/B/C/D mỗi lần làm.
- Tiến độ gồm mức hoàn thành lesson và mức thành thạo Reading/Listening, tính từ điểm cao nhất của lesson test và mock test; không tính placement và practice.
- Practice gồm Word memory, Listening, Speaking và Writing; không có luyện Reading riêng, học viên luyện Reading bằng mock test hoặc mini test Part 5–7 (D84, D194).
- Chỉ mock test cộng XP; lesson, placement, practice thường không cộng.

## Speaking, Writing, giáo viên, CEFR (D169–D174)
- Ngân hàng đề Speaking (đọc to, nói mở) và Writing, mỗi đề có cấp CEFR A1–C2, do giáo viên soạn và Content Manager duyệt; nghiệp vụ trong `docs/01-business/workflows/09-speaking-writing.md`.
- Chấm tự động: đọc to bằng Whisper (miễn phí); nói mở và Writing bằng Gemini dùng API key riêng của học viên. Không có key AI chung do hệ thống trả tiền.
- Giáo viên chấm: 3 lượt mỗi tuần cho mỗi học viên, chung Speaking và Writing.
- Hồ sơ năng lực CEFR cho bốn kỹ năng (quy đổi từ điểm TOEIC ước tính và điểm Speaking/Writing); placement, mục tiêu, kế hoạch và dự báo vẫn theo TOEIC.

## Ngoài phạm vi
Lớp học, mã lớp, assignment, buổi học trực tiếp, tính lương giáo viên (để sau), placement CEFR, ôn từ vựng lặp lại ngắt quãng (SM-2), XP lesson/ôn tập. Streak có theo D154: chuỗi ngày học, chỉ học viên tự xem, không gắn XP hay bảng xếp hạng.
