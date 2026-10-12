# Learning service

## Trạng thái xác minh

VERIFIED 2026-10-10 for placement (F03) and 2026-10-11 for the lesson flow
(F04) and mock tests (F05A). Practice (F05B) is not implemented.

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

## Lesson flow (F04, D59–D61)

Workflows `03-units-lessons.md`, `04-vocabulary-exercises.md` and
`05-lesson-test-unlock.md`. Code in `apps/learning-service/src/lesson/`; the
pure rules are in `lesson.rules.js`.

### Data (`app_learning`)

Migration `1730000001000-create-lesson-flow.js`.

| Table | Purpose |
|---|---|
| `lesson_progress` | One row per account and lesson: `reviewPassedAt`, `vocabularyStudiedAt`, `vocabularyQuizPassedAt`, `fillInPassedAt`, `completedAt`. Belongs to the lesson, not to a lesson version |
| `lesson_test_attempts` | One row per attempt: `attemptNumber`, lesson version, status `IN_PROGRESS`/`COMPLETED`, `startedAt`, `expiresAt`, `submittedAt`, `optionOrder`, `answers`, `totalCount`, `correctCount`, `listeningCorrect`, `readingCorrect`, `durationSeconds`, `passed`, `accountEmail` (for the ranking). At most one in progress per account and lesson |

### API

Gateway controller `LessonGatewayController` in
`apps/api-gateway/src/learning/learning-gateway.controller.js`. All routes are
for Students; `:id` is a lesson id.

| Method | Gateway route | RPC | Purpose |
|---|---|---|---|
| GET | `/learning/curriculum` | `GetCurriculum` | Published units and lessons with `state` (`LOCKED`/`OPEN`/`COMPLETED`), best test score, `startUnit`, `placementRequired` |
| GET | `/learning/lessons/:id` | `GetLesson` | Lesson, its steps with status, vocabulary, fill-in passage and word bank, review target, test summary. No answers |
| POST | `/learning/lessons/:id/vocabulary/studied` | `MarkVocabularyStudied` | The learner opened every word |
| GET | `/learning/lessons/:id/quiz/:kind` | `GetVocabularyQuiz` | `kind` `vocabulary` or `review`: one question per word, up to four meanings, random order |
| POST | `/learning/lessons/:id/quiz/:kind` | `SubmitVocabularyQuiz` | `{ answers: { vocabularyId: meaning } }` → `{ passed, total, wrongIds }` |
| POST | `/learning/lessons/:id/fill-in` | `SubmitFillIn` | `{ answers: [word, …] }` → `{ passed, total, wrongBlanks }` |
| GET | `/learning/lessons/:id/test` | `GetLessonTest` | `LOCKED`, `READY`, or `IN_PROGRESS` with the paper, saved answers and clock; finished attempts with per-skill counts; `progression` |
| POST | `/learning/lessons/:id/test/start` | `StartLessonTest` | New attempt, or the one in progress |
| PUT | `/learning/lessons/:id/test/answers` | `SaveLessonTestAnswers` | Saves `{ answers }` chosen so far |
| POST | `/learning/lessons/:id/test/submit` | `SubmitLessonTest` | Scores and returns the result with the review |
| GET | `/learning/lessons/:id/test/review` and `/review/:attemptNumber` | `GetLessonTestReview` | One finished attempt (the latest, or the numbered one): correct answers, the learner's answers, explanations, transcripts |
| GET | `/learning/lessons/:id/ranking` | `GetLessonRanking` | First attempts ranked: `{ total, entries (top 50), me }` |

Codes: 53 lesson not found, 54 lesson locked (`data.placementRequired`), 55 an
earlier step is not finished (`data.step`), 56 no lesson test in progress.

### Rules

- A learner sees lessons once the placement test is taken or skipped. Units
  before the starting unit are open freely; from the starting unit on a lesson
  opens when the lesson before it (in curriculum order, across units) is
  completed. Opening is not completing.
- Steps in order: review (when required) → vocabulary → word quiz → fill-in →
  test. The review is required when the learner completed the lesson before,
  except for the first lesson of the starting unit, and is not imposed on a
  lesson already started.
- Word quiz, review and fill-in need every answer right; wrong items are named
  and tries are unlimited. They are checked on the server from the published
  lesson; the correct answers are not sent.
- Lesson test: 25 minutes on the server clock, 30 seconds of grace, answers
  saved during the test; a test left open is scored when its time is over.
  Options of Parts 3–7 are shuffled per attempt. 80% or more
  (`lessonTestPassed`) completes the lesson; retakes are unlimited and a worse
  retake does not undo completion.
- Ranking: first attempts only, by right answers, then `durationSeconds`
  (capped at the time allowed), then earlier submit.
- Progression (D62, `testProgression`): from the second finished attempt,
  `{ trend, changeFromPrevious, changeFromFirst, listeningChange,
  readingChange, bestCorrectCount }` in right answers, the latest attempt
  against the one before it and against the first. It informs the learner
  only: ranking, completion and XP are unaffected.
