# Content service

## Ownership

`content-service` owns content-domain data in PostgreSQL `app_content`. F02A
added the reusable media-storage boundary; F02 adds units, lessons, lesson
versions, media assets and the gRPC contract described below.

## Media storage boundary (F02A)

The `MediaStorage` contract is represented by the `MEDIA_STORAGE` provider in
`apps/content-service/src/media/media-storage.js`. Adapters expose
`upload({ kind, fileName, mimeType, sizeBytes, data })` and return a normalized
media object with an identifier, delivery URL, and storage type (`local`,
`imagekit` or `r2`), and
`delete({ storage, storageId })`, which treats an already missing file as
deleted. An adapter also deletes files stored elsewhere before it was
enabled (R2: local files, and ImageKit files while the ImageKit keys are set).

- `local` is the default when no ImageKit credentials are configured. It writes
  outside build output to `MEDIA_LOCAL_ROOT`.
- `r2` (D67) stores files in a Cloudflare R2 bucket through the S3 API
  (`@aws-sdk/client-s3`, `src/media/r2-media-storage.adapter.js`) under
  `appenglish/<folder>/<uuid>-<file name>` and serves them unchanged from
  `R2_PUBLIC_BASE_URL`. The object key is the asset's `storageId`.
- `@imagekit/nodejs` uses the official ImageKit Node SDK and backend-only credentials.
  ImageKit treats MP4/M4A uploads as video and re-encodes them on delivery,
  which uses up the free plan's video processing allowance.
  Files of a lesson go to `/appenglish/<kind>/unit<n>-lesson<m>/vocabulary`
  or `.../test` (D53; `n` and `m` are the unit and lesson positions at upload
  time): `UploadMedia` takes `lessonId` and `section`, and
  `AutofillPronunciation` takes `lessonId`; uploads without a lesson fall back
  to `/appenglish/audio` and `/appenglish/image`. ImageKit serves `.mp4` files
  re-encoded by default; `?tr=orig-true` returns the uploaded bytes. The
  account's plan rejects the move API. The payload must be
  wrapped with the SDK's `toFile`: a bare `Buffer` is serialised as one form
  field per byte and exhausts the heap.
- Supported inputs are MP3 (`audio/mpeg`), MP4 (`audio/mp4`, `video/mp4`) and M4A (`audio/x-m4a`, `audio/mp4`) audio and JPEG/PNG/WebP
  question images. The adapter validates extension, MIME type, payload size,
  and declared/payload byte length.

F02 exposes upload through `POST /content/media` for Content Managers (see
below). Delivery of the stored files to learners is not exposed yet; the
audio-playing features F03/F04/F05 (D28) must add it.

## ImageKit security limitation

The official Node SDK/upload documentation was checked for server-side upload.
ImageKit's current security documentation URL could not be verified during this
feature, so this project does not claim that a delivery URL or signed URL
protects audio in every delivery context. F03/F04/F05 must verify private-file and
signed-URL behavior from current official documentation before serving
protected audio. The private key remains server-only.

## Audio delivery scope (D28)

Listening audio is played in the placement test (F03), the lesson final test
(F04) and mock tests (F05). There is no separate F09. Practice also plays
audio for Listening questions (D32).

## F02 content (D41, D42)

### Data (`app_content`)

Migration `apps/content-service/src/database/migrations/1720000000000-create-content.js`;
entities in `src/database/content.entities.js`.

| Table | Purpose |
|---|---|
| `units` | Title, description, position, status `DRAFT`/`PUBLISHED` |
| `lessons` | Unit, title, position, `publishedVersionId` |
| `lesson_versions` | Version number, status, `content` JSONB; one `DRAFT` per lesson (partial unique index); `PUBLISHED` rows are never updated |
| `media_assets` | Uploaded audio/image metadata and storage reference |

Lesson content shape (validated by `lessonContentSchema` in
`src/content/content.schemas.js`):

```json
{
  "vocabulary": [{
    "id": "uuid", "word": "ticket", "partOfSpeech": "noun", "phonetic": "/ˈtɪkɪt/",
    "audioUkMediaId": "uuid", "audioUsMediaId": "uuid",
    "meaning": "vé", "example": "I bought a ticket.", "exampleMeaning": "Tôi đã mua một vé."
  }],
  "fillIn": { "passage": "She showed her ___ and walked to the ___.", "answers": ["ticket", "platform"] },
  "test": {
    "part1": { "audioMediaId": "uuid", "transcript": "...", "questions": [ /* 1 */ ] },
    "part3": { "audioMediaId": "uuid", "transcript": "...", "questions": [ /* 3 */ ] },
    "part6": { "passage": "Dear ___, ...", "questions": [ /* 3 */ ] }
    /* part2, part4, part5, part7 likewise */
  }
}
```

