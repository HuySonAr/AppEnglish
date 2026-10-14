# Workflow: practice và mock test
## Practice
Chưa triển khai (F05B). Theo D65, practice gồm hai loại, Student chọn một: luyện từ vựng (20 câu ngẫu nhiên từ các lesson đã hoàn thành; chưa đủ 20 từ thì chưa mở) và luyện nghe (phần nghe lấy ngẫu nhiên từ lesson đã hoàn thành). Không có practice Reading. Practice không XP, không xếp hạng, không vào progress và làm lại không giới hạn.

## Mock test (F05A, D63, D64)
Content Manager tạo đề (tên, Level 1–3, số phút), soạn 7 part và xuất bản. Chuẩn TOEIC là 200 câu trong 120 phút (Part 1: 6, Part 2: 25, Part 3: 39, Part 4: 30, Part 5: 30, Part 6: 16, Part 7: 54); đề xuất bản được khi mỗi part có ít nhất 1 câu; số câu chuẩn của mỗi part là giới hạn trên, và mỗi hội thoại Part 3 hay bài nói Part 4 có tối đa 3 câu (D72). Trình soạn đánh số câu theo vị trí của đề đủ 200 câu (hội thoại 1 là câu 32–34, hội thoại 2 là 35–37…). Audio (D66): Part 1 và 2 mỗi câu một audio; Part 3 mỗi hội thoại một audio với các câu của nó (thường 3 câu, đủ đề là 13 audio); Part 4 mỗi bài nói một audio với các câu của nó (thường 3 câu, đủ đề là 10 audio); mỗi audio có transcript. Graphic (D71): hội thoại 11–13 của Part 3 và bài nói 9–10 của Part 4 mỗi set có đúng một câu "Look at the graphic" kèm hình, thường là câu giữa của set (ví dụ câu 66 trong set 65–67); các set khác không có graphic. Part 6 và 7 gồm nhiều đoạn văn, mỗi đoạn có các câu hỏi riêng.

Student xem danh sách đề cùng mức được gợi ý (không khóa đề nào), rồi chọn một trong hai cách làm:

- **Full test:** một đồng hồ cho cả bài do server giữ, đi lại tự do giữa các part, tự lưu câu trả lời, hết giờ tự nộp. Chấm số câu đúng, breakdown Listening/Reading và điểm ước tính theo thang 990 (ghi rõ là ước tính). Làm lại không giới hạn; chỉ lượt đầu tiên của mỗi đề được tính XP.
- **Mini test:** một part của đề đó, không giới hạn thời gian, làm lại không giới hạn, không XP, không vào progress. Chấm số câu đúng và tỉ lệ, không quy đổi sang thang 990.

Cả hai xáo lựa chọn Part 3–7 mỗi lượt (D31, D48), cho xem lại đáp án, giải thích và transcript của mọi lượt, và có đánh giá tiến triển giữa các lượt (riêng cho full test và cho từng part của mini test). Trên web, lịch sử full test nằm ngay trên trang của đề; lịch sử mini test của mỗi part có màn hình riêng (`/student/mock-tests/:id/mini/:partKey`), nộp mini test xong thì mở màn hình đó ở đúng lượt vừa làm (D77). Nút "Exit" cho rời bài không nộp: "Discard and leave" xóa lượt đang làm (không vào lịch sử); mini test có thêm "Leave and continue later" để giữ lượt và làm tiếp sau (D82).

Phần Listening có phát audio (D28). Best score và XP gắn với đề, không gắn với version (D40); XP và bảng xếp hạng XP thuộc F07, mức thành thạo Reading/Listening thuộc F06.

Mức gợi ý: theo điểm ước tính của lượt full gần nhất (dưới 450: Level 1, dưới 700: Level 2, còn lại Level 3); chưa làm mock thì theo unit bắt đầu từ placement.
