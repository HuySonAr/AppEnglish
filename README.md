# AppEnglish — blueprint nghiệp vụ, kiến trúc và AI

Bộ tài liệu này hướng dẫn AI hiểu nghiệp vụ, kiến trúc công nghệ, triển khai từng feature và cập nhật trạng thái. Phạm vi sản phẩm hiện tại chỉ gồm Reading và Listening.

## Trạng thái repository

**F00 — baseline khảo sát (2026-10-08):** repository hiện là **docs-only**. Cây
repository chỉ có `AGENTS.md`, `README.md` và các tài liệu dưới `docs/`; chưa có
source code, workspace pnpm/Turborepo, app/service, package manifest, lockfile,
Docker Compose, env template, proto, migration hoặc test để xác minh kiến trúc
runtime.

Các bảng và quyết định mang nhãn “mục tiêu”, “cần xác minh” hoặc `TBD` không được
coi là bằng chứng repository đã triển khai. Xem
[feature-status](docs/04-implementation/feature-status.md) và
[service-boundaries](docs/02-architecture/service-boundaries.md) để biết chi tiết.

## Đọc theo thứ tự
1. AGENTS.md
2. docs/00-overview/product-scope.md và decisions.md
3. docs/02-architecture/technology-stack.md, backend-module-pattern.md, frontend-architecture.md và database-allocation.md
4. Workflow phù hợp trong docs/01-business/workflows/
5. Kiến trúc và service spec đã xác minh từ code/config
6. Prompt feature tương ứng trong docs/04-implementation/prompts/

## Cấu trúc
- 00-overview: mục tiêu, quyết định, thuật ngữ.
- 01-business: nghiệp vụ chuẩn và luồng.
- 02-architecture: stack, phân lớp, frontend và database mapping theo service.
- 03-service-specs: mẫu mô tả service thực tế.
- 04-implementation: thứ tự, tiến độ và prompt.
- 05-operations: lệnh chạy dự án sau khi xác minh.

AI không được thay stack hoặc tạo service mới theo ý mình. Khi chi tiết phiên bản, database, ORM, service name hoặc script chưa rõ, phải đọc repository và ghi bằng chứng.
