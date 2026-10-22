# Phân bổ database theo service

## Quyết định local-development
- Chạy PostgreSQL trực tiếp trên Windows, bên ngoài Docker; Redis và RabbitMQ chạy Docker Compose.
- Một PostgreSQL server local, một database logic riêng cho mỗi service sở hữu dữ liệu.
- Quản lý bằng pgAdmin 4 hoặc DBeaver kết nối đến PostgreSQL local. pgAdmin là GUI client; PostgreSQL Server mới là tiến trình lưu trữ và phục vụ dữ liệu.
- Mỗi service chỉ truy cập database do nó sở hữu. Không tạo cross-service foreign keys hoặc đọc trực tiếp database service khác.
- Dùng TypeORM theo kiến trúc AppEnglish đã mô tả; xác minh package/version và migrations trong code trước khi triển khai. Không thêm Prisma song song.

## Mapping nghiệp vụ mục tiêu

| App/service | Database | Engine | Dữ liệu sở hữu | Ghi chú |
|---|---|---|---|---|
| api-gateway / BFF | Không có | — | Không sở hữu dữ liệu nghiệp vụ | Stateless; gọi services qua contract |
| auth-service | app_identity | PostgreSQL | User identity, credential/auth data, role/status theo schema auth | Không chứa lesson/test results |
| content-service | app_content | PostgreSQL | Unit, lesson, vocabulary, exercises, fixed placement definition, mock/practice definitions, questions, answer/scoring metadata | File audio có thể nằm ở file/object storage; DB giữ metadata/path |
| learning-service | app_learning | PostgreSQL | Lesson completion/attempts, placement attempts/results, practice/mock attempts, answers, scores | Chỉ service này sở hữu attempt/source result theo schema được chốt |
| progress-service | app_progress | PostgreSQL | Reading/Listening progress records/aggregates, XP ledger, best score per mock và leaderboard data | Không tính lại từ DB service khác trực tiếp; nhận contract/event hoặc gọi gRPC |
| web client | Không có | — | Không lưu dữ liệu nghiệp vụ bền vững trong DB | Gọi BFF/Gateway qua HTTP |

Tên bốn database trên được lấy từ thiết kế AppEnglish hiện có: app_identity, app_content, app_learning, app_progress. Database này có thể cùng chạy trong một PostgreSQL server local nhưng vẫn tách riêng để giữ ownership theo service.

## F00 verification

**VERIFIED (2026-10-08):** mapping đã được đưa vào bốn TypeORM DataSource
factories và `.env.example`; database creation script là
`scripts/postgres/create-databases.sql`. Script không drop/reset database.
PostgreSQL server native trả `accepting connections`. Database existence chưa
được xác nhận qua CLI vì phiên xác thực yêu cầu mật khẩu; người dùng có thể xác
nhận bằng pgAdmin/DBeaver.

## F01 auth schema

`auth-service` owns `accounts`, `refresh_tokens`, `otp_challenges` and
`account_audits` in `app_identity` (entities under
`apps/auth-service/src/database/*.entity.js`, six migrations under
`src/database/migrations/`). The append-only TypeORM migrations create
refresh-token family/revocation, OTP challenge and account audit data without
dropping existing tables. F01 does not access any other service
database. F09 (D113) adds the nullable profile columns `displayName`,
`avatarUrl`, `avatarStorage` and `avatarStorageId` to `accounts`
(`1710000004000-add-account-profile.js`); avatar files are stored outside the
database (ImageKit or `storage/avatars`). F01B's extension (D114) adds
`accounts.lastLoginAt`, `accounts.statusReason` and `account_audits.reason`
(`1710000005000-add-account-admin-fields.js`), six migrations in all.

## Service ngoài phạm vi
Payment service không thuộc nghiệp vụ Reading/Listening hiện tại. Nếu repository có service này, không gán nó vào content/learning và không xóa service/schema hiện hữu tự động. Kiểm tra code, migrations và dependencies; ghi lại trạng thái hiện tại, sau đó chỉ loại bỏ khi có quyết định riêng. Nếu còn một service khác không có trong mapping, không tự tạo database cho nó: trước tiên xác minh trách nhiệm và quyết định owner.

