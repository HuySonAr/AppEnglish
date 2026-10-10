# AppEnglish — blueprint nghiệp vụ, kiến trúc và AI

Bộ tài liệu này hướng dẫn AI hiểu nghiệp vụ, kiến trúc công nghệ, triển khai từng feature và cập nhật trạng thái. Phạm vi sản phẩm hiện tại chỉ gồm Reading và Listening.

## Trạng thái repository

**F00 — bootstrap (2026-10-08):** monorepo scaffold đã được tạo. Repository có
workspace pnpm/Turborepo, năm NestJS apps, một React/Vite client, shared packages,
Docker Compose cho Redis/RabbitMQ và script tạo bốn database PostgreSQL native.
Health endpoint đã được tạo.

**Hiện tại (2026-10-10):** F01 auth/account, F01B admin account management và
F02A media storage foundation DONE. F02 content (backend API, upload media và giao diện Content Manager tại
`/content-manager/units`) ở REVIEW. Placement, lesson flow,
practice/mock, progress và XP chưa triển khai.

Các chi tiết runtime đã tạo có bằng chứng trong `package.json`, `pnpm-lock.yaml`,
`apps/*/package.json`, `docker-compose.yml` và `scripts/postgres/`. Xem
[feature-status](docs/04-implementation/feature-status.md) và
[service-boundaries](docs/02-architecture/service-boundaries.md) để biết chi tiết.

## Quick start

```powershell
pnpm install
Copy-Item .env.example .env
pnpm --filter @appenglish/auth-service migration:run
pnpm --filter @appenglish/content-service migration:run
pnpm --filter @appenglish/learning-service migration:run
docker compose up -d redis rabbitmq
pnpm dev
```

PostgreSQL không chạy trong Compose. Cài/chạy PostgreSQL native trên Windows, sau
đó chạy `psql -h localhost -U postgres -f scripts/postgres/create-databases.sql`
hoặc mở script trong pgAdmin/DBeaver. Script chỉ tạo database còn thiếu, không
drop/reset database hiện có. Xem [development guide](docs/05-operations/development.md).

F01 web auth is available at `http://localhost:5173/login` (`/auth` redirects
there); the gateway API is at
`http://localhost:3000` and readiness is `GET /health/ready`. Fill the local
`POSTGRES_PASSWORD` in `.env`; never commit `.env`.

## Apps

| App | Local port | Database |
|---|---:|---|
| api-gateway | 3000 | none |
| auth-service | 3001 (HTTP health), 50051 (gRPC) | app_identity |
| content-service | 3002 (HTTP health), 50052 (gRPC) | app_content |
| learning-service | 3003 (HTTP health), 50053 (gRPC) | app_learning |
| progress-service | 3004 | app_progress |
| web-client | 5173 | none |

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