Every part has `audioMediaId`, `transcript`, `passage`, `imageMediaId` and
`questions`; every question has `prompt`, `audioMediaId`, `transcript`,
`imageMediaId`, `options` and `explanation`; every option has `text`,
`audioMediaId`, `transcript` and `isCorrect`. Which of these a part uses, and
its fixed question and option counts, are defined once in `LESSON_TEST_PARTS`
(`packages/content-contracts/src/index.js`) and shared by the service and the
editor (D45). Since D48 no part uses the question or option `audioMediaId`/
`transcript`; they stay in the shape so earlier drafts still parse. Parts of speech are the `PartOfSpeech` list in the same file.

Item ids are optional on input; the service assigns missing ones and keeps the
ones sent, so items stay traceable across versions.

### API

Public HTTP routes exist only on the gateway
(`apps/api-gateway/src/content/content-gateway.controller.js`). Each needs a
valid session; the gateway calls auth-service `Me` and passes the actor to the
matching RPC of `appenglish.content.v1.ContentService`
(`packages/content-contracts/proto/content.proto`).

| Method | Gateway route | RPC | Who | Purpose |
|---|---|---|---|---|
| GET | `/content/units` | `ListUnits` | any role | Content Manager: all units/lessons with publishing state. Others: published units and published lessons only |
| POST | `/content/units` | `CreateUnit` | Content Manager | Create a draft unit at the end |
| PATCH | `/content/units/:id` | `UpdateUnit` | Content Manager | Title, description, position (reorders) |
| POST | `/content/units/:id/publish` | `PublishUnit` | Content Manager | Needs at least 1 published lesson (D55) |
| POST | `/content/units/:id/lessons` | `CreateLesson` | Content Manager | Create a lesson with an empty draft |
| PATCH | `/content/lessons/:id` | `UpdateLesson` | Content Manager | Title, position (reorders within the unit) |
| GET | `/content/lessons/:id` | `GetLesson` | any role | Content Manager: draft and published content. Others: published study material without answers |
| PUT | `/content/lessons/:id/draft` | `SaveLessonDraft` | Content Manager | Replace the draft content; creates the next draft version after a publish |
| POST | `/content/lessons/:id/publish` | `PublishLesson` | Content Manager | Validate and freeze the draft as the next version |
| POST | `/content/media` | `UploadMedia` | Content Manager | Multipart `file` + `kind` (`audio`/`image`) + `lessonId` + `section` (`vocabulary`/`test`); returns the media id |
| DELETE | `/content/media/:id` | `DeleteMedia` | Content Manager | Deletes the file from storage and its row when no saved lesson version uses it; returns `{ deleted }` (`false` when it is still in use or storage refused) |
| GET | `/content/placement` | `GetPlacement` | Content Manager | Draft and published version of the placement test, with `media` |
| PUT | `/content/placement/draft` | `SavePlacementDraft` | Content Manager | Replace the draft `{ test }`; creates the next draft version after a publish |
| POST | `/content/placement/publish` | `PublishPlacement` | Content Manager | Validate the seven parts and freeze the draft as the next version |
| — | not exposed | `GetPlacementPaper` | learning-service | `{ versionId? }` → a published version with answers, media URLs and `publishedUnitCount`; takes no actor |
| GET | `/content/exam-types` | `ListExamTypes` | any role | Exam types with `hasEditor` (D69) |
| POST, PATCH | `/content/exam-types`, `/content/exam-types/:id` | `CreateExamType`, `UpdateExamType` | Admin | Add `{ name }` (no editor yet) or rename; names must differ. Code 45 with `data.reason` `NAME_TAKEN` |
| GET, POST | `/content/mock-tests` | `ListMockTests`, `CreateMockTest` | Content Manager | List with publishing state, `examType` and `createdAt`; create `{ title, examTypeId, level, durationMinutes }` with an empty draft. The exam type must have an editor (code 45, reason `NO_EDITOR`) |
| GET, PATCH | `/content/mock-tests/:id` | `GetMockTest`, `UpdateMockTest` | Content Manager | Draft and published version with `media`; change title, level or minutes (applies at once) |
| PUT | `/content/mock-tests/:id/draft` | `SaveMockTestDraft` | Content Manager | Replace the draft `{ test }` |
| POST | `/content/mock-tests/:id/publish` | `PublishMockTest` | Content Manager | Validate and freeze the draft as the next version |
| — | not exposed | `ListPublishedMockTests` | learning-service | Published mock tests with `questionCount` and `partCounts` |
| — | not exposed | `GetMockPaper` | learning-service | Mock test id + `{ versionId? }` → a published version with answers and media URLs |
| — | not exposed | `GetCurriculum` | learning-service, progress-service | Published units in order with their published lessons; takes no actor |
| — | not exposed | `GetLessonPaper` | learning-service | Lesson id + `{ versionId? }` → a published lesson version with answers and media URLs; 404 when the lesson or its unit is not published |
| POST | `/content/pronunciation` | `AutofillPronunciation` | Content Manager | `{ word, accents? }`; asks the pronunciation source (speech-service by default, D123; the free dictionary only with `PRONUNCIATION_SOURCE=dictionary`) and returns `{ found, phonetic, audio: { uk, us } }` with stored media (each with its `url` to play at once, `null` for a locally stored file) or `null` |

