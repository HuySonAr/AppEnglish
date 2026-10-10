# Thứ tự triển khai gợi ý
| Phase | Feature | Hoàn tất khi |
|---|---|---|
| F00 | Khảo sát repository/baseline | Kiến trúc và lệnh chạy được xác minh |
| F01 | Auth/account | Auth và roles theo chính sách hiện tại |
| F02A | Media storage foundation | Local/test adapter, ImageKit adapter, validation and backend-only configuration are verified; no public upload API |
| F02 | Content unit/lesson/vocabulary/exercises | Content Manager tạo và xuất bản nội dung |
| F03 | Placement | Đề cố định 23 câu, result đúng, không progress/XP |
| F04 | Lesson flow | Review bắt buộc, gate >=80%, tuần tự |
| F05 | Practice/mock | Attempts, scoring, history |
| F06 | Progress | Reading/Listening theo policy đã chốt |
| F07 | XP/leaderboard | Mock best score, không XP trùng |
| F08 | Client integration/e2e | Luồng đầu cuối đạt acceptance |

## Đối chiếu ID và file prompt

ID trong bảng trên và trong feature-status.md là chuẩn. Tên file prompt lệch số
từ F05 trở đi; chưa đổi tên file:

| ID chuẩn | File prompt hiện có |
|---|---|
| F05 Practice/mock | `prompts/F05-tests.md` |
| F06 Progress + F07 XP/leaderboard | `prompts/F06-progress-xp.md` (gộp hai feature) |
| F08 Client integration/e2e | `prompts/F07-integration.md` |
| F01B Admin account management | Không có file prompt riêng |
| F09 | Không tồn tại. Phát audio thuộc F03 placement, F04 lesson test và F05 mock test (D28) |

Đối chiếu dependency thật trước khi đổi thứ tự. Nếu TBD chặn feature, dừng và hỏi; không tự chọn nghiệp vụ.


Client foundation F02B có thể triển khai sau F00, độc lập với content backend; tích hợp feature pages sau khi API contracts tương ứng sẵn sàng.
