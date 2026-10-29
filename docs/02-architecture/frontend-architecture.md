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
    shared/              # PageHeader, FeatureCard, EmptyState, PageSkeleton, ListFilter, Pagination, FileDropzone, FileRow, PublishButton, StepNav, PageBreadcrumb
  hooks/                 # use-theme, use-list-state, use-return-to
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

Ngôn ngữ thiết kế (token, bo góc, bố cục, thành phần, chuyển động, icon): xem [design-system.md](design-system.md).

### Chữ trên giao diện (D149)
- Description của trang, phần, hộp thoại và dòng hướng dẫn tối đa một câu
  ngắn, chỉ nói cần làm gì. Không giải thích nghiệp vụ (ai thấy gì, cách chấm,
  điều kiện mở khóa) và không ghi mã quyết định (Dxx); nghiệp vụ nằm trong docs.
- Thông báo và hộp thoại xác nhận vẫn nói rõ hậu quả của thao tác.

### Âm thanh
- Chỉ một âm thanh phát tại một thời điểm: `installSingleAudio` (trong `main.jsx`) dừng mọi trình phát khác khi một trình phát bắt đầu; phát âm thanh ngắn (phát âm từ vựng) dùng `playSound` trong `src/lib/audio.js`, không tạo `new Audio()` riêng.

### Màu nền (D153)
- Không dùng gradient hay đốm màu mờ (blur) trang trí. Thẻ giới thiệu, banner và ảnh bìa dùng nền phẳng: `bg-card` có viền, `bg-muted`, hoặc một màu nhạt một tông như `bg-primary/10` cho ô biểu tượng.

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
  `compareText`, `paginate`, `pageRange`).
- Thanh phân trang có một bố cục duy nhất: bên trái "43 accounts · page 2 of
  5", bên phải một khối liền Previous · 1 2 3 … 10 · Next (số trang theo
  `pageRange`: luôn có trang đầu, cuối, trang hiện tại và hai trang kề; tối đa
  7 trang thì hiện hết). Màn hình hẹp giấu dãy số, chỉ còn "2 / 5" giữa hai
  mũi tên. Không có ô nhập số trang hay nút đầu/cuối. Chỉ danh sách phân trang ở
  server (tài khoản) bật "Rows per page" 10/20/50 qua prop
  `pageSize` + `onPageSizeChange`; đổi số dòng quay về trang 1.
- Luật lọc và sắp xếp của từng danh sách viết thành hàm thuần trong `lib/` của
  feature (ví dụ `content-list.js`, `student-list.js`) và có test.
- Đổi tìm kiếm, bộ lọc hay cách sắp xếp thì quay về trang 1. Danh sách lọc ra
  rỗng thì hiện `EmptyState` "… matches", khác với trạng thái chưa có dữ liệu.
- Tìm kiếm, bộ lọc, sắp xếp và số trang nằm trong URL qua `useListState`
  (`hooks/use-list-state.js`, thuần ở `listStateFromParams` /
  `paramsFromListState` trong `lib/list.js`, có test), không dùng `useState`
  riêng, để quay lại từ trang con hay tải lại trang vẫn đúng chỗ (D130). Link
  sang trang con dùng `useListLinkState()` để mang `from` và `focusId`; trang
  con dùng `useReturnTo(fallback)` cho nút quay lại; danh sách gọi
  `useFocusReturn(ready)` và đặt `id="focus-<id>"` trên hàng để cuộn tới.
- Danh sách nhỏ (cỡ vài trăm mục) được lọc và phân trang trong trình duyệt trên
  dữ liệu đã tải. Danh sách có thể lớn không giới hạn (tài khoản) phân trang ở
  server.
- Danh sách có thứ tự nghiệp vụ (unit, lesson) giữ thứ tự đó làm mặc định; thao
  tác đổi thứ tự bị khóa khi danh sách đang được tìm, lọc hoặc sắp theo tiêu
  chí khác.

### Xuất bản và gỡ (D126)
- Mọi nút xuất bản dùng `PublishButton` với hook `usePublishAction()`
  (`components/shared/PublishButton.jsx`): `publish.run(onPublish)` chạy hành
  động, hiện "Publishing…" (mũi tên bay vào mây) rồi "Done" (dấu tick) khi
  `onPublish` trả về `true`, hoặc về "Publish" ngay khi thất bại. Hoạt ảnh
  định nghĩa trong `styles/index.css` (`publish-arrow`, `publish-cloud`,
  `publish-pop`), tắt khi `prefers-reduced-motion`.
- `ContentDangerActions` hiện nút Unpublish (chỉ khi đang xuất bản) và nút
  biểu tượng Delete; cả hai hỏi xác nhận bằng `AlertDialog`. Không gom vào menu.
- `DiscardDraftButton` (D127) hiện khi có bản nháp: ở toolbar và ở dòng Draft
  của `VersionHistory`; sau khi gỡ gọi `load()` của trang. Dòng version cũ
  (không phải draft, không phải live) có nút thùng rác xóa version (D128) với
  xác nhận; 409 CONTENT_IN_USE được giải thích bằng số lượt làm bài.