- An attempt keeps the lesson version it started on; steps stay done when a
  lesson is republished.
- No XP, no progress event yet: Reading/Listening mastery (D33) is F06 and
  will read the per-skill counts stored on each attempt.

## Mock tests (F05A, D63, D64)

Workflow `06-practice-mock.md`. Code in `apps/learning-service/src/mock/`.

### Data (`app_learning`)

Migration `1730000002000-create-mock-attempts.js`.

| Table | Purpose |
|---|---|
| `mock_attempts` | One row per attempt: `kind` `FULL` or `MINI`, `partKey` (`''` for a full attempt), `attemptNumber` within that series, mock version, status, `startedAt`, `expiresAt` (null for a mini test), `optionOrder`, `answers`, counts per skill with their totals, `listeningScore`/`readingScore` (estimated, full attempts only), `durationSeconds`. One attempt in progress per learner for the full test and for each part |
| `score_conversion` | Single row (id 1): `listening` and `reading`, 101 estimated section scores for 0–100 right answers. No row means the default table |

### API

Gateway controller `MockGatewayController`. A reference says which series a
call is about: `{ kind: 'FULL' }` or `{ kind: 'MINI', partKey }` (query string
on GET, body otherwise).

| Method | Gateway route | RPC | Who | Purpose |
|---|---|---|---|---|
| GET | `/mock-tests` | `ListMockTests` | Student | Published mock tests with the learner's full attempts (count, best percent, latest estimated total), `recommended`, and `recommendedLevel` |
| GET | `/mock-tests/:id` | `GetMockTest` | Student | The test, the full series and each part's mini series: finished attempts, `progression`, `inProgress` |
| GET | `/mock-tests/:id/attempt` | `GetMockAttempt` | Student | The attempt in progress with its paper, or `{ status: 'NONE' }` |
| POST | `/mock-tests/:id/attempt/start` | `StartMockAttempt` | Student | New attempt, or the one in progress |
| PUT | `/mock-tests/:id/attempt/answers` | `SaveMockAnswers` | Student | Saves `{ answers }` chosen so far |
| POST | `/mock-tests/:id/attempt/submit` | `SubmitMockAttempt` | Student | Scores and returns the result with the review |
| GET | `/mock-tests/:id/review` | `GetMockReview` | Student | One finished attempt (`attemptNumber`, default the latest) with answers, explanations, transcripts |
| GET, PUT | `/mock-tests/score-conversion` | `GetScoreConversion`, `UpdateScoreConversion` | Admin | The conversion table; 101 non-decreasing multiples of 5 from 5 to 495 per section |

Codes: 57 mock test not found, 58 no mock attempt in progress.

### Rules

- Full attempt: `expiresAt = startedAt + durationMinutes` of the mock test, 30
  seconds of grace, answers saved during the test; one left open is scored
  when its time is over. Mini attempt: no time limit.
- Both kinds can be repeated without limit and shuffle the options of Parts
  3–7 per attempt. `countsForXp` is true only for the first full attempt of a
  mock test; XP itself is F07.
- Score: right answers in total and per skill. A full attempt also stores the
  estimated section scores from the conversion table (`estimatedScores`): a
  section with another number of questions than 100 is scaled by its share of
  right answers. Later changes of the table do not rewrite stored attempts.
- Suggested level (`recommendedLevel`): from the estimated total of the
  latest full attempt (below 450: 1, below 700: 2, else 3); before any, from
  the placement's starting unit; else 1. It never locks a test.
- `progression` per series as in the lesson test (D62).
- The paper carries `audioUrl` on each Part 1–2 question and on each Part
  3–4 set (`groups`); the review adds their transcripts (D66). The graphic of
  a Part 3–4 set is the `imageUrl` of its "Look at the graphic" question (D71).
- An attempt keeps the mock version it started on.

## Dependencies/config

- gRPC server at `LEARNING_GRPC_HOST`:`LEARNING_GRPC_PORT` (default
  `localhost:50053`); HTTP `LEARNING_SERVICE_PORT` (3003) serves health only.
- gRPC client to content-service (`CONTENT_GRPC_HOST`/`CONTENT_GRPC_PORT`),
  `src/placement/content.client.js`: `GetPlacementPaper` (published placement
  version with answers, media URLs, number of published units),
  `GetCurriculum` (published units and lessons in order), `GetLessonPaper`
  (a lesson's published version with answers and media URLs),
  `ListPublishedMockTests` and `GetMockPaper`.
- PostgreSQL `LEARNING_DATABASE_NAME` (`app_learning`). The service loads the
  repository `.env`; run `pnpm --filter @appenglish/learning-service migration:run`.

## Kiểm thử

`pnpm --filter @appenglish/learning-service test`: service rules with an
in-memory repository and a content stand-in, and the gateway HTTP ↔ gRPC
contract with a stand-in for auth-service. Results are in
`docs/04-implementation/feature-status.md`.