## Migrations và seed
- Mỗi service giữ migrations/schema của chính mình và kết nối vào đúng database.
- Chỉ service owner được chạy migration trên database đó.
- Seed nội dung/đề mẫu phải có thể chạy lặp an toàn hoặc có hướng dẫn reset riêng.
- Không dùng một transaction xuyên nhiều service databases. Khi nhiều service cần đồng bộ, dùng gRPC orchestration hoặc RabbitMQ event theo kiến trúc đã định.
- Không chia sẻ credential admin của PostgreSQL giữa các service trong runtime. Dùng user/role riêng theo database khi cấu hình deploy; local development có thể dùng user dev theo hướng dẫn an toàn.

## Reset dữ liệu local
Tạo lệnh/script riêng cho từng database hoặc service. Không dùng một lệnh xóa toàn bộ bốn DB làm lệnh mặc định. Luôn nêu rõ dữ liệu nào bị xóa trước khi reset.

## F02 content schema

`content-service` owns `units`, `lessons`, `lesson_versions` and `media_assets`
in `app_content` (migration
`apps/content-service/src/database/migrations/1720000000000-create-content.js`).
Lesson content is stored as a JSONB snapshot per version; published versions are
immutable (D40). No table references another service's database: `createdBy`,
`publishedBy` and `uploadedBy` hold account ids without a foreign key.

## F03 placement schema

`content-service` adds `placement_versions` to `app_content` (migration
`1720000002000-create-placement.js`). `learning-service` owns
`placement_attempts` and `placement_settings` in `app_learning` (migration
`apps/learning-service/src/database/migrations/1730000000000-create-placement.js`).
`placement_attempts.accountId` and `placementVersionId` hold ids of other
services' rows without a foreign key.

## F04 lesson-flow schema

`learning-service` adds `lesson_progress` and `lesson_test_attempts` to
`app_learning` (migration `1730000001000-create-lesson-flow.js`). `accountId`,
`lessonId` and `lessonVersionId` hold ids of other services' rows without a
foreign key; `accountEmail` is a copy taken when the attempt starts.

## Unit review schema (D121)

`content-service` adds `unit_review_versions` and `units.reviewVersionId` to
`app_content` (migration `1720000011000-create-unit-reviews.js`).
`learning-service` adds `unit_review_attempts` to `app_learning` (migration
`1730000010000-create-unit-review-attempts.js`); `accountId`, `unitId` and
`reviewVersionId` hold ids of other services' rows without a foreign key.

## F05A mock-test schema

`content-service` adds `mock_tests` and `mock_test_versions` to `app_content`
(migration `1720000003000-create-mock-tests.js`). `learning-service` adds
`mock_attempts` and `score_conversion` to `app_learning` (migration
`1730000002000-create-mock-attempts.js`).

## F05C Listening course schema

`content-service` adds `listening_course_items` and `listening_course_versions`
to `app_content` (migration `1720000008000-create-listening-course.js`).
Migration `1720000009000-listening-course-placement.js` lets an item of type
`placement` have no level (D103). `learning-service` adds
`course_lesson_results` and `course_test_results` to `app_learning`
(migrations `1730000005000-create-course-lesson-results.js`,
`1730000006000-create-course-test-results.js`); `unitId`, `lessonId`,
`itemId` and `versionId` are content-service ids without a foreign key.
`course_placements` and `course_mistakes` (migrations `1730000007000`,
`1730000008000`) were dropped by `1730000011000-drop-course-placements-and-mistakes.js`
(D146): the course has no placement and no mistakes notebook (D145).
D147: course items hold their own recordings in their versions' content.
`listening_timing_jobs` (content-service) gets `courseItemId` (foreign key to
`listening_course_items`, deleted with it), `exerciseId` becomes nullable, and
a CHECK keeps exactly one of the two (migration
`1720000013000-course-own-recordings.js`, which also moves existing course
contents to the new shape).

## F06 progress schema

`progress-service` adds `skill_results` and `lesson_completions` to
`app_progress` (migration
`apps/progress-service/src/database/migrations/1740000000000-create-progress.js`):
one row per finished lesson-test or full mock-test attempt with its per-skill
counts (the row id is the attempt id in learning-service), and one row per
completed lesson. F07 adds `xp_ledger` (migration `1740000001000-create-xp-ledger.js`):
one row per learner and mock test with the XP of the first full attempt and
snapshots of the email and the test title. `learning-service` adds the outbox `learning_events` to
`app_learning` (migration `1730000009000-create-learning-events.js`): each
result is written there with the attempt and relayed to RabbitMQ afterwards
(D110). `accountId`, `lessonId` and `sourceId` are other services' ids without
a foreign key; progress-service reads the published curriculum from
content-service over gRPC and never another database.