Responses use the `{ code, msg, data }` envelope. Content codes
(`packages/content-contracts/src/index.js`): 40 not found, 41 invalid state
(no draft to publish), 42 not publishable (`data.issues` lists `{ path,
message }`), 43 media rejected (`data.reason`); 26 forbidden role, 30
validation, 32 gateway/system keep their meaning from auth.

### Unit review (D121)

Migration `1720000011000-create-unit-reviews.js`: `units.reviewVersionId` (the
published review version, or null) and `unit_review_versions` (`unitId`,
`versionNumber`, `status`, `content`, one `DRAFT` per unit; `PUBLISHED` rows
never updated). Content shape `unitReviewContentSchema`: `{ test: { part5,
part6 } }` in the mock-test part shape (Part 6 passages are `groups`, their
questions carry `groupId`); no media. Publishing rules `unitReviewIssues`:
exactly 10 Part 5 questions with text; exactly 3 Part 6 passages, each with
exactly 3 `___` blanks and 3 questions (D129; the counts are the
`UNIT_REVIEW_*` constants of content-contracts); every question four different options,
one correct, an explanation.

| Method | Gateway route | RPC | Who | Purpose |
|---|---|---|---|---|
| GET | `/content/units/:id/review` | `GetUnitReview` | Content Manager | `{ unit, questionCount, draft, published }` |
| PUT | `/content/units/:id/review/draft` | `SaveUnitReviewDraft` | Content Manager | Replace the draft `{ test }`; creates the next draft version after a publish |
| POST | `/content/units/:id/review/publish` | `PublishUnitReview` | Content Manager | Validate and freeze the draft as the next version; sets `units.reviewVersionId` |
| POST | `/content/units/:id/review/unpublish` | `UnpublishUnitReview` | Content Manager | Clears `reviewVersionId`; versions are kept |
| — | not exposed | `GetUnitReviewPaper` | learning-service | Unit id + `{ versionId? }` → `{ unit, versionId, versionNumber, test }` with answers; 404 unless the unit and its review are published |

`ListUnits` (Content Manager) adds `review: { publishedVersionNumber,
hasDraft }` to each unit; `GetCurriculum` adds `reviewVersionId`. Deleting a
unit removes its review versions; the gateway refuses the delete while any
learner has a review attempt (`GetContentUsage` kind `unit`).

### Version history (D122)

`src/versions/version.service.js` (`ContentVersionService`) serves every
versioned content by `kind` (`ContentVersionKind`: `lesson`, `mockTest`,
`listeningExercise`, `courseItem`, `unitReview`); `id` is the owner (lesson,
mock test, exercise, course item or unit). Repository: `listVersionsOf`,
`findVersionOf`.

| Method | Gateway route | RPC | Who | Purpose |
|---|---|---|---|---|
| GET | `/content/versions/:kind/:id` | `ListContentVersions` | Content Manager | `{ versions: [{ id, versionNumber, status, current, publishedAt, publishedBy, createdAt, createdBy }] }`, newest first; `current` marks the version learners get |
| GET | `/content/versions/:kind/:id/:versionId` | `GetContentVersion` | Content Manager | The same facts plus `content`; 404 when the version belongs to another owner |
| POST | `/content/versions/:kind/:id/:versionId/restore` | `RestoreContentVersion` | Content Manager | Copies the version over the draft through the kind's save-draft call (ids and media clean-up as usual) and returns the editor's view plus `restoredFrom`; 41 when the version is the draft itself |
| DELETE | `/content/versions/:kind/:id/draft` | `DiscardContentDraft` | Content Manager | Deletes the draft row and, afterwards, the media files no remaining version refers to (`removeUnusedMedia`) → `{ discarded: { versionId, versionNumber }, removedMedia }`; 41 without a draft (D127) |
| DELETE | `/content/versions/:kind/:id/:versionId` | `DeleteContentVersion` | Content Manager | Removes an old version and the files only it used → `{ deleted: { versionId, versionNumber }, removedMedia }`; 41 for the draft or the live version (`data.reason` `CURRENT`); the gateway answers 409 CONTENT_IN_USE first while learner attempts refer to the version (`GetContentUsage` kinds `lessonVersion`, `mockVersion`, `unitReviewVersion`, `courseVersion`; `listeningVersion` is never used) (D128) |

Unpublishing any kind now creates a draft from the version taken down when
there is no draft, so the editor keeps the content.

### Placement test (F03, D46, D57, D58)

The single placement test lives in `placement_versions` (migration
`1720000002000-create-placement.js`): one `DRAFT` row and immutable
`PUBLISHED` rows, like `lesson_versions` without a parent row. Its content is
`{ test }` with the same seven parts as a lesson test
(`placementContentSchema`) and it is published under the same test rules
(`placementIssues`). Uploads with `section=placement` go to
`/appenglish/<kind>/placement`. Media referenced by a placement version is
protected from deletion like lesson media. Attempts and scoring are in
learning-service (`docs/03-service-specs/learning-service.md`).

### Mock tests (F05A, D63)

