# Công nghệ và kiến trúc AppEnglish

## Stack đã khởi tạo và được xác minh
| Lớp | Công nghệ/quyết định | Chỉ dẫn cho AI |
|---|---|---|
| Monorepo/package manager | pnpm workspaces, manifest pin `pnpm@9.0.0` | Workspace được xác minh; máy hiện chạy pnpm 11, không tự thay công cụ hệ thống |
| Build/task orchestration | Turborepo `1.13.4` | Được pin trong root manifest/lockfile |
| Backend | 4 NestJS services + api-gateway trong apps/* | JavaScript/ESM skeleton; lockfile resolves NestJS `11.2.7` |
| Web client | React `19.3.0` + Vite `7.3.7`, JavaScript/JSX | Đã tạo; không dùng Next.js |
| Shared code | `packages/config`, `packages/backend-common` | Đã tạo |
| UI styling/components/icons/charts | Tailwind CSS, shadcn/ui, lucide-react; biểu đồ dùng shadcn chart (Recharts `2.15.4`, D78) | Dùng cho web client; giữ component source trong repo và theo cấu hình Vite hiện có |
| Public entrypoint/BFF | Gateway/BFF | Web client gọi public entrypoint; không gọi trực tiếp private service |
| Synchronous service communication | gRPC | Tôn trọng proto/contracts hiện hữu; không tự chuyển sang REST giữa services |
| Asynchronous messaging | RabbitMQ | Dùng event/message cho luồng async theo patterns hiện có. Đang dùng cho Auto-time (D97): hàng đợi `speech.autotime.requests`/`speech.autotime.results`, content-service dùng `amqplib`, speech-service dùng `pika` |
| Speech (D97) | Python 3.12, faster-whisper 1.1.1 (+ av 13.1.0), pika 1.3.2, requests | Chỉ trong `apps/speech-service` (worker, không HTTP/gRPC/DB); `.venv` riêng, chạy qua `run.mjs` |
| Cache/short-lived infrastructure | Redis | Dùng theo cấu hình/purpose đang có; không coi Redis là source of truth nghiệp vụ |
| Data ownership | PostgreSQL database-per-service | Mapping xem database-allocation.md; không query DB service khác trực tiếp |
| ORM | TypeORM `0.3.31` + PostgreSQL `pg` | DataSource/EntitySchema và F01 account migration đã tạo |
| Local database UI | pgAdmin 4 hoặc DBeaver | Kết nối vào PostgreSQL Server local; GUI không tự thay thế server |
| Media storage | Cloudflare R2 through `@aws-sdk/client-s3` (D67), `@imagekit/nodejs@7.12.1` official Node SDK, local adapter | F02A; backend-only ImageKit credentials; local adapter is default for development/tests |
| Local runtime | PostgreSQL native Windows; Redis `7-alpine` + RabbitMQ `3-management-alpine` trong Compose | Đã xác minh Compose không có PostgreSQL |

## F00 — bằng chứng repository

**VERIFIED:** root manifests, six app directories, two shared packages,
`docker-compose.yml`, `.env.example` và PostgreSQL script đã được tạo và install
thành công. Lockfile resolves NestJS `11.2.7`, TypeORM `0.3.31`, React `19.3.0`,
Vite `7.3.7`, Tailwind `3.4.19`, gRPC `1.14.6`, amqplib `0.10.9`, ioredis
`5.11.1`, and pg `8.23.1`. gRPC/RabbitMQ/Redis client dependencies are present
in service manifests.

The repository pins pnpm `9.0.0`; the validation host currently reports pnpm
`11.23.0`. The install succeeded with that host version and generated a
lockfile v9. Use Corepack or another project-approved pnpm 9 setup before
enforcing the exact package-manager version in CI.

**TBD:** proto/RPC contracts, RabbitMQ exchanges/queues, Redis usage, domain
entities and migrations are intentionally not implemented in F00.

## Dự kiến cho hiệu ứng giao diện (chưa áp dụng)
Ghi ngày 2026-10-24 theo yêu cầu người dùng; chưa cài, chưa có code dùng. Hiện tại hiệu ứng chỉ dùng CSS `@keyframes` trong `apps/web-client/src/styles/index.css` (trang đăng nhập, tắt khi `prefers-reduced-motion`).

| Thư viện | Ghi chú khi áp dụng |
|---|---|
| anime.js | Hiệu ứng theo dòng thời gian, SVG, đếm số |
| Framer Motion | Nay phát hành dưới tên gói `motion` (`motion/react`); hiệu ứng vào/ra, chuyển trang, kéo thả trong React |
| MicroKit UI (https://microkit.co/) | Bộ microinteraction React + CSS/Tailwind dạng copy-paste, giấy phép MIT, không phải gói npm; một số component thêm được qua shadcn CLI (`npx shadcn@latest add @microkit/<tên>`). Chọn bản JavaScript + Tailwind (chạy được với Tailwind v3 của repo); icon dùng lucide-react đã có. Code chép vào phải bỏ comment (D149) và bỏ hiệu ứng chuyển màu/phát sáng mờ trang trí (D153); đặt trong `src/components/shared` |

Khi áp dụng: ghi quyết định vào decisions.md, chốt phiên bản cụ thể, tôn trọng `prefers-reduced-motion`, không dùng nền chuyển màu hay đốm mờ (D153), và tránh dùng hai thư viện cho cùng một loại hiệu ứng.

## Phiên bản và chi tiết cần xác minh
- pnpm được pin ở 9.0.0 theo project setup; kiểm tra package.json/packageManager và lockfile.
- Phiên bản Node.js, Turbo chính xác, NestJS, React/Vite, Tailwind, gRPC libraries, RabbitMQ/Redis versions: lấy từ package manifests, lockfile, Dockerfiles và compose.
- Danh sách app: lấy từ apps/* và workspace config. Đã xác minh 2026-10-10: sáu app gồm năm backend (api-gateway, auth-service, content-service, learning-service, progress-service) và web-client; repository không có payment-service.
- Database/service mapping mục tiêu: app_identity, app_content, app_learning, app_progress (xem database-allocation.md); xác minh code trước khi migrate. TypeORM theo tài liệu kiến trúc hiện tại.
- Test/lint/format tools: kiểm tra package scripts và config.
- Không ghi secrets hoặc giá trị env nhạy cảm vào tài liệu.

## F02A media storage

`content-service` owns the `MediaStorage` provider and selects `local` or
`imagekit` via `MEDIA_STORAGE_ADAPTER`. Local/test runs do not call ImageKit.
The adapter validates MP3/MP4 audio and JPEG/PNG/WebP image inputs before upload.
F02A intentionally has no media database model or upload API.

## Quy tắc giao tiếp
1. Browser/client đi qua public BFF/Gateway; private services không phơi trực tiếp ra client.
2. Synchronous service-to-service dùng gRPC contracts đã có.
3. Asynchronous domain events dùng RabbitMQ theo exchange/queue conventions đã có.
4. Không truy cập database của service khác; trao đổi qua API/event.
5. Redis phục vụ cache/ephemeral coordination theo code hiện tại; dữ liệu nghiệp vụ chuẩn thuộc DB service owner.

## Hiện trạng giao tiếp (xác minh 2026-10-10)

- Gateway gọi auth-service qua gRPC (D27): proto ở
  `packages/auth-contracts/proto/auth.proto`, client đăng ký bằng `ClientsModule`
  trong `apps/api-gateway/src/app.module.js`, server là
  `apps/auth-service/src/auth/auth.grpc.controller.js`. Proto được nạp lúc chạy
  bằng `@grpc/proto-loader@0.8.x`; không có bước sinh code.
- auth-service là hybrid app: gRPC cho contract auth, HTTP chỉ còn `/health` và
  `/health/ready`.
- RabbitMQ exchange/queue và Redis client chưa được dùng trong `apps/*/src`; chỉ
  có dependency trong manifest và helper cấu hình ở
  `packages/backend-common/src/infrastructure.js`. learning/progress chưa có
  proto.
- Gateway gọi content-service qua gRPC (D42): proto ở
  `packages/content-contracts/proto/content.proto`; gateway xác thực phiên qua
  auth-service rồi chuyển actor sang content-service.

## Checks hiện có

- Backend apps và shared packages: `lint` chạy `scripts/check-syntax.mjs` (gọi
  `node --check` cho mọi file `.js` trong `src` và `test`); `build` vẫn là
  `node --check` trên entry file. Đây là kiểm tra cú pháp, không phải linter.
- web-client: `lint` và `build` đều là `vite build`.
- Test dùng `node --test`; api-gateway, learning-service và progress-service chưa
  có test riêng (script `test` chỉ kiểm tra cú pháp entry file).

## Quy tắc triển khai theo nghiệp vụ mới
- Đọc service map trước khi quyết định feature thuộc service nào.
- Tái sử dụng services/contracts hiện có khi phù hợp; không tạo service chỉ vì tài liệu có một domain.
- Không xóa service hiện hữu tự động (repository hiện không có payment-service). Xác minh chức năng, dependencies và yêu cầu người dùng trước khi loại bỏ hoặc tái sử dụng.
- Reading/Listening là phạm vi sản phẩm, nhưng codebase có thể còn service cũ ngoài phạm vi. Ghi rõ giữ, migrate, deprecate hay bỏ chỉ sau khi phân tích dependencies và có quyết định.

Redis (Docker Compose) is used by the api-gateway rate limiter (D117) through `ioredis@^5.8.1`; no other service uses it yet.
