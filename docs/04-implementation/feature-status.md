# Theo dõi feature
Trạng thái: PENDING → IN_PROGRESS → REVIEW → DONE. DONE chỉ khi acceptance đạt và checks phù hợp chạy thành công.

| ID | Feature | Trạng thái | Bằng chứng/ghi chú |
|---|---|---|---|
| F00 | Repository discovery/bootstrap | DONE | Scaffold monorepo, 5 NestJS backend apps, React/Vite client, shared packages, Compose Redis/RabbitMQ, PostgreSQL creation script và health endpoint đã tạo. `pnpm install`, build/lint/test thành công; Compose không có PostgreSQL; gateway health smoke test thành công. Database existence chưa xác nhận do CLI yêu cầu local password, nhưng PostgreSQL native đã sẵn sàng. |
| F01 | Auth/account | REVIEW | Account persistence, password verification, approved roles, gateway routes, client auth form, error handling and tests are implemented. Not DONE: session/JWT/cookie/refresh/TTL and protected HTTP authorization policy remain TBD, so the authenticated request lifecycle cannot be completed without a product decision. |
| F02A | Media storage foundation | DONE | Content-service media abstraction, local ignored filesystem adapter, mocked ImageKit SDK adapter, MP3/image validation, backend-only env configuration and documentation implemented. No media model or upload endpoint added. Targeted tests and workspace checks pass. |
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
| 2026-10-08 | F00 | AGENTS.md; README.md; root manifests; apps/*; packages/*; docker-compose.yml; scripts/postgres/*; docs/02-architecture/*; docs/05-operations/development.md | `pnpm install`, `pnpm build`, `pnpm lint`, `pnpm test` PASS; `docker compose config` PASS; Redis/RabbitMQ healthy; `GET /health` PASS; `pg_isready` PASS. |
| 2026-10-08 | F01 | auth-service account/auth modules and tests; gateway auth proxy; web auth feature; auth-service spec; auth workflow; API/data/database docs | Auth unit tests 4/4 PASS; auth/gateway/client builds PASS; Nest route bootstrap PASS; invalid payload HTTP check PASS; no migration or broker restart run. |
| 2026-10-08 | F02A | content-service media adapters/tests; env and gitignore; content-service spec; storage/architecture/implementation docs | `pnpm install`, content-service media tests 4/4 PASS, content-service check PASS; no ImageKit upload, migration, public route, or auth change. |