`exam_types` (migration `1720000004000-create-exam-types.js`): `code`, `name`
and `format` (`ExamFormat`; null means no editor). TOEIC is created by the
migration. `mock_tests.examTypeId` is required; every mock-test view carries
`examType: { id, code, name }`.

`mock_tests` (title, level 1–3, `durationMinutes`, `publishedVersionId`) and
`mock_test_versions` (migration `1720000003000-create-mock-tests.js`), with
the life cycle of lesson versions. Content is `{ test }` over the same seven
parts (`mockContentSchema`), with these differences from a lesson test
(D63, D66):

- a part holds from one question up to its TOEIC count
  (`MOCK_TEST_PART_COUNTS`), and a Part 3–4 set up to
  `MOCK_SET_QUESTION_COUNT` (3) questions (D72);
- Parts 1 and 2: every question has its own `audioMediaId` and `transcript`;
- Parts 3, 4, 6 and 7 are made of sets, `groups` (`{ id, audioMediaId,
  transcript, passage, imageMediaId }`), that their questions reference by
  `groupId`: a recording with its transcript in Parts 3–4 (one conversation or
  talk, usually three questions), a passage in Parts 6–7;
- the graphic of a Part 3–4 set is the `imageMediaId` of one of its questions,
  the "Look at the graphic" one (D71); the set's own `imageMediaId` is only
  used by Part 7;
- the part-level `audioMediaId`/`transcript` are not used.

Publishing (`mockIssues`): every part has at least one question and no more
than its TOEIC count, a Part 3–4 set no more than three (D72); every Part
1–2 question has audio and transcript, Part 1 questions also a photograph;
Parts 3, 4, 6 and 7 have at least one set and every set has at least one
question; a Part 3–4 set has audio and transcript; conversations 11–13 of Part 3 and talks 9–10 of Part 4 (`MOCK_GRAPHIC_SET_INDEXES`) have an image on exactly one question and no other Part 3–4 question has one (D71); a Part 6–7 set has a
passage, and a Part 6 passage has one blank per question; options, correct
answer and explanation as in a lesson test. Uploads with `section=mock` go to
`/appenglish/<kind>/mock`. The default upload limit is 40 MB
(`MEDIA_MAX_FILE_SIZE_BYTES`); the gateway accepts up to 48 MB and gRPC
messages up to 64 MB.

### Rules

- Publishing a lesson requires (D43–D45, D48, D51):
  - Vocabulary: at least one item; each with word, part of speech from the
    list, meaning and example; phonetic, example translation and British and
    American audio are optional for now (D51), but audio that is set must be
    an existing audio asset; a word may repeat only with a different part of
    speech.
  - Fill-in: a passage with at least one `___`, one typed, non-empty answer
    per blank (D119; the answer need not be a vocabulary word).
  - Test: all seven parts with their exact question and option counts; exactly
    one correct option and an explanation per question; text options non-empty
    and distinct (Parts 3–7; Part 1 and 2 options are letters only); one audio
    with its transcript for each of Parts 1–4; the Part 1
    photograph; the Part 6 passage with exactly three blanks; the Part 7
    document (its image is optional).
  - Every referenced media asset exists with the right kind.
- The Content Manager lesson view (`GetLesson`, `SaveLessonDraft`,
  `PublishLesson`, `CreateLesson`) includes `media`: `{ [mediaId]: { kind,
  fileName, url } }` for the files its contents use, so the editor can play
  stored audio and show stored images. `url` is `null` for locally stored
  files, which have no delivery route. Learners do not get it.
- Test questions are numbered 1–23 across the parts (D52);
  `LESSON_TEST_PARTS[].firstQuestionNumber` gives each part's first number.
- Deferred upload (D50): the editor keeps chosen files in the browser with a
  preview and calls `UploadMedia` only when the lesson is saved (Save draft or
  Publish), replacing its temporary ids with the media ids before sending the
  draft.
- Media cleanup (D49): the editor calls `DeleteMedia` when a file is removed,
  and saving a draft deletes the files that save dropped. Both delete only
  media that no saved lesson version (draft or published) refers to, so
  published versions keep their files. A storage failure is logged and keeps
  the row. Not cleaned automatically: uploads abandoned without saving and
  files only old published versions use.
- A published version is immutable. Saving a draft after a publish creates the
  next version; learners keep the current published version until it is
  published.
