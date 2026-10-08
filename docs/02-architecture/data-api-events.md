# Data, API và events

## Quy ước kiến trúc
- Public web traffic qua BFF/API Gateway.
- Internal synchronous communication dùng gRPC/proto.
- Asynchronous domain messages dùng RabbitMQ.
- Mỗi service sở hữu database; không cross-service DB query.
- Redis không thay database nghiệp vụ chính.

## Inventory cần xác minh
| Domain | Service owner | Model/schema thật | gRPC proto/API | RabbitMQ event | Bằng chứng |
|---|---|---|---|---|---|
| User/Auth | auth-service | app_identity (PostgreSQL) | TBD | TBD | TBD |
| Content/lesson | content-service | app_content (PostgreSQL) | TBD | TBD | TBD |
| Placement/test attempt | learning-service | app_learning (PostgreSQL) | TBD | TBD | TBD |
| Progress/XP | progress-service | app_progress (PostgreSQL) | TBD | TBD | TBD |

Chỉ sửa/định nghĩa contract theo patterns và versions đang có. Không tự giả định tên RPC/event hoặc schema.

## F00 verification

**VERIFIED (2026-10-08):** không có source, `*.proto`, Compose, package manifest,
RabbitMQ configuration, Redis configuration, ORM entity hoặc migration trong
repository. Vì vậy toàn bộ bảng inventory ở trên vẫn là target/TBD; chưa có tên
RPC, exchange, queue, event, model hay API nào được xác minh.

Không ghi contract runtime mới trong F00 và không dùng các tên trong bảng làm
implementation contract.
