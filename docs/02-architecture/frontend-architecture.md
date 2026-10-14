# Kiến trúc và cấu trúc React + Vite client

## Quyết định client
- Dùng React + Vite, viết JavaScript/JSX theo lựa chọn hiện tại.
- Không dùng Next.js, không thêm SSR/server components.
- Dùng Tailwind CSS cho styling, shadcn/ui cho component nền và lucide-react cho icon.
- Client gọi public API Gateway/BFF qua HTTP; không gọi thẳng private microservices hoặc gRPC từ trình duyệt.
- Vite dev server proxy có thể chuyển /api đến gateway local theo cấu hình môi trường hiện tại.

## Cấu trúc hiện tại (D54)

~~~text
apps/web-client/src/
  app/
    main.jsx, App.jsx
    router.jsx           # route của mọi role
    navigation.js        # menu của từng role (thêm trang: 1 route + 1 mục ở đây)
  layouts/
    AuthLayout.jsx       # đăng nhập/đăng ký: form + panel thương hiệu
    SidebarLayout.jsx    # mọi role: sidebar bên trái; drawer trên điện thoại (học viên mở từ bên phải, D96)
    components/          # Brand, SidebarNav, UserMenu, ThemeToggle
  routes/                # ProtectedRoute, PublicOnlyRoute, RoleRoute
  features/              # mỗi role/nghiệp vụ một thư mục
    auth/                # api, components, context, flow, pages, schemas
    student/             # api, lib, components (TestExam, quizzes, review), pages
    admin/               # api, pages
    content-manager/     # api, lib, components, pages
  components/
    ui/                  # shadcn/ui (Radix) primitives
    shared/              # PageHeader, FeatureCard, EmptyState, PageSkeleton, ListFilter, Pagination
  hooks/                 # use-theme
  lib/                   # api/ (HTTP client, response), utils.js (cn), notify.js (Sonner notifications), list.js (search, sort, paging), leave-guard.js
  constants/
  styles/index.css       # design tokens sáng/tối
~~~

Mỗi feature sở hữu API calls, UI nghiệp vụ, hooks và schema liên quan; chỉ đưa
component dùng chung thật sự vào components/shared. Màu sắc chỉ dùng token trong
`styles/index.css` (`primary`, `muted`, `success`, `warning`, `info`…); đổi giao
diện toàn app bằng cách sửa token. Chế độ tối bật bằng class `dark` trên `<html>`
(`hooks/use-theme.js`, lưu lựa chọn trong localStorage).

## Công cụ

### Đã chốt
| Công cụ | Mục đích |
|---|---|
| React | Xây giao diện dạng component |
| Vite | Dev server, HMR và production build |
| Tailwind CSS | Utility-first styling và responsive design |
| shadcn/ui | Component source có thể tùy chỉnh trong repository |
| lucide-react | Icon React dạng SVG |

### Đề xuất cho client quy mô vừa/lớn
| Công cụ | Mục đích | Trạng thái |
|---|---|---|
| React Router | Route, nested layout, protected route | Khuyến nghị; xác minh package trước |
| TanStack Query | Server state, loading/error/cache/invalidation | Khuyến nghị; dùng nếu chưa có giải pháp tương đương |
| Axios | HTTP client dùng chung, interceptors và cookie credentials nếu auth dùng cookie | Khuyến nghị; tuân theo client hiện có |
| React Hook Form + Zod | Form state và client-side schema validation | Khuyến nghị; backend vẫn phải validate độc lập |
| Vitest + React Testing Library | Unit/component tests trong Vite | Khuyến nghị |
| Playwright | E2E các luồng học và làm test | Khuyến nghị |
| ESLint + Prettier | Static checks và format | Dùng cấu hình repository nếu đã có |

Không cài toàn bộ đề xuất một cách máy móc. Trước tiên kiểm tra package.json/workspace, scripts và dependencies hiện tại; chỉ thêm package khi feature cần và phải cập nhật lockfile pnpm.

## Quy tắc kiến trúc frontend
1. Route component kết nối layout/page; không để business rules lớn trong router.
2. UI nghiệp vụ và server calls nằm trong feature sở hữu nghiệp vụ.
3. API base URL, cookie/refresh handling, error mapping nằm trong một shared HTTP client.
4. Không nhúng host/secret theo môi trường vào source; dùng biến Vite phù hợp và không đưa secret server-side vào client.
5. Dùng TanStack Query (nếu được chọn) cho server state; React state cho trạng thái local. Chỉ thêm Zustand/Redux khi có nhu cầu global client state cụ thể.
6. Form validate phía client để hỗ trợ UX; backend luôn validate lại dữ liệu đầu vào.
7. shadcn/ui component được lưu source trong components/ui; tùy biến qua props/wrapper/theme, tránh lặp lại component nền.
8. Dùng named imports từ lucide-react. Icon-only button phải có accessible label/aria-label.
9. Dùng design tokens và Tailwind theme thống nhất; không rải màu/khoảng cách tùy ý khắp feature.
10. Tối ưu mobile/desktop, loading, empty, error và success states cho mỗi trang.

