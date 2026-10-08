# System overview

## Target shape
AppEnglish là monorepo pnpm/Turborepo v1 gồm React + Vite web client, shared packages và sáu NestJS services. Public client đi qua BFF/API Gateway; synchronous internal communication dùng gRPC; asynchronous messaging dùng RabbitMQ; Redis hỗ trợ cache/ephemeral workflows; PostgreSQL database-per-service theo database-allocation.md. Local development dùng PostgreSQL native Windows; Docker Compose chỉ chạy Redis và RabbitMQ.

## Cần xác minh trong feature work
- Proto files, service clients, RabbitMQ exchanges/queues và event conventions.
- Domain DB entities/migrations của từng service; mapping scaffold nằm trong database-allocation.md.
- Redis purpose beyond the bootstrap connection settings.

Mỗi kết luận cần có đường dẫn bằng chứng và nhãn VERIFIED/INFERRED/TBD. Không giả định browser gọi gRPC trực tiếp.

## F00 baseline

**VERIFIED (2026-10-08):** repository có sáu app (`api-gateway`,
`auth-service`, `content-service`, `learning-service`, `progress-service`,
`web-client`), hai shared packages, Compose, manifests, health endpoint và
PostgreSQL database creation script.

**INFERRED:** sáu app và database mapping là bootstrap boundaries; domain contracts
và business behavior vẫn chờ F01–F08.

**TBD:** public gateway route inventory, RPC/event/queue names, Redis policies and
domain migrations. F00 intentionally does not implement these.
