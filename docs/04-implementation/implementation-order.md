# Thứ tự triển khai gợi ý
| Phase | Feature | Hoàn tất khi |
|---|---|---|
| F00 | Khảo sát repository/baseline | Kiến trúc và lệnh chạy được xác minh |
| F01 | Auth/account | Auth và roles theo chính sách hiện tại |
| F02A | Media storage foundation | Local/test adapter, ImageKit adapter, validation and backend-only configuration are verified; no public upload API |
| F02 | Content unit/lesson/vocabulary/exercises | Content Manager tạo và xuất bản nội dung |
| F03 | Placement | Đề cố định 23 câu, result đúng, không progress/XP |
| F04 | Lesson flow | Review bắt buộc, gate >=80%, tuần tự |
| F05A | Mock tests (full + mini) | Soạn đề, làm bài, chấm, điểm ước tính, lịch sử |
| F05B | Practice | Luyện nhớ từ (F05B-1) và luyện nghe chép theo chủ đề/cấp độ (F05B-2 đến F05B-4) theo D84 |
| F05C | Listening course | Giáo trình nghe A1 → C1 theo D100, D141: soạn, học 5 bước, kiểm tra lên cấp, placement nghe, sổ lỗi |
| F06 | Progress | Reading/Listening theo policy đã chốt |
| F07 | XP/leaderboard | Mock best score, không XP trùng |
| F08 | Client integration/e2e | Luồng đầu cuối đạt acceptance |
| F09 | Hồ sơ cá nhân | Tên hiển thị, avatar, đổi mật khẩu; bảng xếp hạng hiện tên + avatar thay email (D113) |
| F10 | Unit review | Bài review 19 câu Reading khép unit (10 Part 5, 3 đoạn Part 6), đậu 80% mới mở unit kế (D121, D129) |
| F11 | Teacher và ngân hàng đề Speaking/Writing | Vai trò Teacher; giáo viên soạn đề theo CEFR, gửi duyệt; Content Manager duyệt, trả lại, gỡ (D170) |
| F12 | Speaking đọc to | Ghi âm, nộp qua outbox → speech-service (Whisper) → điểm 0–10 và trạng thái từng từ; thông báo chấm xong tạm ở progress-service (D171, D175, D177); nút tạo audio mẫu bằng giọng máy |
| F13 | Key Gemini và Writing | Học viên lưu key Gemini; worker Gemini (`apps/writing-service`) chấm Writing theo rubric, bài mẫu, ý chính (D172, D175, D178) |
| F14 | Speaking nói mở | Whisper chuyển chữ + Gemini chấm, Fluency/Pronunciation từ Whisper (D171, D172, D179) |
| F15 | Giáo viên chấm | 3 lượt/tuần (giữ chỗ khi gửi), hàng chờ chung, khóa 2 giờ, trả lượt sau 48 giờ, ghi lại mỗi lần chấm (D173, D180) |
| F16 | Hồ sơ năng lực CEFR và đánh giá AI | Hồ sơ bốn kỹ năng (D174, D181); script đánh giá trên Speechocean762 và ELLIPSE; kiểm thử tải và chịu lỗi luồng chấm |

## Đối chiếu ID và file prompt

ID trong bảng trên và trong feature-status.md là chuẩn. Tên file prompt lệch số
từ F05 trở đi; chưa đổi tên file:

| ID chuẩn | File prompt hiện có |
|---|---|
| F05 Practice/mock | `prompts/F05-tests.md` |
| F06 Progress + F07 XP/leaderboard | `prompts/F06-progress-xp.md` (gộp hai feature) |
| F08 Client integration/e2e | `prompts/F07-integration.md` |
| F01B Admin account management | Không có file prompt riêng |
| F09 Hồ sơ cá nhân | Không có file prompt riêng (D113). Phát audio không phải feature riêng: thuộc F03 placement, F04 lesson test và F05 mock test (D28) |

Đối chiếu dependency thật trước khi đổi thứ tự. Nếu TBD chặn feature, dừng và hỏi; không tự chọn nghiệp vụ.


Client foundation F02B có thể triển khai sau F00, độc lập với content backend; tích hợp feature pages sau khi API contracts tương ứng sẵn sàng.