- The learner view contains vocabulary, the fill-in passage with its blank
  count but no answers (learning-service builds the learner's word bank from the answers, D111) and the number of test questions (23).
  Test questions, correct options, transcripts and explanations are not
  returned; the lesson-flow feature (F04) must add its
  own internal contract to read them.
- There is no delete or unpublish operation.

### Config

`CONTENT_GRPC_HOST`/`CONTENT_GRPC_PORT` (default `localhost:50052`). The gRPC
message limit is 16 MB for uploads; the gateway accepts files up to 12 MB and
content-service applies `MEDIA_MAX_FILE_SIZE_BYTES`. A relative
`MEDIA_LOCAL_ROOT` is resolved from the repository root. Run
`pnpm --filter @appenglish/content-service migration:run` after pulling F02.

### Tests

- `test/content.service.test.js`: role checks, ordering, drafts, publishing
  rules, versioning, unit publishing, learner view, media upload mapping.
- `test/gateway-grpc.test.js`: real gateway HTTP server, multipart upload, gRPC
  transport and `ContentGrpcController` with an in-memory repository and a
  stand-in auth `Me` RPC.

### Content Manager UI

Web client pages under `apps/web-client/src/features/content-manager/`, reachable
only with the `CONTENT_MANAGER` role:

- `/content-manager/units` (`ContentUnitsPage.jsx`): add units and lessons, edit
  a unit's title/description, move units and lessons up/down, publish a unit,
  see each lesson's published version and draft state.
- `/content-manager/lessons/:lessonId` (`LessonEditorPage.jsx`): rename the
  lesson; edit vocabulary (word, part of speech, IPA, meaning, example and its
  translation, British and American MP3), the fill-in passage (one answer typed
  per blank, D119) and the seven test parts on their own tabs, each showing its
  fixed questions and options; save the draft; publish. A
  rejected publish lists the issues and opens the tab of the first one.

The editor works on the draft, or on a copy of the published version when no
draft exists. Uploaded files are shown by name only during the session that
uploaded them; afterwards the question shows "Audio attached"/"Image attached",
because media delivery is not exposed yet.

### Content shape history

Drafts written before D43–D45 were converted by migration
`1720000001000-upgrade-lesson-content-shape.js`: vocabulary kept, fill-in
sentences joined into the passage, the flat test reset to the empty seven-part
test. No lesson had been published in the old shape.

### Pronunciation auto-fill (D47)

**Since D123 the source is speech-service**: `SpeechPronunciationSource`
(`src/pronunciation/speech-pronunciation.source.js`) sends `{ word, accents }`
on `speech.pronounce.requests` through `SpeechBroker.request` (reply queue +
correlation id, 30 s) and gets IPA and MP3 bytes per accent back; the service
stores the MP3s as lesson media exactly as it stored the dictionary files.
`found` is always true (a phrase is pronounced like a word); a broker that is
away or a FAILED answer is code 46 (unavailable). `PRONUNCIATION_SOURCE=dictionary`
restores the dictionary source below; `PRONUNCIATION_IPA_ACCENT` (`uk`
default since D148, or `us`) picks which IPA is shown. The Listening course
editor asks for the British audio only (D148). `scripts/pronounce-600-words.mjs`
(`pnpm pronounce:600-words`) fills every empty phonetic/audio field of the
lesson drafts through `AutofillPronunciation` and saves the drafts.

`src/pronunciation/dictionary-pronunciation.source.js` queries
`DICTIONARY_API_URL` (default `https://api.dictionaryapi.dev/api/v2/entries/en`),
takes the first IPA text and the first audio URL ending in `-uk.mp3` and
`-us.mp3`, downloads them (HTTPS on the dictionary host only, 2 MB limit) and
stores them through `MediaStorage` as ordinary audio assets. Lookups are
retried up to five times within 20 seconds because the service intermittently
answers with an HTML error page or a gateway timeout; if it still does not
answer the route returns 503 code 44. A word the dictionary does not have
returns `found: false`. The editor's "Auto-fill pronunciation" button fills only
empty fields, so manual entries and uploads are never overwritten.

Observed on 2026-10-10 through the running stack: of twelve lookups two
succeeded (one stored a 19 KB American MP3, one returned IPA but both audio
downloads timed out); the rest ended in 503 after retries. British audio was
absent for several common words. Treat the feature as a convenience that may
often fail, not as the way to satisfy the audio requirement.

`test/pronunciation.test.js` covers parsing, retries, real misses, the download
host/size guard and the service behaviour with a stand-in source.

## Listening practice content (F05B-2, D85)

Code in `apps/content-service/src/listening/` (own gRPC controller, service,
repository and schemas; files go through `ContentService` upload and clean-up,
folder `audio/listening`). Migration `1720000005000-create-listening` creates
`listening_topics` (TOEIC seeded with format `toeic`), `listening_exercises`
(`topicId`, `title`, `level` A1–C2, `kind` part1–part4, `publishedVersionId`)
and `listening_exercise_versions` (DRAFT/PUBLISHED, one draft per exercise,
`content` jsonb). `isMediaReferenced` also searches the listening versions.
Each sentence may carry a Vietnamese `translation` (D157). A listening exercise's content may carry a `source` (`{ name, url }`, both optional, D155), shown to learners as a credit, for example VOA Learning English.

Content: `{ audioMediaId, segments: [{ id, speaker, text, start, end }] }`,
times in seconds, at most 80 sentences of 500 characters.

| Method | Path | RPC | Who |
|---|---|---|---|
| GET | `/content/listening-topics` | `ListListeningTopics` | Any role |
| POST, PATCH | `/content/listening-topics`, `/content/listening-topics/:id` | `CreateListeningTopic`, `UpdateListeningTopic` | Admin, Content Manager; `{ name, format }` (`toeic`, `song`, `talks` (D155) or null; PATCH takes either); 46 `LISTENING_TOPIC_INVALID` (`NAME_TAKEN`, `HAS_EXERCISES` when the format of a topic with exercises changes) |
| DELETE | `/content/listening-topics/:id` | `DeleteListeningTopic` | Admin, Content Manager (D159); only a topic without exercises (drafts included); returns `{ deleted: { id } }`; 40 when missing; 46 `LISTENING_TOPIC_INVALID` `HAS_EXERCISES` with `exerciseCount` |
| GET, POST | `/content/listening-exercises` | `ListListeningExercises`, `CreateListeningExercise` | Content Manager; create `{ topicId, title, level, kind }` (kind `part1`–`part4` for a TOEIC topic, `song` for a song topic, `conversation` or `talk` for a talks topic, D155); 46 (`NO_EDITOR` for a topic without format, `KIND_MISMATCH`) |
| PATCH, GET | `/content/listening-exercises/:id` | `UpdateListeningExercise` (`title`, `level`), `GetListeningExercise` | Content Manager |
| PUT | `/content/listening-exercises/:id/draft` | `SaveListeningExerciseDraft` | Content Manager |
| POST | `/content/listening-exercises/:id/publish` | `PublishListeningExercise` | Content Manager; 42 with `issues` |

Publishing rules: an audio file; Parts 1–2 exactly 4 sentences, Parts 3–4 at
least one; every sentence has text; Parts 3–4 every sentence has start and
end; given times need both, end after start, starts in recording order.
Songs (D88): at least one line, every line timed; a blank is `[word]` (an
empty `[ ]` or an unclosed bracket refuses publishing). `ListPublishedListeningExercises`
also gives `blankCount` for songs. The bracket helpers (`lyricPieces`,
`lyricText`, `lyricBlankCount`) are in `@appenglish/content-contracts`.
Service-to-service reads (no actor, not exposed by the gateway, F05B-3):
`ListPublishedListeningExercises` (every topic, and the published exercises
with `segmentCount`) and `GetListeningPaper` (one exercise's published
version with its transcript and recording URL; 404 when not published).

## Auto-time (D97)

| Method | Path | RPC | Who |
|---|---|---|---|
| POST | `/content/listening-exercises/:id/auto-time` | `RequestListeningAutoTime` | Content Manager. Reads the saved draft (or the published version), needs a recording with a public address (409 `NO_AUDIO`) and lines (409 `NO_LINES`), records a job in `listening_timing_jobs` with its request in the outbox `content_events` (one transaction; relayed to `speech.autotime.requests`, D168), also while RabbitMQ is away. A job still waiting or running is returned instead of a new one |
| GET | `/content/listening-exercises/:id/auto-time` | `GetListeningAutoTime` | Content Manager. `{ job: { id, status, error, lineCount, lines: [{ id, start, end, matched }], createdAt, updatedAt } \| null }`; a job without an answer for 30 minutes shows as FAILED |

`SpeechBroker` (`src/speech/speech.broker.js`, amqplib) connects at start and
keeps retrying every 10 s; answers from `speech.autotime.results` go to
`ListeningService.onAutoTimeResult` (validated with `autoTimeResultSchema`,
unknown or finished jobs ignored). Migration
`1720000006000-create-listening-timing-jobs`. The times are applied to the
draft by the editor ("Apply times"), never by the service.

### Transcribe (D98)

| Method | Path | RPC | Who |
|---|---|---|---|
| POST | `/content/listening-exercises/:id/transcribe` | `RequestListeningTranscribe` | Content Manager. Needs only the saved recording; sends a `transcribe` job. Read with `GET …/auto-time`; the job has `task` (`align`/`transcribe`) and, for transcribe, `lines: [{ text, start, end }]` (trimmed to 500 characters and 80 lines) |

Migration `1720000007000-listening-timing-job-task` adds `task` (default `align`).
One job at a time per exercise, whatever its task.

## Listening course (F05C, D143–D147)

`listening_course_items` holds topics (`type = topic`, level A1–C2,
`position` within the level) and level tests (`type = level_test`, level
A1–C1, one per level); `section` is always null (migration `1720000012000`).
Each item has versions in `listening_course_versions` like mock tests.

A topic's content (D147): its own recording `audioMediaId` (uploaded in the
editor, section `listening`), `segments` (each sentence: `id`, `speaker`,
`text`, `start`, `end`, Vietnamese `translation`, `gap` = the sentence with
the words to write in `[brackets]` or empty), `vocabulary` (4–6 words: word,
IPA, meaning, `audioMediaId` made with the speech-service pronunciation),
`questions` (multiple choice, at least 1), `ordering` (`enabled`, `prompt`,
3–8 `items` in the order heard). Publishing needs the audio, at least one
sentence, a start and end and a translation for every sentence, sentences in
the order of the recording, and at least one blank. A level test: `sections`,
each with its own `audioMediaId`, a `transcript` (text, one sentence per line,
shown after the test) and multiple-choice questions; at least 8 questions.
Saving a draft removes the files it dropped when no other version uses them;
deleting an item removes its recordings, pronunciations and speech jobs.

