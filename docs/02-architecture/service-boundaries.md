# Service boundaries

F00 đã tạo năm backend apps trong `apps/*` và một web client. Bảng dưới chỉ mô tả
scaffold/ownership đã chốt; domain contracts chưa triển khai.

| Service thật | Trách nhiệm hiện tại | Nghiệp vụ Reading/Listening liên quan | DB owner | gRPC/API/event | Bằng chứng |
|---|---|---|---|---|---|
| api-gateway | Stateless public HTTP entrypoint; health only | Gateway/BFF | Không có | HTTP health; gRPC/RabbitMQ TBD | `apps/api-gateway/package.json`, `src/health/*` |
| auth-service | Auth boundary scaffold; health only | Account/auth (F01) | app_identity | gRPC/RabbitMQ TBD | `apps/auth-service/src/database/database.config.js` |
| content-service | Content boundary scaffold; health only | Unit/lesson/content (F02) | app_content | gRPC/RabbitMQ TBD | `apps/content-service/src/database/database.config.js` |
| learning-service | Learning boundary scaffold; health only | Attempts/placement/tests (F03–F05) | app_learning | gRPC/RabbitMQ TBD | `apps/learning-service/src/database/database.config.js` |
| progress-service | Progress boundary scaffold; health only | Progress/XP (F06–F07) | app_progress | gRPC/RabbitMQ TBD | `apps/progress-service/src/database/database.config.js` |
| web-client | React/Vite public client scaffold | Reading/Listening UI later | Không có | HTTP to gateway | `apps/web-client/src/lib/api/http-client.js` |

## F00 inventory result

**VERIFIED (2026-10-08):** đúng sáu app cần tạo đã tồn tại. Không tạo payment,
teacher, class, assignment hoặc domain ngoài phạm vi. F00 chỉ có health endpoint;
không có business module hay cross-service database access.

**TBD:** gRPC proto, RabbitMQ event topology, Redis cache policy và domain
repositories sẽ được chốt ở feature tương ứng.

Không tạo service mới chỉ để khớp domain tài liệu. Không xóa payment-service hoặc service khác nếu chưa truy dependency và có quyết định.