### Soạn và duyệt nội dung (D191)
- Các trang nội dung (units/lessons, Unit review, placement, mock test, bài nghe) dùng chung cho hai khu vực: giáo viên ở `/teacher/...`, Content Manager ở `/content-manager/...`. `useContentArea()` (`features/content-manager/hooks/use-content-area.js`, helper thuần trong `lib/content-area.js`) cho đường dẫn gốc, `canAuthor` (giáo viên) và `canManage` (Content Manager); link trong trang dùng đường dẫn gốc này.
- Content Manager xem trình soạn ở chế độ chỉ đọc qua `ReadOnlyProvider`/`useReadOnly` (`components/ReadOnly.jsx`); các thành phần soạn (TextField, MediaField, PartEditor, MockPartEditor, VocabularyCard, RecordingEditor) tự khoá theo context, không tạo bản sao trang.
- `components/ContentReview.jsx`: nhãn trạng thái (Draft, In review, Returned), nút "Submit for review", dải "Waiting for review" kèm Withdraw hoặc "Returned with a note", Approve/Return (ghi chú bắt buộc) cho Content Manager và khung "Changes from published" dùng `outlineChanges()` của `lib/version-outline.js`.
- Hàng chờ duyệt của Content Manager: `/content-manager/reviews` (tab Waiting for review / Returned / Drafts, tìm kiếm, sắp xếp, phân trang). Dashboard giáo viên có thẻ "Content in progress".
- `VersionHistory` nhận `canRestore`, `canDiscard`, `canDeleteVersion` theo vai trò.

### Luyện Speaking/Writing theo dạng ETS (D195)
- `features/student/lib/ets-practice.js` (helper thuần, có test): đề dạng bộ, thời gian từng câu, câu phát hai lần, nhóm lịch sử theo `setId`, khoá ô viết, lưu lựa chọn "Practice without timer" theo tài khoản (localStorage có try/catch, `hooks/use-no-timer.js`).
- `hooks/use-recorder.js` (micro, ghi âm, đếm ngược) dùng chung cho `SpeakingRecorder` và `components/EtsSpeaking.jsx` (bài đơn có giờ, bộ 3 câu, kết quả theo bộ); `components/EtsTimer.jsx` cho công tắc, nhãn thời gian và đồng hồ.
- Nhãn dạng câu, trường theo dạng và mặc định khi chọn dạng nằm trong `src/lib/practice-prompts.js`; trình soạn giáo viên dùng `features/teacher/components/PromptEditorParts.jsx`; `PracticePromptView` hiện đủ trường mới ở chế độ chỉ đọc.

### Bài thi Speaking/Writing (D196)
- Trang nội dung dùng chung hai khu vực: `SwTestsManagePage`, `SwTestEditorPage` (menu bên trái theo khối câu đánh số như đề thật; helper `features/content-manager/lib/sw-test-draft.js`).
- Học viên: `SwTestsPage`, `SwTestPage`, `SwResultPage`; bộ chạy bài `SwSpeakingExam` (kiểm tra micro, rồi từng câu: đọc → nghe → chuẩn bị → ghi âm đủ thời gian, không có nút dừng) và `SwWritingExam` (4 nhóm 480/600/600/1800 giây, tự lưu sau 800 ms, gửi `lockThrough` khi hết nhóm); thứ tự và thời gian nằm trong helper thuần `features/student/lib/sw-exam.js`.

### Chọn file (D125)
- Mọi chỗ nhận file dùng `FileDropzone` (`components/shared/FileDropzone.jsx`):
  vùng kéo-thả có `accept`, `maxBytes`, `kindLabel`, biến thể `compact` cho ô
  trong form; kiểm tra loại và dung lượng bằng `fileIssue()` của `lib/files.js`
  (có test) và báo lỗi bằng `notify()`. Không dùng `<input type="file">` trần.
- File đã chọn hoặc đã tải hiện bằng `FileRow` (`components/shared/FileRow.jsx`):
  tên, dung lượng (`formatBytes()`), trạng thái `pending` / `uploading` /
  `done` / `failed` với thanh tiến trình, nút xóa, phần xem trước là children.
  `useDraftMedia` cung cấp `uploading` và `failed` để `MediaField` hiện đúng
  trạng thái trong lúc lưu.

### Thông báo và thành phần chung
- Thông báo dùng `notify()` trong `src/lib/notify.js` (Sonner): `success` mặc
  định, `destructive` cho lỗi, `info`, `warning`, `loading`.
- Tiêu đề trang dùng `PageHeader`; danh sách rỗng dùng `EmptyState`; ô dashboard
  dùng `FeatureCard`.
