# Công nghệ và kiến trúc AppEnglish

## Stack mục tiêu đã được xác định cho dự án
| Lớp | Công nghệ/quyết định | Chỉ dẫn cho AI |
|---|---|---|
| Monorepo/package manager | pnpm workspaces | Dùng pnpm, không dùng npm/yarn để quản lý workspace |
| Build/task orchestration | Turborepo v1 | Dùng task graph/scripts có sẵn; không thay bằng công cụ khác |
| Backend | 6 NestJS services trong apps/* | Mục tiêu; chưa xác minh vì repository hiện chưa có `apps/*` |
| Web client | React + Vite, JavaScript/JSX | Không dùng Next.js; dùng cấu trúc feature-first trong frontend-architecture.md |
| Shared code | packages/* | Mục tiêu; chưa xác minh vì chưa có `packages/*` |
| UI styling/components/icons | Tailwind CSS, shadcn/ui, lucide-react | Dùng cho web client; giữ component source trong repo và theo cấu hình Vite hiện có |
| Public entrypoint/BFF | Gateway/BFF | Web client gọi public entrypoint; không gọi trực tiếp private service |
| Synchronous service communication | gRPC | Tôn trọng proto/contracts hiện hữu; không tự chuyển sang REST giữa services |
| Asynchronous messaging | RabbitMQ | Dùng event/message cho luồng async theo patterns hiện có |
| Cache/short-lived infrastructure | Redis | Dùng theo cấu hình/purpose đang có; không coi Redis là source of truth nghiệp vụ |
| Data ownership | PostgreSQL database-per-service | Mapping xem database-allocation.md; không query DB service khác trực tiếp |
| ORM | TypeORM (theo tài liệu kiến trúc AppEnglish) | Xác minh package/migration hiện tại; không thêm Prisma song song |
| Local database UI | pgAdmin 4 hoặc DBeaver | Kết nối vào PostgreSQL Server local; GUI không tự thay thế server |
| Local runtime | PostgreSQL native Windows; Redis + RabbitMQ trong Docker Compose; apps chạy local qua pnpm | Quyết định local mục tiêu; chưa có Compose/script để xác minh |

## F00 — bằng chứng repository

**VERIFIED:** [README.md](../../README.md), `AGENTS.md` và thư mục `docs/` là các
file duy nhất hiện có trong repository tại thời điểm khảo sát 2026-10-08.

**NOT VERIFIED / TBD:** không tìm thấy `package.json`, `pnpm-workspace.yaml`,
`pnpm-lock.yaml`, `turbo.json`, `apps/`, `packages/`, `Dockerfile`, Docker Compose,
`.env.example`, `*.proto`, cấu hình NestJS/TypeORM/Vite, migration, test hoặc
script. Do đó chưa thể xác minh pnpm 9.0.0, Node/Turbo/NestJS/React/Vite/
Tailwind/gRPC/RabbitMQ/Redis versions, service names, package scripts, ports,
connection keys, ORM usage hoặc migration paths. Không coi các chi tiết này là đã
cài đặt.

## Phiên bản và chi tiết cần xác minh
- pnpm được pin ở 9.0.0 theo project setup; kiểm tra package.json/packageManager và lockfile.
- Phiên bản Node.js, Turbo chính xác, NestJS, React/Vite, Tailwind, gRPC libraries, RabbitMQ/Redis versions: lấy từ package manifests, lockfile, Dockerfiles và compose.
- Danh sách đủ sáu service: lấy từ apps/* và workspace config. README có thể thiếu payment-service; không kết luận service không tồn tại chỉ vì README không liệt kê.
- Database/service mapping mục tiêu: app_identity, app_content, app_learning, app_progress (xem database-allocation.md); xác minh code trước khi migrate. TypeORM theo tài liệu kiến trúc hiện tại.
- Test/lint/format tools: kiểm tra package scripts và config.
- Không ghi secrets hoặc giá trị env nhạy cảm vào tài liệu.

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
