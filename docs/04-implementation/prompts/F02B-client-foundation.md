# Prompt F02B — React + Vite client foundation

~~~text
Đọc AGENTS.md, docs/02-architecture/technology-stack.md và frontend-architecture.md, business scope/workflows, sau đó kiểm tra monorepo hiện tại.

Client đã chọn React + Vite bằng JavaScript/JSX, không dùng Next.js. Dùng Tailwind CSS, shadcn/ui và lucide-react. Tổ chức theo feature. Đề xuất React Router, TanStack Query, Axios, React Hook Form + Zod, Vitest/Testing Library và Playwright là lựa chọn có điều kiện: kiểm tra dependencies/version trước, không cài trùng giải pháp đang có. Giữ pnpm/Turborepo và cập nhật pnpm-lock.yaml khi dependency đổi.

Trước khi setup, kiểm tra apps/web-client hiện tại, package.json, Vite version, Tailwind major, components.json, aliases, lint/test scripts. Không ghi đè cấu hình hiện có khi chưa hiểu tác dụng.

Acceptance:
- Vite khởi chạy và build thành công.
- Tailwind/shadcn/ui/lucide-react hoạt động với đúng major versions.
- Route/layout/feature boundaries rõ; client gọi HTTP gateway, không gọi thẳng services/gRPC.
- Loading/error/empty states và responsive baseline có thể được triển khai theo feature.
- Không có Next.js code/dependency được thêm.

Cập nhật frontend architecture, package scripts/docs, feature-status; chạy build/lint/test có sẵn và ghi kết quả.
~~~
