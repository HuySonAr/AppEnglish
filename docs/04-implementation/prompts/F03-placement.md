# Prompt F03 — Placement
~~~text
Đọc workflow placement và D05/D06/D29. Đọc thêm D35: placement quyết định unit bắt đầu (mặc định <60% unit 1, >=60% unit 2, >=80% unit 3, Admin cấu hình được); làm trước lesson 1, được bỏ qua, chỉ một lần; lesson mở sẵn không tính hoàn thành. Triển khai một đề placement cố định 23 câu dùng chung theo cấu trúc 7 part của lesson test (D45, D46; dùng lại `LESSON_TEST_PARTS` trong content-contracts); tạo attempt, nhận bài, chấm, lưu và hiển thị result. Placement không CEFR, không progress, không XP. Giữ version đề. Thời gian 25 phút do server giữ, kết quả chỉ hiện điểm và unit bắt đầu, không xáo lựa chọn (D56, D57); kiến trúc theo D58.
Kiểm tra các ngưỡng 59/60 và 79/80, luồng bỏ qua và chặn làm lại. Cập nhật data/API/workflow/status; kiểm tra result và loại trừ progress/XP.
~~~
