# Progress service

## Trạng thái xác minh

VERIFIED 2026-10-17 for progress (F06, D33, D110) and 2026-10-18 for XP and
the leaderboard (F07, D63, D112).

## Trách nhiệm và nghiệp vụ liên quan

`progress-service` owns what a learner's progress is made of (workflow
`docs/01-business/workflows/07-progress-xp.md`, D33):

- **Completion**: lessons completed over the lessons published, overall and
  per unit. A lesson is completed when its lesson test is passed for the first
  time (learning-service decides that). Only lessons still in the published
  curriculum count.
- **Mastery of Listening and of Reading**: for each test the learner took (a
  lesson test, or a full mock test), the best share of right answers on that
  skill's questions over the attempts; mastery is the average of those shares.
  A retake never lowers it. Placement, practice and mini tests never count. A
  skill without a test has no value (`null`), not 0% (D39).

- **XP** (F07, D10, D63, D112): only the first full attempt of a mock test
  earns XP, right answers over questions scaled to 100 and rounded; a retake
  changes nothing; mini tests, placement, lessons and practice earn none.
- **Leaderboard** (D39, D112): one overall board of total XP, ties broken by
  who reached the total first (the time of their last gain); learners are
  shown by display name and avatar, attached by the gateway from auth-service
  (D113; progress-service itself only knows `accountId`/`accountEmail`); the
  top 50, plus the learner's own place.

Exact counts are stored; whole percents are computed when read (D39).

## Data ownership (`app_progress`)

Migration `apps/progress-service/src/database/migrations/1740000000000-create-progress.js`;
entities in `src/database/progress.entities.js`.

