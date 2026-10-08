# AppEnglish — hướng dẫn AI

## Đọc trước khi làm
1. Đọc README.md, docs/00-overview/product-scope.md, decisions.md và docs/02-architecture/technology-stack.md.
2. Đọc workflow phù hợp trong docs/01-business/workflows/ và mapping database trong docs/02-architecture/database-allocation.md.
3. Khảo sát code/config hiện tại và đọc service spec liên quan.
4. Dùng stack đã chọn trong technology-stack.md và pattern trong backend-module-pattern.md; xác minh version, lệnh và validator hiện hữu từ repository.

## Quy tắc
- Làm một feature mỗi lượt, theo docs/04-implementation/implementation-order.md.
- Nghiệp vụ trong docs/01-business là nguồn yêu cầu sản phẩm đã chốt.
- Không tự thêm nghiệp vụ, service, API, database, event hay công nghệ.
- Không đưa Speaking, Writing, giáo viên, lớp học, assignment, CEFR, streak hoặc XP lesson vào phạm vi.
- Không tự quyết định mục TBD. Nếu cần để triển khai, giải thích lựa chọn và hỏi người dùng.
- Giữ pnpm workspaces/Turborepo, NestJS services, React + Vite client và quy ước code thật của repository. Không chuyển package manager/framework/language.
- Trong NestJS, route thường nằm trong Controller; không tạo Express Router riêng nếu kiến trúc hiện tại không yêu cầu. Tách controller/DTO-validation/service/repository/model theo conventions hiện có.
- Chỉ chọn một kiểu validate payload backend nhất quán (DTO + class-validator hoặc Zod schema); không validate trùng cùng rule.
- Không gọi DB service khác trực tiếp; dùng PostgreSQL databases app_identity, app_content, app_learning, app_progress theo database-allocation.md và contract hiện hữu. PostgreSQL local chạy ngoài Docker; Redis/RabbitMQ chạy Docker Compose theo development.md. Không đổi business logic để né broker.
- Không xóa hay đổi schema/dữ liệu chưa kiểm tra ảnh hưởng.

## Sau mỗi feature
- Cập nhật docs/04-implementation/feature-status.md.
- Cập nhật workflow, API/data/service docs bị ảnh hưởng.
- Ghi quyết định mới vào docs/00-overview/decisions.md.
- Chạy checks phù hợp; chỉ báo kết quả thực sự đã chạy.
- Chưa đạt acceptance criteria thì không đánh dấu DONE.

## Mâu thuẫn
Yêu cầu mới nhất của người dùng ưu tiên hơn tài liệu cũ. Nếu code và kiến trúc docs không khớp, ghi bằng chứng và cập nhật docs; không tự tái kiến trúc trong một feature.
