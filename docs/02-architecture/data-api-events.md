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
| Content/lesson | content-service | app_content (PostgreSQL) | `packages/content-contracts/proto/content.proto` | TBD | `apps/content-service/src/database/database.config.js` |
| Placement/test attempt | learning-service | app_learning (PostgreSQL) | `packages/learning-contracts/proto/learning.proto` | Producer of `learning.results` (F06) | `apps/learning-service/src/database/database.config.js`, `src/events/learning-events.js` |
| Progress/XP | progress-service | app_progress (PostgreSQL) | `packages/progress-contracts/proto/progress.proto` | Consumer of `learning.results` (F06 progress, F07 XP) | `apps/progress-service/src/database/database.config.js`, `src/events/results.consumer.js` |

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

## F02 content contract

**VERIFIED (2026-10-10):** the gateway exposes ten `/content/*` HTTP routes
(listed in `docs/03-service-specs/content-service.md`) and calls
`appenglish.content.v1.ContentService` over gRPC. Every request carries the
actor (`id`, `role`) that the gateway obtained from auth-service `Me`;
content-service authorizes it (D42). Requests use `ContentRequest { actor, id,
payload_json }` (or `UploadMediaRequest` with bytes) and replies use the same
shape as `AuthReply`. No RabbitMQ event is defined for content.

## F03 placement contract

**VERIFIED (2026-10-10):** the gateway exposes seven `/placement/*` routes
(listed in `docs/03-service-specs/learning-service.md`) and calls
`appenglish.learning.v1.LearningService` over gRPC with the actor from
auth-service `Me` (D58). learning-service reads the published placement test
from content-service through the service-to-service RPC `GetPlacementPaper` of
`appenglish.content.v1.ContentService`; the gateway does not expose it. The
Content Manager edits the test through three `/content/placement*` routes. No
RabbitMQ event is defined: placement updates neither progress nor XP.

## F04 lesson-flow contract

**VERIFIED (2026-10-11):** the gateway exposes twelve `/learning/*` routes
(listed in `docs/03-service-specs/learning-service.md`) relayed to
`appenglish.learning.v1.LearningService`; the actor now carries the account
email for the lesson ranking (D60). learning-service reads the curriculum and
lesson papers from content-service through `GetCurriculum` and
`GetLessonPaper`. Lesson results reach progress-service over RabbitMQ (see F06
below).

## F05A mock-test contract

**VERIFIED (2026-10-11):** the gateway exposes nine `/mock-tests/*` routes
relayed to `appenglish.learning.v1.LearningService` and six
`/content/mock-tests*` routes for the Content Manager. learning-service reads
published mock tests through `ListPublishedMockTests` and `GetMockPaper`. Full
mock results reach progress-service over RabbitMQ (see F06 below); F07 decides
XP from the same messages (each carries `attemptNumber` and the counts).

## F06 progress contract

**VERIFIED (2026-10-17, XP 2026-10-18):** the gateway exposes `GET /progress`,
`GET /progress/xp` and `GET /progress/leaderboard` relayed to
`appenglish.progress.v1.ProgressService` (`GetProgress`, `GetXp`, `GetLeaderboard`)
(`packages/progress-contracts/proto/progress.proto`; request and reply have
the shape of the learning contract). progress-service reads the published
curriculum from content-service (`GetCurriculum`) for the number of lessons.

## RabbitMQ: learning results (F06, D110)

learning-service publishes every finished lesson-test attempt, every first
pass of a lesson and every finished full mock attempt to the durable queue
`learning.results` through an outbox (`learning_events`); progress-service
consumes the queue, stores the per-skill counts in `app_progress` by attempt
id (so a redelivery counts once) and computes completion and mastery when
asked. Contract: `LearningQueue`/`LearningEventType` in
`@appenglish/learning-contracts` and `docs/03-service-specs/learning-service.md`.
Persistent JSON `{ id, type, occurredAt, payload }` on the default exchange.

## RabbitMQ: Auto-time (D97)

The first asynchronous messages of the system. content-service publishes an
auto-time request for a listening exercise to `speech.autotime.requests`;
speech-service answers on `speech.autotime.results` (RUNNING, then DONE or
FAILED). Both queues are durable, on the default exchange; messages are
persistent JSON. Contract: `SpeechQueue`/`AutoTimeStatus` in
`@appenglish/content-contracts` and `docs/03-service-specs/speech-service.md`.
content-service keeps the job state in `app_content.listening_timing_jobs`;
speech-service has no database.