| Table | Purpose |
|---|---|
| `skill_results` | One row per finished lesson-test or full mock-test attempt: `id` = the attempt id in learning-service (so a message applied twice is stored once), `accountId`, `source` (`LESSON_TEST`/`MOCK_TEST`), `sourceId` (lesson id or mock test id), `attemptNumber`, `correctCount`, `totalCount`, `listeningCorrect`, `listeningTotal`, `readingCorrect`, `readingTotal`, `submittedAt` |
| `lesson_completions` | One row per learner and completed lesson (unique `accountId`, `lessonId`): `completedAt` |
| `xp_ledger` | One row per learner and mock test (unique `accountId`, `mockTestId`; `id` = the first full attempt's id): `accountEmail` and `mockTestTitle` snapshots, `correctCount`, `totalCount`, `xp` (0–100), `earnedAt`. Migration `1740000001000-create-xp-ledger.js` |

Ids refer to other services' rows without a foreign key. The service never
reads another service's database: the curriculum comes from content-service
over gRPC and the results from learning-service over RabbitMQ.

## API/events

Public HTTP route on the gateway
(`apps/api-gateway/src/progress/progress-gateway.controller.js`); the gateway
calls auth-service `Me` and passes the actor to
`appenglish.progress.v1.ProgressService`
(`packages/progress-contracts/proto/progress.proto`, request and reply shaped
like the learning contract).

| Method | Gateway route | RPC | Who | Purpose |
|---|---|---|---|---|
| GET | `/progress/xp` | `GetXp` | Student | `totalXp`, `rank` (or `null` without XP), `learnerCount`, `entries[]` latest first (`mockTestId`, `mockTestTitle`, `xp`, `correctCount`, `totalCount`, `earnedAt`) |
| GET | `/progress/streak` | `GetStreak` | Student | D154: `{ timeZone, today, current, longest, studiedToday, restPerWeek, week[7], calendar[8][7] }`, each day `{ day, state }` with `state` in `StreakDayState` (`studied`, `rest`, `missed`, `today`, `future`); rules in `src/progress/streak.rules.js` (one day off per Monday–Sunday week, today never breaks the streak) |
| GET | `/progress/admin/learners/:id` | `GetLearnerSummary` | Admin | Read-only (D114): `{ learnerId, progress, xp }` with the same shapes as `GetProgress` and `GetXp` for that learner; `id` must be a UUID |
| GET | `/progress/leaderboard` | `GetLeaderboard` | Student | `entries[]` top 50 (`rank`, `accountId`, `displayName`, `avatarUrl`, `totalXp`, `mockCount`, `reachedAt`, `isYou`; the service's `email` is replaced by the gateway, D113), `learnerCount`, `you` (the learner's own row, or `null`) |
| GET | `/progress` | `GetProgress` | Student | `completion` (`completedLessons`, `totalLessons`, `percent` or `null` with no published lesson, `units[]` with `id`, `title`, `completed`, `total`), `skills.listening` and `skills.reading` (`percent` or `null`, `testCount`, `lessonTests`, `mockTests`: the tests it rests on), `attempts` (`lessonTests`, `mockTests`: finished attempts stored) |

Codes (`packages/progress-contracts/src/index.js`): 0 success, 26 forbidden
role, 30 validation, 32 system; 70–79 are reserved for progress and XP.

**Consumer** of the durable RabbitMQ queue `learning.results`
(`src/events/results.consumer.js`, contract in
`docs/03-service-specs/learning-service.md`): `lesson-test.submitted` and
`mock.submitted` (full tests only) become `skill_results` rows (and, for
`attemptNumber` 1, an `xp_ledger` row),
`lesson.completed` a `lesson_completions` row; payloads are validated with Zod
(`src/progress/progress.schemas.js`). A message that is not JSON or has an
unexpected shape is dropped with a warning; one the database could not store
goes back to the queue after 5 s; an unknown type is ignored. The service
starts without the broker and keeps trying to reach it.

## Dependencies/config

- gRPC server at `PROGRESS_GRPC_HOST`:`PROGRESS_GRPC_PORT` (default
  `localhost:50054`); HTTP `PROGRESS_SERVICE_PORT` (3004) serves health only.
- gRPC client to content-service (`CONTENT_GRPC_HOST`/`CONTENT_GRPC_PORT`),
  `src/progress/content.client.js`: `GetCurriculum`.
- RabbitMQ `RABBITMQ_URL` (default `amqp://localhost:5672`).
- PostgreSQL `PROGRESS_DATABASE_NAME` (`app_progress`). The service loads the
  repository `.env`; run `pnpm --filter @appenglish/progress-service migration:run`.

## Kiểm thử

`pnpm --filter @appenglish/progress-service test`: the rules and the service
with an in-memory repository and a content stand-in (results applied twice,
other learners, mini tests and malformed messages), the consumer's ack/drop/
requeue decisions with a fake channel, and the gateway HTTP ↔ gRPC contract
with a stand-in for auth-service. Results are in
`docs/04-implementation/feature-status.md`.

## Streak (D154)

The consumer applies `activity.recorded` (`{ accountId, activity, occurredAt }`, `activity` in `StudyActivity`) by upserting `study_days` for the day of `occurredAt` in `Asia/Ho_Chi_Minh` and adding the activity to that day's list. `GetStreak` reads the learner's days and computes the streak; nothing is precomputed.

Notifications (D163): the consumer also turns results into rows of `notifications`: a full `mock.submitted` into `MOCK_RESULT` (`total`, `listening`, `reading`, `change` from the previous notified attempt of the same test), `unit-review.passed` into `UNIT_OPENED`. `ListNotifications` (student) first deletes rows older than 30 days, adds today's `STREAK_REMINDER` from 18:00 Vietnam time when the streak is live and today is not studied (or marks it read once studied), then returns the 30 latest and the unread count; rules in `src/progress/notification.rules.js`.

| Method | Gateway route | RPC | Role | Purpose |
|---|---|---|---|---|
| GET | `/progress/notifications` | `ListNotifications` | Student | `{ notifications: [{ id, kind, data, createdAt, read }], unread }` |
| POST | `/progress/notifications/read` | `MarkNotificationsRead` | Student | Body `{ ids? }` (all when left out); returns `{ unread }` |