Content Manager RPCs (gateway `/content/listening-course…`): `ListListeningCourse`
(levels with topics and level test), `CreateCourseItem` (`{ level, type,
title, description }`), `UpdateCourseItem` (`title`, `description`,
`position`), `GetCourseItem` (with `media` of the draft and published version:
kind, file name, URL), `SaveCourseItemDraft`, `PublishCourseItem` (issues
listed when not ready), `UnpublishCourseItem`, `DeleteCourseItem` (refused
while learners completed the topic or took the test).

Speech jobs on a topic's recording (D147), stored in `listening_timing_jobs`
with `courseItemId` and answered like the library's:

| Method | Gateway route | RPC | Purpose |
|---|---|---|---|
| POST | `/content/listening-course/items/:id/auto-time` | `RequestCourseAutoTime` | Times the saved sentences (kind `part3`); 409 `NO_AUDIO` / `NO_LINES`, 409 `NOT_A_TOPIC` for a level test; queued through the outbox (D168). A job still waiting or running is returned |
| POST | `/content/listening-course/items/:id/transcribe` | `RequestCourseTranscribe` | Writes the sentences from the recording alone |
| GET | `/content/listening-course/items/:id/auto-time` | `GetCourseAutoTime` | The latest job of the topic, or null |

Transcribe on a mock test recording (D161), stored in `listening_timing_jobs` with `mockTestId` and `audioMediaId`:

| Method | Gateway route | RPC | Purpose |
|---|---|---|---|
| POST | `/content/mock-tests/:id/transcribe` | `RequestMockTranscribe` | Content Manager; body `{ audioMediaId }`, a recording of Part 1–4 in the saved draft (or the published version); kind sent is the part key; 409 `NO_AUDIO` when the recording is not in the test or not downloadable; queued through the outbox (D168). A job still waiting or running for that recording is returned |
| GET | `/content/mock-tests/:id/transcribe` | `ListMockTranscribe` | `{ jobs }`: the latest job of each recording of the test, each with `audioMediaId` |

Speech-job notices for the Content Manager (D163), read from `listening_timing_jobs` requested by the caller in the last 7 days that are done or failed (a job past the timeout counts as failed):

| Method | Gateway route | RPC | Purpose |
|---|---|---|---|
| GET | `/content/notifications` | `ListContentNotifications` | Content Manager; `{ notifications: [{ id, kind: 'SPEECH_JOB', data: { task, status, error, lineCount, owner: { type, id, title } }, createdAt, read }], unread }`, 30 latest |
| POST | `/content/notifications/read` | `MarkContentNotificationsRead` | Body `{ ids? }`; sets `seenAt`; returns `{ unread }` |

Admin notices (D164): `CONTENT_UNPUBLISHED` rows written by every unpublish that takes a published unit, unit review, lesson, mock test, listening exercise or course item down (`data { type, id, title, by }`), kept 30 days, and `SPEECH_FAILURES` computed per Vietnam day from the failed (or timed-out) speech jobs of the last 7 days (`id` `speech:<day>:<count>`, `data { day, count, lastError }`).

| Method | Gateway route | RPC | Purpose |
|---|---|---|---|
| GET | `/content/admin/notifications` | `ListAdminContentNotifications` | Admin; `{ notifications: [{ id, kind, data, createdAt, read }], unread }` |
| POST | `/content/admin/notifications/read` | `MarkAdminContentNotificationsRead` | Admin; body `{ ids? }` (keys; all listed when left out); returns `{ unread }` |

learning-service reads `ListPublishedCourse` and `GetCoursePaper` (the content
with answers and `media`: id → URL of the recordings and pronunciations).

## Unpublish, delete and orphan media (D118)

| Method | Gateway route | RPC | Notes |
|---|---|---|---|
| POST | `/content/units/:id/unpublish` | `UnpublishUnit` | Unit back to DRAFT; lessons keep their versions |
| DELETE | `/content/units/:id` | `DeleteUnit` | Gateway first checks `GetContentUsage` for every lesson (409 `CONTENT_IN_USE`); removes lessons, versions, media only they used; renumbers units |
| POST | `/content/lessons/:id/unpublish` | `UnpublishLesson` | `publishedVersionId = null`; curriculum skips it |
| DELETE | `/content/lessons/:id` | `DeleteLesson` | Usage check; removes versions and unused media; renumbers the unit's lessons |
| POST | `/content/mock-tests/:id/unpublish` | `UnpublishMockTest` | |
| DELETE | `/content/mock-tests/:id` | `DeleteMockTest` | Usage check (`mock_attempts`) |
| POST | `/content/listening-exercises/:id/unpublish` | `UnpublishListeningExercise` | |
| DELETE | `/content/listening-exercises/:id` | `DeleteListeningExercise` | Usage check (`listening_results`); refused with `reason COURSE_REFERENCE` while any course version names the exercise; removes timing jobs, versions, unused recording |
| POST | `/content/listening-course/items/:id/unpublish` | `UnpublishCourseItem` | |
| DELETE | `/content/listening-course/items/:id` | `DeleteCourseItem` | Usage check by type (topic → `courseTopic`: learners who completed it; level test → `courseTest`: attempts, D145); removes the pronunciations only the topic used |
| GET | `/content/media/orphans` | `ListOrphanMedia` | Media not referenced by any version (lesson, placement, mock, listening, course) and older than one hour |
| DELETE | `/content/media/orphans` | `DeleteOrphanMedia` | `{ ids[] }`; re-checks references; returns `{ deleted[], skipped[] }` |

