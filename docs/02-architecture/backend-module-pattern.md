# Mẫu phân lớp backend trong mỗi NestJS service

> Trạng thái: mẫu kiến trúc đề xuất cho AI. Trước khi áp dụng, kiểm tra phiên bản NestJS và patterns đang có trong service. Nếu repository đã có convention khác, ghi nhận và giữ nhất quán trừ khi người dùng yêu cầu đổi.

## Luồng request

~~~text
Client
  → HTTP BFF/API Gateway
  → Controller route + guard + input pipe
  → DTO/schema validation
  → Service / use case (business rules)
  → Repository
  → Database do service sở hữu
~~~

Giao tiếp nội bộ đồng bộ đi qua gRPC contract. Công việc bất đồng bộ đi qua RabbitMQ theo event/message contract hiện có. Client không gọi trực tiếp private service; một service không truy vấn database của service khác.

## Các thành phần

| Thành phần | Vai trò | NestJS mapping / lưu ý |
|---|---|---|
| Module | Gom controller, providers và dependencies của một feature | Nest module; ví dụ LessonsModule, TestsModule |
| Router | Định tuyến HTTP | Không cần lớp/file router riêng theo Express mặc định; route decorators nằm trên Controller |
| Controller | Nhận request/message, gọi use case/service, trả response | HTTP controller dùng @Controller/@Get/@Post; gRPC/message handler dùng pattern Nest phù hợp |
| DTO | Hình dạng input/output qua ranh giới transport | DTO không phải model database; đặt theo hành động như CreateLessonDto, SubmitAttemptDto |
| Pipe/Validator | Chuyển đổi và kiểm tra input tại boundary | ValidationPipe hoặc StandardSchemaValidationPipe/Zod pipe nếu phiên bản và codebase hỗ trợ |
| Service / Use case | Quy tắc nghiệp vụ và phối hợp các thao tác | Không chứa SQL/ORM chi tiết, không phụ thuộc HTTP response |
| Repository | Đọc/ghi dữ liệu cho service sở hữu | Dùng ORM/repository pattern đang có; không tạo abstraction thừa nếu dự án có convention khác |
| Model / Entity | Cấu trúc lưu trữ hoặc domain state | Phân biệt ORM entity/schema với DTO; không chia sẻ entity DB xuyên service |
| Contract | Giao tiếp giữa services và event | Proto/gRPC, RabbitMQ event schema; thay đổi phải tương thích contract |

## Zod và DTO: quyết định cần dùng nhất quán

Zod không phải bắt buộc chỉ vì dự án dùng NestJS. Có hai cách hợp lệ; chọn theo code hiện có:

### Cách A — NestJS DTO + class-validator
- DTO class định nghĩa request shape.
- Decorator class-validator chứa quy tắc validate.
- ValidationPipe thực thi ở controller boundary.
- Đây là cách NestJS tích hợp trực tiếp và phổ biến.

### Cách B — Zod schema làm nguồn validate
- Zod schema định nghĩa shape và runtime rules.
- Có thể suy ra TypeScript type từ schema; schema đóng vai trò DTO contract.
- Gắn schema bằng StandardSchemaValidationPipe nếu NestJS version hiện tại hỗ trợ; nếu không, dùng custom pipe theo codebase.
- Không thêm class-validator với cùng quy tắc cho cùng payload nếu không có nhu cầu cụ thể.

### Quy tắc chọn
1. Kiểm tra package.json, lockfile, ValidationPipe, DTO hiện có và shared packages.
2. Nếu service đang dùng class-validator, tiếp tục dùng DTO class + ValidationPipe.
3. Nếu repo đã chọn Zod, dùng schema Zod thống nhất và chuẩn hóa cách map validation errors.
4. Không cài cả Zod và class-validator để validate trùng một payload.
5. Frontend validation không thay thế backend validation. Mọi dữ liệu tại HTTP/gRPC/message boundary đều cần được kiểm tra phía nhận.
6. Nếu muốn chia sẻ Zod schema giữa React + Vite client và NestJS, chỉ chia sẻ contract phù hợp; không đưa database entities hoặc business internals vào package dùng chung.

## Gợi ý cấu trúc feature

Chỉ là mẫu; phải giữ conventions hiện hữu và không tạo đủ file máy móc nếu feature nhỏ.

~~~text
apps/<service>/src/<feature>/
  <feature>.module.ts
  <feature>.controller.ts
  dto/
    create-<feature>.dto.ts
    update-<feature>.dto.ts
  schemas/                 # chỉ khi dự án dùng Zod
  <feature>.service.ts
  <feature>.repository.ts
  models/                  # ORM schema/entity nếu cách dùng hiện tại cần
  contracts/               # gRPC/event contracts nếu thuộc feature
~~~

## Lưu ý microservices
Các lớp Controller → DTO/validator → Service → Repository vẫn được áp dụng bên trong từng service. Ranh giới microservice bổ sung contract và giao tiếp qua Gateway/gRPC/RabbitMQ; không biến tất cả services thành một application layer dùng chung hoặc một database chung.