- Trang có nhiều bước (lesson) dùng `StepNav` cho dải bước.
- Trang con (chi tiết, trình soạn, bài làm) mở đầu bằng `PageBreadcrumb` (dựa trên `components/ui/breadcrumb.jsx`, theo shadcn Breadcrumb) cho đường dẫn từ trang cha tới trang hiện tại, thay cho link "← Quay lại"; bước cuối là trang hiện tại, bước giữa không có trang riêng hiện chữ thường.
- Thẻ từ vựng lật dùng `features/student/components/WordFlipCard.jsx`; màn hình bắt đầu bài test (lesson test, unit review, mock test, mini test) dùng `TestStartCard.jsx`; vòng điểm kết quả dùng `ScoreRing.jsx`.
- Ô mật khẩu dùng `PasswordInput` (`components/shared/PasswordInput.jsx`): nút
  con mắt hiện/ẩn chỉ xuất hiện khi ô đã có chữ; nút reveal mặc định của trình
  duyệt (Edge `::-ms-reveal`) bị ẩn trong `styles/index.css` để không có hai con
  mắt. Nhận mọi prop của `Input` và `register` của react-hook-form.
- Trình soạn nội dung có version đặt `VersionHistory`
  (`features/content-manager/components/VersionHistory.jsx`) ở cuối trang:
  danh sách version, xem tóm tắt chỉ đọc (`lib/version-outline.js`, thuần, có
  test) và khôi phục thành bản nháp rồi gọi `load()` của trang (D122).
- Trình soạn lesson và Unit review có `ImportExportJson`
  (`features/content-manager/components/ImportExportJson.jsx`): nhập file JSON
  theo định dạng soạn (`lib/authoring-import.js` kiểm tra, chuyển đổi qua
  `@appenglish/content-contracts/authoring` và gộp media đang có; có test) và
  xuất bản đang soạn (D124). Không gọi API: nội dung nhập vào state của editor.
- Trình soạn có nhiều phần (lesson, mock test, Unit review, placement) có thanh trên cố định (tên, trạng thái, nút Save draft/Publish) và menu phần bên trái
  `SectionNav` (`features/content-manager/components/SectionNav.jsx`): nhóm, mỗi mục có tiến độ, dấu xong và số lỗi khi publish.
  Câu hỏi trắc nghiệm dùng `QuestionCard` của `MockPartEditor.jsx` (đáp án là nút chữ cái, đáp án đúng màu xanh).
- Chọn ngày dùng `DatePicker` (`components/shared/DatePicker.jsx`, lịch tự làm, hàm trong `lib/calendar.js`); không dùng `<input type="date">` và không thêm thư viện lịch. Lịch mở trong một hộp thoại nhỏ riêng ở giữa màn hình (chọn rồi bấm xác nhận), không làm hộp thoại đang mở dài ra và không bị cắt.
- Hộp thoại (`Dialog`, `AlertDialog`) cao tối đa bằng màn hình trừ 2rem và tự cuộn; nội dung dài trong hộp thoại (danh sách xem trước…) nên có vùng cuộn riêng.
- Người dùng hiện bằng `Avatar` (`components/shared/Avatar.jsx`): ảnh đại diện,
  hoặc chữ cái đầu của tên khi chưa có ảnh; tên lấy từ `displayNameOf()` của
  `@appenglish/auth-contracts` (D113). Không hiện email đầy đủ của người khác.
- Biểu đồ dùng `ChartContainer` của shadcn chart (`components/ui/chart.jsx`, Recharts) với màu `--chart-1`…`--chart-5`; không tự vẽ biểu đồ bằng `div` hay thêm thư viện biểu đồ khác (D78).
- Màu chỉ lấy từ token trong `styles/index.css`; mọi trang phải dùng được ở
  chế độ sáng, tối và trên màn hình điện thoại.
- Chữ trên giao diện viết bằng tiếng Anh. Ngoại lệ (D158): kết quả full mock test có một dòng chú thích tiếng Việt cho điểm TOEIC tổng.

## Luồng client
React page → feature hook/API → shared HTTP client → HTTP Gateway/BFF → backend. Browser không giao tiếp trực tiếp với gRPC hoặc database.

## Lưu ý cấu hình shadcn + Tailwind
Từ 2026-10-29 (D222) dùng Tailwind v4: cấu hình nằm trong `src/styles/index.css` (`@import 'tailwindcss'`, `@import 'tw-animate-css'`, `@custom-variant dark` theo class `.dark`, `@custom-variant short`, `@theme inline` cho màu, font, bán kính), build qua plugin `@tailwindcss/vite`; không có `tailwind.config.js`, `postcss.config.js`, autoprefixer. Tên class theo v4: `shadow-xs` (bóng nhỏ cũ), `outline-hidden` (thay `outline-none`), `ring-3` (vòng 3px). `components.json` của shadcn để `tailwind.config` rỗng.
Vite, Tailwind và shadcn có thể thay đổi cấu hình giữa các major versions. AI phải kiểm tra version/package hiện tại và dùng đúng hướng dẫn tương ứng; không ghép cấu hình Tailwind v3 với v4. Đảm bảo alias import, components.json, Vite plugin và CSS entrypoint cùng trỏ đúng source.