`isMediaReferenced` now also scans `listening_course_versions`. The main placement test has no unpublish or delete.

## Speaking/Writing prompt bank (F11, D170, D176)

Code: `src/practice/` (`practice.schemas.js`, `practice.repository.js`, `practice.service.js`, `practice.grpc.controller.js`); tables in `database-allocation.md`.

| Method | Path | RPC | Who | Rules |
|---|---|---|---|---|
| GET | `/content/practice-prompts` | `ListPracticePrompts` | Teacher, CM | Teacher: own prompts. CM: every prompt except those that only ever had a draft |
| POST | `/content/practice-prompts` | `CreatePracticePrompt` | Teacher | `{ kind }`; creates version 1 as `DRAFT` with default content (level A2) |
| GET | `/content/practice-prompts/:id` | `GetPracticePrompt` | Teacher (author), CM | `{ prompt, latest, published, media }`; another teacher's prompt is 404 |
| PUT | `/content/practice-prompts/:id/draft` | `SavePracticePromptDraft` | Author | `{ content }`; updates a `DRAFT`/`RETURNED` version in place, otherwise starts a new version; 409 code 41 while in review |
| POST | `/content/practice-prompts/:id/submit` | `SubmitPracticePrompt` | Author | Runs `practiceIssues`; missing fields are 409 code 42 with `issues[]` |
| POST | `/content/practice-prompts/:id/withdraw` | `WithdrawPracticePrompt` | Author | Back to `DRAFT` |
| POST | `/content/practice-prompts/:id/approve` | `ApprovePracticePrompt` | CM | Publishes the version; the previously published one becomes `ARCHIVED` |
| POST | `/content/practice-prompts/:id/return` | `ReturnPracticePrompt` | CM | `{ note }` required (1–1000) |
| POST | `/content/practice-prompts/:id/unpublish` | `UnpublishPracticePrompt` | CM | Published version becomes `UNPUBLISHED`; learners stop seeing it |
| DELETE | `/content/practice-prompts/:id` | `DeletePracticePrompt` | Author | Only if no version was ever published and it is not in review; removes its unused media |

Content limits come from `PRACTICE_LIMITS` in content-contracts. Required to submit: title and topic; read aloud needs the text (500 characters); open speaking and writing need instructions and a sample answer; writing needs `minWords <= maxWords` and a sample answer within that range. Open speaking time is 15–120 seconds. Media upload with `section=practice` is allowed for the `TEACHER` role only and stored under `<kind>/practice`; `isMediaReferenced` scans `practice_prompt_versions`. Errors: `PRACTICE_PROMPT_NOT_FOUND` 40/404, state conflicts 41/409.

Web: teacher area `/teacher` (dashboard with one card per kind; one list per kind: `/teacher/read-aloud`, `/teacher/open-speaking`, `/teacher/writing`, each creating its own kind; editor `/teacher/<kind>/:id` with preview; the old `/teacher/prompts` links redirect), CM review split by area: `/content-manager/speaking-prompts` (read aloud and open speaking, kind filter) and `/content-manager/writing-prompts`, waiting first, with the author and a teacher filter; detail at `/content-manager/<area>-prompts/:id` showing who wrote it (new version vs live version, approve, return with note, take down); old `/content-manager/practice-prompts` links redirect. The gateway adds `author: { accountId, displayName, avatarUrl }` to every practice prompt response from auth `GetProfiles` (content-service keeps only `authorId`). Shared `PracticePromptView` renders a prompt read-only.

### Learner side of the prompt bank (F12, D177)

| RPC | Caller | Notes |
|---|---|---|
| `ListPublishedPracticePrompts` | learning-service (internal) | `{ prompts: [{ id, kind, versionId, versionNumber, title, level, topic, publishedAt }] }` of published versions |
| `GetPracticePaper` | learning-service (internal) | Published version with full content and `media` URLs; 404 code 40 otherwise |
| `StoreLearnerRecording` (`UploadMediaRequest`) | learning-service (internal) | Media kind `recording` (webm, ogg, m4a, mp3, wav) under `learner-recordings/`; no `media_assets` row; returns `{ recording: { storage, storageId, url, mimeType, sizeBytes } }` |
| `DeleteLearnerRecordings` | learning-service (internal) | `{ recordings: [{ storage, storageId }] }` (max 100) → `{ deleted[], failed[] }` |
| `CreatePracticeMachineAudio` | Teacher, `POST /content/practice-prompts/machine-audio` `{ text }` (≤ 500) | Piper British voice through `speech.pronounce.requests`; saved as practice media like an upload; 503 when the worker does not answer |
