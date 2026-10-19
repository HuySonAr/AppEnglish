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
# Điền SMTP_HOST/SMTP_FROM và SMTP credentials nếu cần gửi OTP thật.
pnpm --filter @appenglish/auth-service migration:run
pnpm --filter @appenglish/content-service migration:run
pnpm --filter @appenglish/learning-service migration:run
pnpm --filter @appenglish/progress-service migration:run
docker compose up -d redis rabbitmq
pnpm dev
```

Open `http://localhost:5173/login`; the public API is
`http://localhost:3000` and readiness is `http://localhost:3000/health/ready`.
The gateway reaches auth-service over gRPC at `AUTH_GRPC_HOST`:`AUTH_GRPC_PORT`
(default `localhost:50051`; no `.env` change is needed for the default). Until
that port is listening the gateway answers `/auth/*` and readiness with 503.
content-service serves gRPC at `CONTENT_GRPC_HOST`:`CONTENT_GRPC_PORT` (default
`localhost:50052`) and now loads `.env` like auth-service; restart `pnpm dev`
after pulling F02 so it picks up the new start command.
Vite proxies `/auth` and `/health` to the gateway, keeping browser requests
same-origin in development.

## Media storage (F02A)

Development and tests default to `MEDIA_STORAGE_ADAPTER=local`. Set
`MEDIA_LOCAL_ROOT` to a directory outside build output; the repository default
`storage/media` is ignored except for `.gitkeep`. F02A has no upload route, so
this adapter is only a service-level dependency for later content modules.

### Cloudflare R2 (D67)

Set `MEDIA_STORAGE_ADAPTER=r2` and fill `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET` and `R2_PUBLIC_BASE_URL` (the bucket's
public address, e.g. its `r2.dev` URL or a custom domain, without a path). The
API token needs read and write access to objects of that bucket; the bucket
needs public access enabled so learners can play the files. All five values
are required or content-service does not start. To move the files already on
ImageKit, keep the ImageKit keys in place and run once:

```powershell
pnpm --filter @appenglish/content-service media:migrate-to-r2
```

It copies each ImageKit file to R2 under the same folder, updates its
`media_assets` row and then deletes the ImageKit copy; files that cannot be
copied exactly are left alone and listed.

### ImageKit

To upload to ImageKit (also possible locally), set `MEDIA_STORAGE_ADAPTER=imagekit`,
`IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, and `IMAGEKIT_URL_ENDPOINT` in a
runtime secret store. Never put the private key in the web client or any
`VITE_*` variable. Tests inject a fake SDK client and do not call ImageKit.

The current official Node SDK/upload documentation was checked for the
server-side integration. Protected audio delivery is intentionally not claimed
until ImageKit's current private-file/signed-URL documentation is verified.

## Health endpoints

`GET /health` (gateway alive), `GET /health/ready` (gateway + auth-service +
its database) and `GET /health/services` (every backend service, for the
admin dashboard, D115) are served by the gateway on `GATEWAY_PORT`. The
services probe reaches content-, learning- and progress-service on their
`*_SERVICE_PORT` HTTP ports, so those ports must match `.env` on the machine
that runs the gateway.

## Avatars (F09, D113)

Profile pictures are handled by auth-service, apart from the content media.
Development defaults to `AVATAR_STORAGE_ADAPTER=local`: files go under
`AVATAR_LOCAL_ROOT` (`storage/avatars`, ignored by git) and auth-service serves
them at `AVATAR_LOCAL_PUBLIC_URL` (`http://localhost:3001/avatars`). Set
`AVATAR_STORAGE_ADAPTER=imagekit` with the `IMAGEKIT_*` keys to store them on
ImageKit under `/appenglish/avatar` (D68). `AVATAR_MAX_FILE_SIZE_BYTES`
(default 2 MB) is the backend limit; the web client crops and shrinks the
picture to 256px before uploading. Run the auth migrations once after pulling
this feature:

```powershell
pnpm --filter @appenglish/auth-service migration:run
```

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

## learning-service (F03)

learning-service serves gRPC at `LEARNING_GRPC_HOST`:`LEARNING_GRPC_PORT`
(default `localhost:50053`), loads `.env`, and calls content-service over gRPC.
Add the two `LEARNING_GRPC_*` variables to `.env` only to change the default.
Restart `pnpm dev` after pulling F03 so the gateway and learning-service start
with the new contract. The Vite dev server proxies `/placement` to the gateway.

## speech-service (Auto-time, D97)

1. Python 3.12 on the PATH; ffmpeg is not needed (faster-whisper reads audio
   with PyAV).
2. `pnpm --filter @appenglish/speech-service python:setup` creates
   `apps/speech-service/.venv` and installs `requirements.txt`.
3. RabbitMQ must run (`pnpm compose:up`); content-service reconnects to it by
   itself.
4. `pnpm --filter @appenglish/speech-service dev` (or `pnpm dev`) starts the
   worker. The first request downloads the Whisper model (`WHISPER_MODEL`,
   default `small.en`, about 480 MB).
5. Optional `.env`: `WHISPER_MODEL`, `WHISPER_DEVICE`, `WHISPER_COMPUTE_TYPE`,
   `WHISPER_VAD_FILTER` (see `docs/03-service-specs/speech-service.md`).

On Windows, Hugging Face warns that it cannot use symlinks for its cache
without Developer Mode; the model still downloads and works.
speech-service keeps the words it heard in `apps/speech-service/.cache/words`
(ignored by git, D99). After a change to its code, restart the worker: Python
does not reload by itself, and an old worker still running takes jobs in turn
with the new one.

## Nội dung demo của Listening course (D105)

`content-samples/listening-course/` có 30 bản ghi A1–C1 và 125 câu hỏi (xem
README trong thư mục). Khi content-service đang chạy, nhập bằng:

```
pnpm --filter @appenglish/content-service seed:listening-course -- --manager-id <id tài khoản Content Manager>
```

Script tải 30 file MP3 lên kho media trong `.env` và xuất bản thư viện nghe,
các unit, Level test và Listening placement; chạy lại không tạo trùng.