## Quy ước giao diện bắt buộc (D70)

Áp dụng cho mọi trang và component mới của web client. Trước khi viết giao
diện, đọc mục này và dùng lại các thành phần đã có; không tự tạo biến thể riêng.

### Trạng thái đang tải
- Trang đang tải dữ liệu lần đầu phải hiện skeleton có hình dạng giống trang
  thật, không hiện một khối xám hay chữ "Loading". Dùng các component trong
  `src/components/shared/PageSkeleton.jsx`:

  | Loại trang | Component |
  |---|---|
  | Danh sách có tìm kiếm (hàng) | `ListPageSkeleton` |
  | Lưới thẻ | `CardGridPageSkeleton` |
  | Trang chi tiết một đối tượng (thẻ tóm tắt + các phần) | `DetailPageSkeleton` (`aside` khi có cột phải) |
  | Trình soạn | `EditorPageSkeleton` |
  | Form cài đặt | `FormPageSkeleton` |
  | Một danh sách bên trong trang đã hiển thị | `RowsSkeleton` |

  Nếu không loại nào khớp, thêm một skeleton mới vào chính file đó.
- Tải lại sau một thao tác (lưu, đổi thứ tự…) thì giữ nội dung đang hiển thị,
  không thay bằng skeleton (`load({ quiet: true })`).
- Nút đang chạy thao tác dùng `<Button loading={...}>`: nút hiện spinner, tự
  khóa và có `aria-busy`. Không tự vẽ spinner riêng. Các nút khác gây xung đột
  thì `disabled` trong lúc đó.
- Mỗi trang có đủ bốn trạng thái: đang tải (skeleton), lỗi (nút "Try again"),
  rỗng (`EmptyState`) và có dữ liệu.

### Danh sách: tìm kiếm, lọc, sắp xếp, phân trang
- Mọi danh sách có thể dài (đề, unit/lesson, tài khoản…) phải có tìm kiếm, sắp
  xếp hoặc lọc phù hợp, và phân trang.
- Dùng `SearchField` và `FilterSelect` (`components/shared/ListFilter.jsx`),
  `Pagination` (`components/shared/Pagination.jsx`) và các hàm trong
  `src/lib/list.js` (`matchesSearch` không phân biệt hoa thường và dấu,
  `compareText`, `paginate`).
- Luật lọc và sắp xếp của từng danh sách viết thành hàm thuần trong `lib/` của
  feature (ví dụ `content-list.js`, `student-list.js`) và có test.
- Đổi tìm kiếm, bộ lọc hay cách sắp xếp thì quay về trang 1. Danh sách lọc ra
  rỗng thì hiện `EmptyState` "… matches", khác với trạng thái chưa có dữ liệu.
- Danh sách nhỏ (cỡ vài trăm mục) được lọc và phân trang trong trình duyệt trên
  dữ liệu đã tải. Danh sách có thể lớn không giới hạn (tài khoản) phân trang ở
  server.
- Danh sách có thứ tự nghiệp vụ (unit, lesson) giữ thứ tự đó làm mặc định; thao
  tác đổi thứ tự bị khóa khi danh sách đang được tìm, lọc hoặc sắp theo tiêu
  chí khác.

### Thông báo và thành phần chung
- Thông báo dùng `notify()` trong `src/lib/notify.js` (Sonner): `success` mặc
  định, `destructive` cho lỗi, `info`, `warning`, `loading`.
- Tiêu đề trang dùng `PageHeader`; danh sách rỗng dùng `EmptyState`; ô dashboard
  dùng `FeatureCard`.
- Biểu đồ dùng `ChartContainer` của shadcn chart (`components/ui/chart.jsx`, Recharts) với màu `--chart-1`…`--chart-5`; không tự vẽ biểu đồ bằng `div` hay thêm thư viện biểu đồ khác (D78).
- Màu chỉ lấy từ token trong `styles/index.css`; mọi trang phải dùng được ở
  chế độ sáng, tối và trên màn hình điện thoại.
- Chữ trên giao diện viết bằng tiếng Anh.

## Luồng client
React page → feature hook/API → shared HTTP client → HTTP Gateway/BFF → backend. Browser không giao tiếp trực tiếp với gRPC hoặc database.

## Lưu ý cấu hình shadcn + Tailwind
Vite, Tailwind và shadcn có thể thay đổi cấu hình giữa các major versions. AI phải kiểm tra version/package hiện tại và dùng đúng hướng dẫn tương ứng; không ghép cấu hình Tailwind v3 với v4. Đảm bảo alias import, components.json, Vite plugin và CSS entrypoint cùng trỏ đúng source.
