# Content service

## Ownership

`content-service` owns content-domain data in PostgreSQL `app_content`. F02A
added the reusable media-storage boundary; F02 adds units, lessons, lesson
versions, media assets and the gRPC contract described below.

## Media storage boundary (F02A)

The `MediaStorage` contract is represented by the `MEDIA_STORAGE` provider in
`apps/content-service/src/media/media-storage.js`. Adapters expose
`upload({ kind, fileName, mimeType, sizeBytes, data })` and return a normalized
media object with an identifier, delivery URL, and storage type, and
`delete({ storage, storageId })`, which treats an already missing file as
deleted. The ImageKit adapter also deletes files stored locally before it was
enabled.

- `local` is the default when no ImageKit credentials are configured. It writes
  outside build output to `MEDIA_LOCAL_ROOT`.
- `@imagekit/nodejs` uses the official ImageKit Node SDK and backend-only credentials.
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
| POST | `/content/pronunciation` | `AutofillPronunciation` | Content Manager | `{ word, accents? }`; looks the word up in the free dictionary and returns `{ found, phonetic, audio: { uk, us } }` with stored media or `null` |

Responses use the `{ code, msg, data }` envelope. Content codes
(`packages/content-contracts/src/index.js`): 40 not found, 41 invalid state
(no draft to publish), 42 not publishable (`data.issues` lists `{ path,
message }`), 43 media rejected (`data.reason`); 26 forbidden role, 30
validation, 32 gateway/system keep their meaning from auth.

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

### Rules

- Publishing a lesson requires (D43–D45, D48, D51):
  - Vocabulary: at least one item; each with word, part of speech from the
    list, meaning and example; phonetic, example translation and British and
    American audio are optional for now (D51), but audio that is set must be
    an existing audio asset; a word may repeat only with a different part of
    speech.
  - Fill-in: a passage with at least one `___`, one answer per blank, each
    answer a vocabulary word.
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
  count but no answers, the word bank and the number of test questions (23).
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
  translation, British and American MP3), the fill-in passage (one word chosen
  per blank) and the seven test parts on their own tabs, each showing its
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
