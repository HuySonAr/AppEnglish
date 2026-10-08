# Công nghệ và kiến trúc AppEnglish

## Stack đã khởi tạo và được xác minh
| Lớp | Công nghệ/quyết định | Chỉ dẫn cho AI |
|---|---|---|
| Monorepo/package manager | pnpm workspaces, manifest pin `pnpm@9.0.0` | Workspace được xác minh; máy hiện chạy pnpm 11, không tự thay công cụ hệ thống |
| Build/task orchestration | Turborepo `1.13.4` | Được pin trong root manifest/lockfile |
| Backend | 4 NestJS services + api-gateway trong apps/* | JavaScript/ESM skeleton; lockfile resolves NestJS `11.2.7` |
| Web client | React `19.3.0` + Vite `7.3.7`, JavaScript/JSX | Đã tạo; không dùng Next.js |
| Shared code | `packages/config`, `packages/backend-common` | Đã tạo |
| UI styling/components/icons | Tailwind CSS, shadcn/ui, lucide-react | Dùng cho web client; giữ component source trong repo và theo cấu hình Vite hiện có |
| Public entrypoint/BFF | Gateway/BFF | Web client gọi public entrypoint; không gọi trực tiếp private service |
| Synchronous service communication | gRPC | Tôn trọng proto/contracts hiện hữu; không tự chuyển sang REST giữa services |
| Asynchronous messaging | RabbitMQ | Dùng event/message cho luồng async theo patterns hiện có |
| Cache/short-lived infrastructure | Redis | Dùng theo cấu hình/purpose đang có; không coi Redis là source of truth nghiệp vụ |
| Data ownership | PostgreSQL database-per-service | Mapping xem database-allocation.md; không query DB service khác trực tiếp |
| ORM | TypeORM `0.3.31` + PostgreSQL `pg` | DataSource/EntitySchema và F01 account migration đã tạo |
| Local database UI | pgAdmin 4 hoặc DBeaver | Kết nối vào PostgreSQL Server local; GUI không tự thay thế server |
| Media storage | `@imagekit/nodejs@7.12.1` official Node SDK + local adapter | F02A; backend-only ImageKit credentials; local adapter is default for development/tests |
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

## Phiên bản và chi tiết cần xác minh
- pnpm được pin ở 9.0.0 theo project setup; kiểm tra package.json/packageManager và lockfile.
- Phiên bản Node.js, Turbo chính xác, NestJS, React/Vite, Tailwind, gRPC libraries, RabbitMQ/Redis versions: lấy từ package manifests, lockfile, Dockerfiles và compose.
- Danh sách đủ sáu service: lấy từ apps/* và workspace config. README có thể thiếu payment-service; không kết luận service không tồn tại chỉ vì README không liệt kê.
- Database/service mapping mục tiêu: app_identity, app_content, app_learning, app_progress (xem database-allocation.md); xác minh code trước khi migrate. TypeORM theo tài liệu kiến trúc hiện tại.
- Test/lint/format tools: kiểm tra package scripts và config.
- Không ghi secrets hoặc giá trị env nhạy cảm vào tài liệu.

## F02A media storage

`content-service` owns the `MediaStorage` provider and selects `local` or
`imagekit` via `MEDIA_STORAGE_ADAPTER`. Local/test runs do not call ImageKit.
The adapter validates MP3 audio and JPEG/PNG/WebP image inputs before upload.
F02A intentionally has no media database model or upload API.

## Quy tắc giao tiếp
1. Browser/client đi qua public BFF/Gateway; private services không phơi trực tiếp ra client.
2. Synchronous service-to-service dùng gRPC contracts đã có.
3. Asynchronous domain events dùng RabbitMQ theo exchange/queue conventions đã có.
4. Không truy cập database của service khác; trao đổi qua API/event.
5. Redis phục vụ cache/ephemeral coordination theo code hiện tại; dữ liệu nghiệp vụ chuẩn thuộc DB service owner.

## Quy tắc triển khai theo nghiệp vụ mới
- Đọc service map trước khi quyết định feature thuộc service nào.
- Tái sử dụng services/contracts hiện có khi phù hợp; không tạo service chỉ vì tài liệu có một domain.
- Không xóa payment-service hoặc service hiện hữu tự động. Xác minh chức năng, dependencies và yêu cầu người dùng trước khi loại bỏ hoặc tái sử dụng.
- Reading/Listening là phạm vi sản phẩm, nhưng codebase có thể còn service cũ ngoài phạm vi. Ghi rõ giữ, migrate, deprecate hay bỏ chỉ sau khi phân tích dependencies và có quyết định.
