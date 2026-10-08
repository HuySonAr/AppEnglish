# Prompt F00 — khảo sát codebase

~~~text
Đọc AGENTS.md, README, product scope, decisions và technology/architecture docs. Khảo sát repository: pnpm/Turbo workspace, apps/services, NestJS, React/Vite, gRPC/proto, RabbitMQ, Redis, TypeORM, PostgreSQL mapping, schema, tests, scripts.

Mapping mục tiêu PostgreSQL: auth-service → app_identity; content-service → app_content; learning-service → app_learning; progress-service → app_progress; api-gateway và web client không có DB. Kiểm tra code/migrations thực tế trước khi thay đổi; phát hiện payment-service hoặc service khác thì ghi nhận, không tự xóa hoặc gán database.

Người dùng muốn chạy local không dùng Docker và quản lý PostgreSQL qua pgAdmin/DBeaver. Xác minh lệnh cài/chạy theo repo, DB ports, connection env key names (không lấy/hiển thị secret), RabbitMQ Windows/local và Redis qua WSL2 hoặc cấu hình dự án. Không giả định lệnh/versions. Chỉ khảo sát và cập nhật docs, không sửa source code.

Gắn VERIFIED/INFERRED/TBD và ghi đường dẫn bằng chứng. Cập nhật service specs, development.md, feature-status F00. Báo mâu thuẫn/TBD; không đổi nghiệp vụ hoặc xóa dữ liệu.
~~~
