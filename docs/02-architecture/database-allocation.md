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
`apps/auth-service/src/database/*.entity.js`, four migrations under
`src/database/migrations/`). The append-only TypeORM migrations create
refresh-token family/revocation, OTP challenge and account audit data without
dropping existing tables. F01 does not access any other service
database.

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
