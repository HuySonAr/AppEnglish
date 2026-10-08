# System overview

## Target shape
AppEnglish là monorepo pnpm/Turborepo v1 gồm React + Vite web client, shared packages và sáu NestJS services. Public client đi qua BFF/API Gateway; synchronous internal communication dùng gRPC; asynchronous messaging dùng RabbitMQ; Redis hỗ trợ cache/ephemeral workflows; PostgreSQL database-per-service theo database-allocation.md. Local development dùng PostgreSQL native Windows; Docker Compose chỉ chạy Redis và RabbitMQ.

## Cần xác minh trong repository
- Tên và vai trò chính xác của từng app/service.
- Public entrypoint và cách React + Vite kết nối đến BFF.
- Proto files, service clients, RabbitMQ exchanges/queues và event conventions.
- DB cụ thể/ORM/migration của từng service; mapping mục tiêu nằm trong database-allocation.md.
- Redis purpose, local Docker Compose, health checks và scripts.
- Payment service có tồn tại trong code dù README có thể chưa liệt kê.

Mỗi kết luận cần có đường dẫn bằng chứng và nhãn VERIFIED/INFERRED/TBD. Không giả định browser gọi gRPC trực tiếp.

## F00 baseline

**VERIFIED (2026-10-08):** repository hiện chỉ chứa tài liệu Markdown; không có
`apps/`, `packages/`, source NestJS/React, proto, Compose, manifest, migration
hoặc test.

**INFERRED:** các thành phần trong “Target shape” là kiến trúc mục tiêu được quyết
định trong tài liệu, không phải inventory runtime hiện có.

**TBD:** public gateway, sáu service thật, RPC/event/queue, Redis usage, database
connection và mọi version/script chỉ được xác minh sau khi source/config được đưa
vào repository. F00 không tạo hoặc xóa các thành phần này.
