# Service boundaries

Kiến trúc hiện có là sáu NestJS services trong apps/*. AI phải đọc workspace và source để liệt kê đủ tên, trách nhiệm, database, gRPC contracts và events. README không đầy đủ không phải bằng chứng rằng service không tồn tại.

| Service thật | Trách nhiệm hiện tại | Nghiệp vụ Reading/Listening liên quan | DB owner | gRPC/API/event | Bằng chứng |
|---|---|---|---|---|---|
| Chưa xác minh | Chưa xác minh | Chưa xác minh | Chưa xác minh | Chưa xác minh | **VERIFIED:** repository chỉ có tài liệu, không có `apps/*` hoặc source/config runtime (F00, 2026-10-08) |

## F00 inventory result

**VERIFIED:** chưa thể liệt kê service thật, kể cả khả năng có `payment-service`,
vì repository không có workspace hoặc thư mục ứng dụng. “Sáu NestJS services” và
mapping trong các tài liệu khác hiện là **INFERRED target**, không phải bằng chứng
triển khai.

Không tự tạo service, gán database, xóa payment-service hoặc suy ra trách nhiệm từ
tên domain khi chưa có code/config để truy dependency.

Không tạo service mới chỉ để khớp domain tài liệu. Không xóa payment-service hoặc service khác nếu chưa truy dependency và có quyết định.
