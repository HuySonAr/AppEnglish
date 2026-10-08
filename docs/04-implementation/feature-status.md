# Theo dõi feature
Trạng thái: PENDING → IN_PROGRESS → REVIEW → DONE. DONE chỉ khi acceptance đạt và checks phù hợp chạy thành công.

| ID | Feature | Trạng thái | Bằng chứng/ghi chú |
|---|---|---|---|
| F00 | Repository discovery | REVIEW | Đã khảo sát 2026-10-08. Baseline là docs-only; kiến trúc mục tiêu và local runtime đã đối chiếu nhưng service/version/script/DB/Compose chưa thể xác minh vì repository thiếu source/config. Chưa DONE vì acceptance yêu cầu kiến trúc và lệnh chạy được xác minh. Xem README.md và các tài liệu F00 trong docs/02-architecture. |
| F01 | Auth/account | PENDING | |
| F02 | Content | PENDING | |
| F03 | Placement | PENDING | |
| F04 | Lesson flow | PENDING | |
| F05 | Practice/mock | PENDING | |
| F06 | Progress | PENDING | |
| F07 | XP/leaderboard | PENDING | |
| F08 | UI integration/e2e | PENDING | |

## Nhật ký
| Ngày | Feature | Tài liệu/code cập nhật | Checks |
|---|---|---|---|
| 2026-10-08 | F00 | README.md; docs/00-overview/decisions.md; docs/02-architecture/{technology-stack,system-overview,service-boundaries,data-api-events,database-allocation}.md; docs/05-operations/development.md | Khảo sát cây repository bằng PowerShell; xác nhận chỉ có Markdown, không có runtime/config. Không có test/build command để chạy. |
