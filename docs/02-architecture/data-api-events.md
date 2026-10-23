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
gateway exposes the seventeen `/auth/*` HTTP routes (twelve from F01/F01B, five profile routes from F09) listed in
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

## F09 profile contract

**VERIFIED (2026-10-19, D113):** auth-service owns the profile columns on
`accounts` (`displayName`, `avatarUrl`, `avatarStorage`, `avatarStorageId`,
migration `1710000004000`). The gateway exposes `PATCH /auth/profile`,
`POST /auth/profile/password/verify`, `POST /auth/profile/password`,
`POST /auth/profile/avatar` (multipart) and `DELETE /auth/profile/avatar`,
relayed to the `UpdateProfile`, `VerifyPassword`, `ChangePassword`,
`UploadAvatar` and `RemoveAvatar` RPCs. Rankings keep their data in
learning-service and progress-service by `accountId`; the gateway calls the
internal `GetProfiles` RPC and attaches `displayName` and `avatarUrl` to the
rows of `/learning/lessons/:id/ranking` and `/progress/leaderboard`, removing
`email` (`attachProfiles` in `apps/api-gateway/src/auth/auth-gateway.controller.js`).
Avatar files live on ImageKit (D68) or under `storage/avatars` locally; no
service reads another service's database and no RabbitMQ event is added.

## Invitations, activation and placement reset (D131)

**VERIFIED (2026-10-21, tests and live route checks):** auth-service RPCs
`AdminInviteAccount` (`POST /auth/admin/accounts`) and `AcceptInvite`
(`POST /auth/accept-invite`), OTP purpose `INVITE` (72 hours), column
`accounts.invitedAt` (migration `1710000006000`), new `AdminAccountAction`
values and audit actions. learning-service RPC `AdminResetPlacement`
(`POST /placement/admin/learners/:id/reset`) deletes the learner's own
`placement_attempts` row; the gateway then asks auth-service to write the audit
row. No service reads another service's database. Env `WEB_APP_URL` gives the
link in the invitation email.

## F01B admin management contract (D114)

**VERIFIED (2026-10-19):** the gateway adds `GET /auth/admin/accounts/stats` and
`POST /auth/admin/accounts/:id/actions` (auth-service `AdminAccountStats`,
`AdminAccountAction`) and `GET /progress/admin/learners/:id` (progress-service
`GetLearnerSummary`, ADMIN only). Locking an account needs a `reason`
(`PATCH /auth/admin/accounts/:id`), kept on `accounts.statusReason` and in
`account_audits.reason`, and returned as `data.reason` of the 403 sign-in
error. `accounts.lastLoginAt` is written by auth-service on sign-in. No service
reads another service's database; the learner summary is served by
progress-service from its own tables.

## Unit review contract (D121)

**VERIFIED (2026-10-20):** content-service owns `unit_review_versions` and
`units.reviewVersionId` (migration `1720000011000`); the gateway exposes
`GET /content/units/:id/review`, `PUT /content/units/:id/review/draft`,
`POST /content/units/:id/review/publish` and `.../unpublish` (RPCs
`GetUnitReview`, `SaveUnitReviewDraft`, `PublishUnitReview`,
`UnpublishUnitReview`). learning-service owns `unit_review_attempts`
(migration `1730000010000`) and reads the published review through the
internal `GetUnitReviewPaper` RPC; the gateway exposes
`GET /learning/units/:id/review` and `POST /learning/units/:id/review/submit`
(`GetUnitReview`, `SubmitUnitReview`). `GetCurriculum` carries
`reviewVersionId` per unit so learning-service knows which units close with a
review. No RabbitMQ event: a review earns no XP. `GetContentUsage` gains kind
`unit` for the delete rule of D118.

## Version history contract (D122)

**VERIFIED (2026-10-20):** the gateway exposes `GET /content/versions/:kind/:id`,
`GET /content/versions/:kind/:id/:versionId` and
`POST /content/versions/:kind/:id/:versionId/restore`, relayed to
content-service `ListContentVersions`, `GetContentVersion` and
`RestoreContentVersion` (`VersionGrpcController`), and since D127
`DELETE /content/versions/:kind/:id/draft` (`DiscardContentDraft`), which
removes the draft row and the media files only it used, and
`DELETE /content/versions/:kind/:id/:versionId` (`DeleteContentVersion`, D128),
which the gateway allows only after learning-service `GetContentUsage` (kinds
`lessonVersion`, `mockVersion`, `unitReviewVersion`, `courseVersion`) reports no
attempt on that version. No new table: the
existing version tables are read; restoring writes the draft through the usual
save-draft path. No event.

## Content removal contract (D118)

**VERIFIED (2026-10-19):** the gateway orchestrates deletes: it asks
learning-service `GetContentUsage` for the ids involved and only then calls the
content-service `Delete*` RPC; with results it answers 409 `CONTENT_IN_USE`
(48, `data.reason HAS_RESULTS`). `Unpublish*` RPCs need no check. The content
gateway controller therefore holds the learning gRPC client as well. Orphan
media are listed and deleted through `ListOrphanMedia`/`DeleteOrphanMedia`.
No service reads another service's database.

## Gateway rate limits (D117)

**VERIFIED (2026-10-19):** a global guard in api-gateway
(`src/rate-limit/`) counts requests per fixed window in Redis (`REDIS_URL`) or
memory and answers 429 `{ code: 33, msg: 'fail', data: { scope, limit,
retryAfterSeconds } }` with `Retry-After`. Health routes are exempt; a failing
store lets requests through. Redis is used for nothing else yet.

