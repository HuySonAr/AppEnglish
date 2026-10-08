# Kiến trúc và cấu trúc React + Vite client

## Quyết định client
- Dùng React + Vite, viết JavaScript/JSX theo lựa chọn hiện tại.
- Không dùng Next.js, không thêm SSR/server components.
- Dùng Tailwind CSS cho styling, shadcn/ui cho component nền và lucide-react cho icon.
- Client gọi public API Gateway/BFF qua HTTP; không gọi thẳng private microservices hoặc gRPC từ trình duyệt.
- Vite dev server proxy có thể chuyển /api đến gateway local theo cấu hình môi trường hiện tại.

## Cấu trúc feature-first đề xuất

~~~text
apps/web-client/
  public/
  src/
    app/
      App.jsx
      main.jsx
      router.jsx
      providers/
        AppProviders.jsx
      layouts/
        AppLayout.jsx
        AuthLayout.jsx
    routes/
      ProtectedRoute.jsx
      RoleRoute.jsx
    features/
      auth/
        api/
        components/
        hooks/
        pages/
        schemas/
      placement/
        api/
        components/
        hooks/
        pages/
      learning/
        components/
        pages/
      lessons/
        api/
        components/
        hooks/
        pages/
      vocabulary/
        api/
        components/
        hooks/
      practice/
        api/
        components/
        hooks/
        pages/
      mock-tests/
        api/
        components/
        hooks/
        pages/
      progress/
        api/
        components/
        hooks/
        pages/
      leaderboard/
        api/
        components/
        pages/
    components/
      ui/                  # shadcn/ui components generated into the repo
      shared/              # reusable product-level components
    lib/
      api/
        http-client.js
      utils.js             # cn helper if configured
    hooks/
    constants/
    assets/
    styles/
      index.css
    test/
  components.json
  vite.config.js
~~~

Điều chỉnh chính xác tên và thư mục theo codebase đã có; không tạo tất cả thư mục rỗng. Mỗi feature sở hữu API calls, UI nghiệp vụ, hooks và schema liên quan. Chỉ đưa component dùng chung thật sự vào components/shared.

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

## Luồng client
React page → feature hook/API → shared HTTP client → HTTP Gateway/BFF → backend. Browser không giao tiếp trực tiếp với gRPC hoặc database.

## Lưu ý cấu hình shadcn + Tailwind
Vite, Tailwind và shadcn có thể thay đổi cấu hình giữa các major versions. AI phải kiểm tra version/package hiện tại và dùng đúng hướng dẫn tương ứng; không ghép cấu hình Tailwind v3 với v4. Đảm bảo alias import, components.json, Vite plugin và CSS entrypoint cùng trỏ đúng source.
