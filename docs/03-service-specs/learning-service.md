# Learning service

## Trạng thái xác minh

VERIFIED 2026-10-10 for placement (F03). Lesson attempts, practice and mock
tests (F04, F05) are not implemented.

## Trách nhiệm và nghiệp vụ liên quan

`learning-service` owns what learners do with tests. F03 adds the placement
test attempt (workflow `docs/01-business/workflows/02-placement.md`): one
attempt per learner, a 25-minute server clock, scoring, the starting unit and
the Admin-configurable thresholds. The placement test itself (questions,
answers, audio) is owned by content-service.

## Data ownership (`app_learning`)

Migration `apps/learning-service/src/database/migrations/1730000000000-create-placement.js`;
entities in `src/database/learning.entities.js`.

| Table | Purpose |
|---|---|
| `placement_attempts` | One row per account (unique `accountId`): status `IN_PROGRESS`/`COMPLETED`/`SKIPPED`, placement version it runs on, `startedAt`, `expiresAt`, `submittedAt`, `answers` JSONB (question id → option id), `totalCount`, `correctCount`, `listeningCorrect`, `readingCorrect`, `startUnit` |
| `placement_settings` | Single row (id 1): `unit2Threshold`, `unit3Threshold`, `updatedBy` |

`accountId` and `placementVersionId` refer to other services' data and have no
foreign key. No row exists for a learner who has not started; no settings row
means the defaults (60 and 80).

## API

Public HTTP routes exist only on the gateway
(`apps/api-gateway/src/learning/learning-gateway.controller.js`). Each needs a
valid session; the gateway calls auth-service `Me` and passes the actor to
`appenglish.learning.v1.LearningService`
(`packages/learning-contracts/proto/learning.proto`).

| Method | Gateway route | RPC | Who | Purpose |
|---|---|---|---|---|
| GET | `/placement` | `GetPlacement` | Student | State: not started (`available`, `durationMinutes`), in progress (paper, saved answers, `expiresAt`, `serverNow`) or the result |
| POST | `/placement/start` | `StartPlacement` | Student | Creates the attempt and returns the paper; returns the same attempt while it is in progress |
| PUT | `/placement/answers` | `SavePlacementAnswers` | Student | Saves `{ answers }` chosen so far |
| POST | `/placement/submit` | `SubmitPlacement` | Student | Scores `{ answers }` and returns the result |
| POST | `/placement/skip` | `SkipPlacement` | Student | Uses up the attempt; start at unit 1 |
| GET | `/placement/settings` | `GetPlacementSettings` | Admin | Thresholds and duration |
| PUT | `/placement/settings` | `UpdatePlacementSettings` | Admin | `{ unit2Threshold, unit3Threshold }`, whole percents 1–100, unit 2 below unit 3 |

Responses use the `{ code, msg, data }` envelope. Learning codes
(`packages/learning-contracts/src/index.js`): 50 placement not available (no
published test), 51 already taken or skipped, 52 no attempt in progress; 26
forbidden role, 30 validation, 32 gateway/system keep their meaning.

The paper sent to a learner has no correct answers, explanations or
transcripts. The result has `status`, `startUnit` and, when completed,
`correctCount`, `totalCount` and `scorePercent` (whole percent) only (D56).

## Rules

- One attempt per learner, enforced by the unique `accountId`; skipping counts
  as the attempt (D35).
- The clock is the server's: `expiresAt = startedAt + 25 minutes`
  (`PLACEMENT_DURATION_MINUTES`, D57). A submit up to 30 seconds late still
  counts. After that the attempt is scored with the answers saved in time, at
  the next read or at a late submit.
- Score: right answers out of 23, also split into Listening (Parts 1–4) and
  Reading (Parts 5–7). Unanswered and unknown answers are wrong.
- Starting unit (`placementStartUnit`): unit 3 from the unit 3 threshold, unit
  2 from the unit 2 threshold, else unit 1, compared as exact fractions and
  never above the number of published units. Thresholds changed later do not
  change stored results.
- No shuffling of options, no progress update, no XP, no event (D56).
- An attempt keeps the placement version it started on; a version published
  meanwhile is used by learners who start afterwards (D40, D57).

## Dependencies/config

- gRPC server at `LEARNING_GRPC_HOST`:`LEARNING_GRPC_PORT` (default
  `localhost:50053`); HTTP `LEARNING_SERVICE_PORT` (3003) serves health only.
- gRPC client to content-service (`CONTENT_GRPC_HOST`/`CONTENT_GRPC_PORT`) for
  `GetPlacementPaper` (`src/placement/content.client.js`): the published
  version with answers, media URLs and the number of published units.
- PostgreSQL `LEARNING_DATABASE_NAME` (`app_learning`). The service loads the
  repository `.env`; run `pnpm --filter @appenglish/learning-service migration:run`.

## Kiểm thử

`pnpm --filter @appenglish/learning-service test`: service rules with an
in-memory repository and a content stand-in, and the gateway HTTP ↔ gRPC
contract with a stand-in for auth-service. Results are in
`docs/04-implementation/feature-status.md`.