## Admin dashboard health probe (D115)

**VERIFIED (2026-10-19):** the gateway exposes `GET /health/services`
(`apps/api-gateway/src/health/health.service.js`, `probeServices`): auth-service
through gRPC `Ready` (with its database state), content-, learning- and
progress-service through their HTTP `/health` on `*_SERVICE_PORT`, 2 s timeout
each. It always answers 200 with `{ status: ok|degraded, checkedAt, services[] }`;
a service that does not answer is listed as `down` with `detail` timeout or
unreachable. It is public like `/health/ready` and adds no business data.

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

## Reliable messaging and observability (D168)

**Correlation id.** The gateway reads `x-request-id` from the request (letters, digits, `.`, `_`, `-`, at most 64) or makes a UUID, returns it in the response header and sends it to every service in gRPC metadata. Each gRPC handler runs inside that id (`withGrpcContext`, `@appenglish/backend-common`), and every log line is one JSON object `{ time, level, service, context, requestId, message }` (`JsonLogger`). Outbox rows keep the id (`learning_events.requestId`, `content_events.requestId`), the envelope carries `requestId`, consumers run in it, and speech-service echoes it in its answers.

**Outbox in content-service.** A speech job and its request are written in one transaction (`listening_timing_jobs` + `content_events`); `ContentEvents` relays unsent rows to `speech.autotime.requests` on a confirm channel every 5 s and when the broker connects, with `messageId` = the event id. A job is accepted while RabbitMQ is away and sent when it is back; `SPEECH_UNAVAILABLE` is no longer returned for Auto-time and Transcribe.

**Idempotent consumers.** progress-service (`learning.results`) and content-service (`speech.autotime.results`) keep `processed_messages (messageId, queue, processedAt)` in their own database: a message whose id is already there is acked and skipped (`duplicate`). speech-service gives every answer a fresh `message_id`.

**Retry and dead letters.** For `learning.results` and `speech.autotime.results`, a message that fails is republished to `<queue>.retry.1|2|3` (TTL 10 s, 1 min, 5 min, dead-lettering back to the queue) with header `x-attempt`; after the third retry it goes to `<queue>.dead`. A message that cannot be read (not JSON, wrong shape) goes to the dead queue at once. The main queues keep their arguments, so no queue has to be recreated. speech-service acks a request only after answering; a request redelivered after the worker stopped is retried once, then moved to `speech.autotime.requests.dead` and the job is answered FAILED.

**Gateway sessions.** The gateway checks the access token itself (HS256 with `AUTH_JWT_SECRET`, type `access`, not expired) and caches the account `{ id, role, email }` from auth-service `Me` in Redis (`session:<sha256(token)>`, 30 s, never longer than the token). A token it cannot check, or a cache miss, goes to auth-service as before. A locked account, a password change or "log out everywhere" takes effect within 30 s. Without Redis the cache is in memory.

**Metrics.** Every Node service serves `GET /metrics` (Prometheus text) on its HTTP port: process CPU, memory, uptime; gRPC calls and time; HTTP requests and time (gateway); outbox sent and waiting; messages handled by outcome (applied, duplicate, retry, dead); speech jobs finished, waiting and working time; sessions by source (cache, auth, refused). The gateway's `/metrics` answers only from localhost. `GET /health/system` (Admin) gathers them with the RabbitMQ management API (queues, ready, in progress, consumers).

## Speaking read aloud (F12, D177)

- HTTP: `/learning/speaking/prompts`, `/learning/speaking/prompts/:id`, `POST /learning/speaking/prompts/:id/submissions` (multipart `audio`), `/learning/speaking/submissions/:id`; `POST /content/practice-prompts/machine-audio`.
- gRPC internal (learning → content): `ListPublishedPracticePrompts`, `GetPracticePaper`, `StoreLearnerRecording`, `DeleteLearnerRecordings`.
- RabbitMQ: `speech.speaking.requests` (learning outbox → speech-service), `speech.speaking.results` (speech-service → learning, retry `.retry.1|2|3` and `.dead`), `learning.results` event types `speaking.scored` and `activity.recorded` with activity `speaking`.
- progress-service: `speaking.scored` → notification `SPEAKING_RESULT` (key `speaking:<submissionId>`).

## Gemini key and Writing (F13, D178)

- HTTP: `/learning/ai-key` (GET, PUT, DELETE), `/learning/writing/prompts`, `/learning/writing/prompts/:id`, `POST /learning/writing/prompts/:id/submissions`, `/learning/writing/submissions/:id`.
- RabbitMQ: `writing.grading.requests` (learning outbox → writing-service, retry `.retry.1|2|3`, `.dead`), `writing.grading.results` (writing-service → learning, retry and `.dead`), `writing.key-checks` (request/reply); `learning.results` event `writing.scored` and activity `writing`.
- progress-service: `writing.scored` → notification `WRITING_RESULT` (key `writing:<submissionId>`).
- External: Gemini REST `generativelanguage.googleapis.com/v1beta` from writing-service only, with each learner's key.

## Speaking open answers (F14, D179)

- RabbitMQ: `speech.speaking.requests` with `kind: open_speaking` and empty `text`; `writing.grading.requests` also carries `speaking.grading.requested` jobs; `writing.open-speaking.results` (writing-service → learning-service, retry and `.dead`).
- `speaking.scored` may have `total: null` (open answer without a key); progress-service shows "Your speaking answer is ready".
