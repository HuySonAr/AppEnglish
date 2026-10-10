# Data, API và events

## Quy ước kiến trúc
- Public web traffic qua BFF/API Gateway.
- Internal synchronous communication dùng gRPC/proto.
- Asynchronous domain messages dùng RabbitMQ.
- Mỗi service sở hữu database; không cross-service DB query.
- Redis không thay database nghiệp vụ chính.

## Inventory F00
| Domain | Service owner | Model/schema thật | gRPC proto/API | RabbitMQ event | Bằng chứng |
|---|---|---|---|---|---|
| User/Auth | auth-service | app_identity (PostgreSQL) | `packages/auth-contracts/proto/auth.proto` | TBD | `apps/auth-service/src/database/database.config.js` |
| Content/lesson | content-service | app_content (PostgreSQL) | TBD | TBD | `apps/content-service/src/database/database.config.js` |
| Placement/test attempt | learning-service | app_learning (PostgreSQL) | TBD | TBD | `apps/learning-service/src/database/database.config.js` |
| Progress/XP | progress-service | app_progress (PostgreSQL) | TBD | TBD | `apps/progress-service/src/database/database.config.js` |

Chỉ sửa/định nghĩa contract theo patterns và versions đang có. Không tự giả định tên RPC/event hoặc schema.

## F00 verification

**VERIFIED (2026-10-08):** Compose, package manifests, TypeORM DataSource
factories, gRPC/RabbitMQ/Redis dependencies và HTTP gateway health endpoint đã
được tạo. Chưa có `*.proto`, exchange/queue declaration, domain model hoặc
business API trong F00.

Không coi TBD contracts là implementation contract; feature prompts phải bổ sung
backward-compatible definitions khi nghiệp vụ được triển khai.

## F01 auth contract

**VERIFIED (2026-10-10):** auth-service owns account data in `app_identity`; the
gateway exposes the twelve `/auth/*` HTTP routes listed in
`docs/03-service-specs/auth-service.md` and calls auth-service over gRPC (D27). The web client calls only the
gateway. The auth-service migrations and Zod contracts are under
`apps/auth-service/src/database/migrations/` and `apps/auth-service/src/auth/`;
shared roles, statuses, response codes and next actions are in
`packages/auth-contracts/src/index.js`.

Session transport is decided (D18–D20): HS256 access JWT and rotating refresh
token in HttpOnly cookies. Role enforcement happens in auth-service per request
(`AuthService.requireAdmin`). Every response, including gateway-originated
failures, uses the `{ code, msg, data }` envelope with numeric codes (D26).

The gRPC contract is `appenglish.auth.v1.AuthService` in
`packages/auth-contracts/proto/auth.proto`: typed request messages, one
`AuthReply { http_status, code, msg, data_json, set_cookies }` for every RPC.
`data_json` carries the envelope's `data` object because its shape differs per
call; the admin list query travels as a string map so an omitted filter stays
distinct from an empty one (D25).

**TBD:** no RabbitMQ event exists for auth.

## F02A media storage

Media bytes are owned by `content-service` through its `MediaStorage` provider;
they are not stored in PostgreSQL in F02A. The local adapter writes to an
ignored filesystem directory for development/tests. The ImageKit adapter calls
ImageKit server-side with `IMAGEKIT_PRIVATE_KEY`; no `VITE_*` variable or
browser upload flow is allowed. F02A exposes no public upload endpoint and
defines no RabbitMQ event. F02 and the audio-playing features F03/F04/F05 (D28) must define authorization and persistence
before adding an API contract.
