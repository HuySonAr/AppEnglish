# Service boundaries

F00 đã tạo năm backend apps trong `apps/*` và một web client. Bảng dưới mô tả
hiện trạng đã xác minh từ code ngày 2026-10-10, progress cập nhật 2026-10-17 (F06).

| Service thật | Trách nhiệm hiện tại | Nghiệp vụ Reading/Listening liên quan | DB owner | gRPC/API/event | Bằng chứng |
|---|---|---|---|---|---|
| api-gateway | Stateless public HTTP entrypoint; health/readiness, relay `/auth/*`, `/content/*`, `/placement/*`, `/learning/*`, `/mock-tests/*` và `/progress` | Gateway/BFF | Không có | HTTP public; gRPC client tới auth-service (D27), content-service (D42), learning-service (D58) và progress-service (F06); không dùng RabbitMQ | `apps/api-gateway/src/auth/auth-gateway.controller.js`, `src/health/*` |
| auth-service | Account/auth và admin account management (F01, F01B) | Account/auth | app_identity | gRPC `appenglish.auth.v1.AuthService`; HTTP health only; RabbitMQ TBD | `packages/auth-contracts/proto/auth.proto`, `apps/auth-service/src/auth/*`, `src/database/migrations/*` |
| content-service | Unit, lesson, lesson version, media upload (F02), media-storage provider (F02A), đề placement (F03), đề mock (F05A) và bài luyện nghe cùng chủ đề (F05B-2, D85) | Unit/lesson/content, đề placement | app_content | gRPC `appenglish.content.v1.ContentService`; HTTP health only; RabbitMQ TBD | `packages/content-contracts/proto/content.proto`, `apps/content-service/src/content/*`, `src/database/migrations/*` |
| learning-service | Lượt làm placement, chấm điểm, unit bắt đầu, ngưỡng (F03); luồng lesson, lesson test và bảng xếp hạng theo lesson (F04); full mock, mini test, điểm ước tính và gợi ý mức (F05A); practice (F05B) | Attempts/placement/tests (F03–F05) | app_learning | gRPC `appenglish.learning.v1.LearningService`; gRPC client tới content-service (`GetPlacementPaper`, `GetCurriculum`, `GetLessonPaper`…); HTTP health only; RabbitMQ producer `learning.results` qua outbox `learning_events` (F06, D110) | `packages/learning-contracts/proto/learning.proto`, `apps/learning-service/src/placement/*`, `src/events/*`, `src/database/migrations/*` |
| speech-service | Auto-time (D97): tìm thời gian từng dòng của bài nghe bằng faster-whisper | Listening content (công cụ cho Content Manager) | Không có DB | RabbitMQ `speech.autotime.requests` → `speech.autotime.results`; không HTTP/gRPC | `apps/speech-service/`, `docs/03-service-specs/speech-service.md` |
| progress-service | Progress (F06, D33): mức hoàn thành lesson và mức thành thạo Reading/Listening từ lesson test và full mock; XP từ lượt full đầu của mock và bảng xếp hạng XP (F07, D63, D112) | Progress/XP (F06–F07) | app_progress | gRPC `appenglish.progress.v1.ProgressService` (`GetProgress`, `GetXp`, `GetLeaderboard`); RabbitMQ consumer `learning.results`; gRPC client tới content-service (`GetCurriculum`); HTTP health only | `packages/progress-contracts/proto/progress.proto`, `apps/progress-service/src/progress/*`, `src/events/results.consumer.js`, `src/database/migrations/*` |
| web-client | React/Vite public client scaffold | Reading/Listening UI later | Không có | HTTP to gateway | `apps/web-client/src/lib/api/http-client.js` |

## F00 inventory result

**VERIFIED (2026-10-08):** đúng sáu app cần tạo đã tồn tại. Không tạo payment,
teacher, class, assignment hoặc domain ngoài phạm vi. F00 chỉ có health endpoint;
không có business module hay cross-service database access.

**TBD:** gRPC proto, RabbitMQ event topology, Redis cache policy và domain
repositories sẽ được chốt ở feature tương ứng.

Không tạo service mới chỉ để khớp domain tài liệu. Repository không có payment-service; không xóa service hiện hữu nếu chưa truy dependency và có quyết định.
