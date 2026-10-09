# Local development: PostgreSQL native, Redis/RabbitMQ Docker

## Quyết định
- Không chạy PostgreSQL trong Docker. Cài và chạy PostgreSQL Server trực tiếp trên Windows để quản lý bằng pgAdmin/DBeaver.
- Redis và RabbitMQ chạy bằng Docker Compose.
- Backend services và React/Vite client chạy trực tiếp trên máy bằng pnpm/Turborepo.
- Docker chỉ khởi chạy Redis và RabbitMQ; không khởi chạy database.
- GUI quản lý database không thay thế PostgreSQL Server.

## Thành phần
| Thành phần | Cách chạy | Ghi chú |
|---|---|---|
| PostgreSQL Server | Cài local trên Windows, chạy Windows service | Host bốn database: app_identity, app_content, app_learning, app_progress |
| pgAdmin 4 hoặc DBeaver | Desktop app kết nối PostgreSQL local | Dùng xem schema, query và quản lý dữ liệu |
| Redis | Docker Compose | Cache/ephemeral workflow theo code |
| RabbitMQ | Docker Compose | Async messages/events |
| NestJS services/API Gateway | Chạy trực tiếp qua pnpm/Turbo | Dùng env local |
| React + Vite client | Chạy trực tiếp qua pnpm workspace | Gọi Gateway qua HTTP |

## Trình tự khởi chạy (mục tiêu sau khi có source/config)
1. Khởi động Windows service PostgreSQL.
2. Xác nhận bốn database đã được tạo và chạy migration auth:
   `pnpm --filter @appenglish/auth-service migration:run`.
3. Khởi động riêng các container Redis và RabbitMQ bằng Compose.
4. Chạy các NestJS services và API Gateway cần cho feature.
5. Chạy web client React/Vite.

## F01 PowerShell

```powershell
pnpm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Điền POSTGRES_PASSWORD trong .env; không commit .env.
pnpm --filter @appenglish/auth-service migration:run
docker compose up -d redis rabbitmq
pnpm dev
```

Open `http://localhost:5173/auth`; the public API is
`http://localhost:3000` and readiness is `http://localhost:3000/health/ready`.
Vite proxies `/auth` and `/health` to the gateway, keeping browser requests
same-origin in development.

## Media storage (F02A)

Development and tests default to `MEDIA_STORAGE_ADAPTER=local`. Set
`MEDIA_LOCAL_ROOT` to a directory outside build output; the repository default
`storage/media` is ignored except for `.gitkeep`. F02A has no upload route, so
this adapter is only a service-level dependency for later content modules.

To use ImageKit in a deployed backend, set `MEDIA_STORAGE_ADAPTER=imagekit`,
`IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, and `IMAGEKIT_URL_ENDPOINT` in a
runtime secret store. Never put the private key in the web client or any
`VITE_*` variable. Tests inject a fake SDK client and do not call ImageKit.

The current official Node SDK/upload documentation was checked for the
server-side integration. Protected audio delivery is intentionally not claimed
until ImageKit's current private-file/signed-URL documentation is verified.

## Docker Compose
Dùng file Compose và service names có sẵn trong repository. Chỉ khởi chạy Redis và RabbitMQ; không dùng lệnh compose khởi chạy PostgreSQL. Trước khi chạy, kiểm tra compose config để chắc chắn service/volume/port mappings không kéo theo database container.

Có thể dùng lệnh theo mẫu sau sau khi đã xác minh service names:
- Khởi động: docker compose up -d <redis-service> <rabbitmq-service>
- Trạng thái: docker compose ps
- Log: docker compose logs -f <redis-service> <rabbitmq-service>
- Dừng broker: docker compose stop <redis-service> <rabbitmq-service>

Không chạy docker compose down -v hoặc reset volumes trong quy trình thường ngày.

## F00 verification result

**VERIFIED (2026-10-08):** `pnpm install`, `pnpm build`, `pnpm lint` và
`pnpm test` thành công. `docker compose up -d redis rabbitmq` thành công; cả hai
container healthy. `GET http://localhost:3000/health` trả về status `ok`.
`pg_isready -h localhost -p 5432` trả `accepting connections`.

CLI query database bị dừng vì cần mật khẩu PostgreSQL local; không ghi mật khẩu
vào repository. Xác nhận database qua pgAdmin/DBeaver hoặc chạy script với
credential local của người dùng.

## PostgreSQL local
- Một PostgreSQL Server có thể host bốn logical databases riêng.
- pgAdmin/DBeaver kết nối bằng host, port, username/password của PostgreSQL local.
- Mỗi service có connection string riêng trỏ đúng database trong docs/02-architecture/database-allocation.md.
- Không để Gateway hoặc browser client kết nối PostgreSQL trực tiếp.

## Versions và commands
Không giả định phiên bản/port/lệnh chưa kiểm tra. Xác minh package scripts, .env.example, Compose, migrations và PostgreSQL service hiện có; ghi chính xác commands đã thử thành công. Không ghi giá trị secret vào tài liệu.

## An toàn dữ liệu
- PostgreSQL native data và Docker broker volumes là hai vùng dữ liệu độc lập.
- Không xóa hoặc reset PostgreSQL data khi dừng broker containers.
- Mọi lệnh reset phải nêu rõ database/volume sẽ bị xóa và yêu cầu xác nhận trước khi chạy lệnh phá hủy.
