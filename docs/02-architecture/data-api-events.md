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
| User/Auth | auth-service | app_identity (PostgreSQL) | TBD | TBD | `apps/auth-service/src/database/database.config.js` |
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

**VERIFIED:** auth-service owns account data in `app_identity`; the gateway exposes
`POST /auth/register` and `POST /auth/login`. The web client calls only the gateway.
The auth-service migration and Zod contracts are under
`apps/auth-service/src/database/migrations/` and `apps/auth-service/src/auth/`.

**TBD:** no token/session transport contract is defined. Do not add a protected
HTTP route or claim role enforcement at the request boundary until the session/JWT
and cookie/refresh policy is decided.

## F02A media storage

Media bytes are owned by `content-service` through its `MediaStorage` provider;
they are not stored in PostgreSQL in F02A. The local adapter writes to an
ignored filesystem directory for development/tests. The ImageKit adapter calls
ImageKit server-side with `IMAGEKIT_PRIVATE_KEY`; no `VITE_*` variable or
browser upload flow is allowed. F02A exposes no public upload endpoint and
defines no RabbitMQ event. F02/F09 must define authorization and persistence
before adding an API contract.
