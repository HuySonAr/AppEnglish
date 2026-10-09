# Theo dõi feature
Trạng thái: PENDING → IN_PROGRESS → REVIEW → DONE. DONE chỉ khi acceptance đạt và checks phù hợp chạy thành công.

| ID | Feature | Trạng thái | Bằng chứng/ghi chú |
|---|---|---|---|
| F00 | Repository discovery/bootstrap | DONE | Scaffold monorepo, 5 NestJS backend apps, React/Vite client, shared packages, Compose Redis/RabbitMQ, PostgreSQL creation script và health endpoint đã tạo. `pnpm install`, build/lint/test thành công; Compose không có PostgreSQL; gateway health smoke test thành công. Database existence chưa xác nhận do CLI yêu cầu local password, nhưng PostgreSQL native đã sẵn sàng. |
| F01 | Auth/account | REVIEW | Account persistence, scrypt credentials, email OTP verification/resend, forgot/reset OTP, JWT/rotating refresh cookies, me/logout, append-only migrations, gateway relay and React auth flow implemented. PostgreSQL migration and readiness passed locally; SMTP delivery and full end-to-end smoke checks remain pending local SMTP configuration. Web client auth routing, session context, role guards and role dashboards are now separated into dedicated routes/layouts/pages. |
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
| 2026-10-09 | F01 | JWT access + rotating hashed refresh sessions, OTP verification/resend, forgot/reset password, shared auth contracts, gateway relay/readiness, React auth flow, env and docs | Auth unit tests 6/6 PASS; workspace test/lint/build PASS; PostgreSQL migration and gateway readiness PASS; registration smoke correctly returned SMTP configuration failure; SMTP/e2e smoke remains pending local SMTP configuration. |
| 2026-10-09 | F01 | Web client route tree, cookie session context, public/protected/role guards, dedicated auth pages, canonical role layouts, shared response mapping and local toast notifications | Web client tests, lint and build PASS; no real email flow claimed. |
| 2026-10-09 | F01 | Fix OTP-verify/login flow: web client unwraps the auth envelope via `features/auth/flow/auth-flow.js` (no more success+error toasts or 403 Access-denied after login); verify-email rejects DISABLED/SUSPENDED; resend-verification never creates a session | Auth service tests 11/11 PASS; web client tests 12/12 PASS; `pnpm build`, `pnpm lint`, `pnpm test` PASS. SMTP/DB end-to-end not re-run (mock repository + mocked email service only). |
| 2026-10-09 | F01 | Unverified-account flow: register resumes pending emails (ADDITIONAL + VERIFY_EMAIL, no duplicate/password change/auto OTP), ACTIVE emails get AUTH_EMAIL_ALREADY_REGISTERED with login/reset guidance in UI; login guides 403 VERIFY_EMAIL to /verify-email with route-state email; controller stops double-wrapping service envelopes and login now emits Set-Cookie (was stripped by zod parse); verify-email returns LOGIN guidance for ACTIVE emails; OTP usedAt checked explicitly | Auth service tests 23/23 PASS (incl. new controller envelope/cookie tests); web client tests 16/16 PASS; `pnpm build`, `pnpm lint`, `pnpm test` PASS. SMTP/DB end-to-end not re-run (mock repository + mocked email service only). |
