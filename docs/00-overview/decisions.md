# Quyết định nghiệp vụ và mục chưa chốt

## Đã chốt
| ID | Quyết định |
|---|---|
| D01 | Chỉ triển khai Reading và Listening |
| D02 | Không có giáo viên, Speaking/Writing, lớp học hoặc assignment |
| D03 | Không có khóa học; khoảng 50 lesson, nhóm theo unit |
| D04 | Unit có ít nhất 5 lesson, không cố định số lesson |
| D05 | Placement là đề cố định 23 câu, dùng chung |
| D06 | Placement chỉ lưu/hiển thị; không CEFR, progress hoặc XP |
| D07 | Lesson gồm từ vựng, bài điền từ và test cuối |
| D08 | Hoàn thành các phần bắt buộc và đạt >=80% mới mở lesson kế |
| D09 | Sang lesson mới phải ôn từ vựng lesson trước |
| D10 | Chỉ mock test cộng XP |
| D11 | XP một đề = best score / max score x 100, tối đa 100 mỗi đề |
| D12 | Làm lại mock chỉ tính thành tích cao nhất, không cộng trùng |
| D13 | Progress tách Reading/Listening, loại placement |
| D14 | Không XP hoặc streak từ lesson, từ vựng, ôn tập |
| D15 | F00 bootstrap 2026-10-08: tạo monorepo/apps/packages scaffold theo stack đã chốt; chỉ health/runtime boundaries, không triển khai nghiệp vụ hoặc domain contracts |
| D16 | F01 public registration tạo STUDENT và credential verification dùng scrypt; chưa phát hành session/JWT/cookie/refresh token cho đến khi chính sách auth được chốt |

## TBD — không tự giả định
- Công thức tổng hợp progress và loại test được tính vào progress.
- Lesson 1 có yêu cầu hoàn thành placement trước hay không.
- Số câu, thời lượng, scoring conversion cho từng mock test.
- Retake lesson test dùng câu hỏi cũ hay chọn câu ngẫu nhiên.
- Làm tròn XP, hòa hạng và chu kỳ leaderboard.
- Quy tắc versioning khi đề đã xuất bản được sửa.
- Quy trình OTP/OAuth, session/token: đối chiếu auth hiện tại.
