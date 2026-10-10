# Service boundaries

F00 đã tạo năm backend apps trong `apps/*` và một web client. Bảng dưới mô tả
hiện trạng đã xác minh từ code ngày 2026-10-10; learning/progress vẫn chỉ là
scaffold.

| Service thật | Trách nhiệm hiện tại | Nghiệp vụ Reading/Listening liên quan | DB owner | gRPC/API/event | Bằng chứng |
|---|---|---|---|---|---|
| api-gateway | Stateless public HTTP entrypoint; health/readiness và relay `/auth/*` | Gateway/BFF | Không có | HTTP public; gRPC client tới auth-service (D27); RabbitMQ TBD | `apps/api-gateway/src/auth/auth-gateway.controller.js`, `src/health/*` |
| auth-service | Account/auth và admin account management (F01, F01B) | Account/auth | app_identity | gRPC `appenglish.auth.v1.AuthService`; HTTP health only; RabbitMQ TBD | `packages/auth-contracts/proto/auth.proto`, `apps/auth-service/src/auth/*`, `src/database/migrations/*` |
| content-service | Health và media-storage provider (F02A); chưa có domain content | Unit/lesson/content (F02) | app_content | gRPC/RabbitMQ TBD | `apps/content-service/src/media/*`, `src/database/database.config.js` |
| learning-service | Learning boundary scaffold; health only | Attempts/placement/tests (F03–F05) | app_learning | gRPC/RabbitMQ TBD | `apps/learning-service/src/database/database.config.js` |
| progress-service | Progress boundary scaffold; health only | Progress/XP (F06–F07) | app_progress | gRPC/RabbitMQ TBD | `apps/progress-service/src/database/database.config.js` |
| web-client | React/Vite public client scaffold | Reading/Listening UI later | Không có | HTTP to gateway | `apps/web-client/src/lib/api/http-client.js` |

## F00 inventory result

**VERIFIED (2026-10-08):** đúng sáu app cần tạo đã tồn tại. Không tạo payment,
teacher, class, assignment hoặc domain ngoài phạm vi. F00 chỉ có health endpoint;
không có business module hay cross-service database access.

**TBD:** gRPC proto, RabbitMQ event topology, Redis cache policy và domain
repositories sẽ được chốt ở feature tương ứng.

Không tạo service mới chỉ để khớp domain tài liệu. Repository không có payment-service; không xóa service hiện hữu nếu chưa truy dependency và có quyết định.
