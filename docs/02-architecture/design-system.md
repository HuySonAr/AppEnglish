# Design system — web client

Ngôn ngữ thiết kế của `apps/web-client`: giao diện trông thế nào. Quy tắc hành vi (skeleton, bốn trạng thái của trang, danh sách, thông báo, chữ trên giao diện D149, màu nền D153) nằm ở mục "Quy ước giao diện bắt buộc" trong [frontend-architecture.md](frontend-architecture.md); file này không chép lại.

Mọi giá trị dưới đây lấy từ code hiện có (xác minh 2026-10-24). Khi đổi code thiết kế, cập nhật file này cùng lượt.

## 1. Nguyên tắc

- **Phẳng, có viền.** Nền một tông (`bg-card`, `bg-muted`, `bg-primary/10`), phân tách bằng viền `border`; không gradient, không đốm mờ trang trí (D153).
- **Bo tròn mềm.** Phần tử tương tác bo `rounded-xl` trở lên; khung lớn bo rất lớn; ô nhập và nút ở trang auth bo hoàn toàn (`rounded-full`).
- **Thoáng.** Khoảng cách rộng, mỗi vùng một việc; trang học viên dẫn bằng bước tiếp theo, đường dẫn tính năng là phụ.
- **Chữ ngắn.** Tiêu đề rõ, mô tả một câu (D149).
- **Chuyển động có mục đích.** Hiệu ứng ngắn, chỉ dùng `transform`/`opacity`, luôn tắt khi `prefers-reduced-motion`.

## 2. Token

Nguồn: `src/styles/index.css` (biến CSS) và `tailwind.config.js`. Dùng class Tailwind theo token, không viết mã màu trực tiếp.

| Nhóm | Giá trị |
|---|---|
| Phông | Inter, rồi phông hệ thống; `h1–h3` dùng `tracking-tight` |
| Màu chủ đạo | `primary` chàm (sáng `243 75% 59%`, tối `243 90% 70%`); `ring` cùng màu |
| Nền | `background` (xám xanh rất nhạt / gần đen), `card`, `muted`, `accent`, `secondary` |
| Trạng thái | `success`, `warning`, `info`, `destructive`; dùng dạng chữ hoặc nền nhạt `/10` |
| Biểu đồ | `chart-1…5` |
| Bo góc gốc | `--radius: 0.75rem` → `rounded-lg`; `md`, `sm` nhỏ dần 2px |
| Chế độ tối | class `dark` trên `html`, đổi qua `ThemeToggle`; mọi màu phải dùng token để tự đổi |

Thang bo góc đang dùng:

| Class | Dùng cho |
|---|---|
| `rounded-md` | Button, Input mặc định (shadcn) |
| `rounded-lg` | `Card` |
| `rounded-xl` | Hàng sidebar, ô biểu tượng `FeatureCard`, `EmptyState` |
| `rounded-2xl` | Thẻ nổi trên khung auth, ô mã OTP, ô bên trong khu vực (chỉ số, unit, việc trong kế hoạch, `GlideCards`) |
| `rounded-3xl` | Khu vực trang (`SectionCard`, `StreakCard`), hộp cảnh báo trong form auth |
| `rounded-[2rem]` / `rounded-[2.5rem]` | Khung auth và tấm hình bên trong; khối "bước tiếp theo" trên Home |
| `rounded-full` | Ô nhập, nút, nhãn logo, "Code sent to" ở trang auth; avatar |

## 3. Bố cục

### Trang trong ứng dụng (`SidebarLayout`)
- Sidebar rộng `w-64` (`lg:pl-64`), header cao `h-16` dính trên cùng, viền dưới.
- Sidebar chia **mục có tiêu đề** (`text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80`), khai báo trong `src/app/navigation.js` (`sections`).
- Hàng sidebar: `rounded-xl px-3 py-2.5 text-sm font-medium`; đang chọn `bg-primary/10 text-primary`, hover `bg-accent`.
- Nhóm có mục con (Practice): **bấm để mở/đóng**, không mở khi hover; tự mở khi đang ở trang con. Mục con treo trên **một đường kẻ thẳng** (`ml-5 border-l pl-3`), mục đang mở có chevron phải. Mở/đóng bằng chuyển `grid-template-rows` 200ms.
- Chân sidebar một hàng: avatar + tên + email (dẫn tới Profile), nút giao diện sáng/tối và đăng xuất dạng icon.
- Đầu trang dùng `PageHeader` (eyebrow chữ hoa màu `primary`, `h1` `text-2xl sm:text-3xl font-bold`, mô tả một câu, nút hành động bên phải).

### Home học viên (D187)
Thứ bậc từ trên xuống, cột phải `21rem` trên màn hình rộng:
1. Ngày + lời chào (`h1`, tên màu `primary`).
2. **Bước tiếp theo**: khối `bg-primary` phẳng `rounded-[2rem]` có `GridPattern`, nhãn viên thuốc, tiêu đề lớn, `CircleSwapLink` nền trắng, vòng `ScoreRing tone="inverse"` tiến độ bài học | `StreakCard`.
3. `TodayPlanCard` | `GoalCard`.
4. `ScoreForecastCard`: biểu đồ L&R khi chọn nhóm L&R; chỉ chọn S&W thì thẻ gọn `SwForecastCard` "Appears after scoring" (D197); thẻ mục tiêu S&W hiện điểm 0–200 của lượt chấm gần nhất khi đã có (D198).
5. "Where you stand": 4 chỉ số (`Stat`, nâng nhẹ khi hover, số đếm lên) trong một `SectionCard`.
6. Unit | Practice (`GlideCards` 2×2 + trạng thái placement).

Khu vực dùng `SectionCard` (`rounded-3xl border bg-card p-5 sm:p-6`, tiêu đề có ô biểu tượng `bg-primary/10`, liên kết bên phải là `ArrowLink`). Ô bên trong dùng `rounded-2xl border bg-background`. Trang học viên khác dùng lại khung này khi được làm lại.

### Trang luyện Speaking (đề đang làm)
- Đầu trang gọn: `PageBreadcrumb` (Practice › Speaking), rồi một hàng gồm tiêu đề đề `h1 text-lg font-semibold` (cắt dòng khi dài), nhãn mức và dạng câu · chủ đề; tab Practice/History nằm bên phải cùng hàng (`PracticeTabs` nhận `toolbar`).
- Từ `lg`: hai cột trong vùng cao vừa màn hình (`h-[calc(100dvh-12rem-var(--player-h))]`, tối thiểu `24rem`), trang không cuộn. Khung chỉ cao theo nội dung (`items-start`, `max-h-full`), cuộn bên trong khi dài. Khung gọn: `rounded-xl border bg-card p-4 sm:p-5`, không đổ bóng. Cột trái là đề (đoạn đọc `text-lg sm:text-xl`, hoặc yêu cầu và hình `max-h-[50dvh]`, hoặc bối cảnh và bảng thông tin); cột phải rộng `23rem` gồm khu ghi âm (công tắc bỏ đếm giờ, mốc thời gian ETS, nút micro `h-12`) và kết quả mới nhất.
- Dưới `lg`: các khối xếp dọc theo thứ tự đề → ghi âm → kết quả.
- Audio mẫu đọc to và audio câu hỏi khi luyện không đếm giờ phát ở **thanh phát cố định cuối màn hình** kiểu trình nghe nhạc (`ModelAudio`): `fixed bottom-0`, chừa sidebar từ `lg` (`lg:left-64`), cao `4rem`, `border-t bg-card`, ba vùng: trái là tên (Model reading / Question n), giữa là nút lùi 3 giây và nút phát tròn `h-8` (`bg-foreground`) trên một thanh tiến độ mảnh `h-1` có thời gian hai bên (hover: thanh đổi `primary`, hiện núm), phải là `SpeedSwitch`. Trên điện thoại ẩn phần tên. Thanh đặt biến CSS `--player-h` để trang chừa chỗ dưới cùng; ẩn khi sang tab History. Audio ghi âm của học viên vẫn phát tại chỗ.
- Màn hình kết quả (`SpeakingResultScreen`, D203): cùng đầu trang gọn; trong lúc chấm là khung chờ `max-w-md` căn giữa (spinner, danh sách bước có trạng thái xong / đang làm / chờ); xong thì kết quả `max-w-3xl` với nút "Other prompts" và "Practice again". Nhận xét AI có `LanguageSwitch` English / Tiếng Việt (viên thuốc như `SpeedSwitch`).

### Trang Word memory (theo mẫu "Pastel Vocabulary Quiz Dashboard")
- Gọn trong một màn hình: đầu trang ô biểu tượng tròn `h-10 bg-primary/10`, tiêu đề `text-xl font-bold`, mô tả một câu; bên phải thẻ nhỏ "From your lessons" (số câu, số câu đúng).
- Thẻ tiến độ mảnh `px-4 py-2 text-sm`: "Question n / N", thanh `h-1.5` màu `primary`, phần trăm đã trả lời.
- Từ `lg` hai cột: trái là câu hỏi (nhãn viên thuốc "Question n" + hướng dẫn, đề `text-lg font-semibold`, bốn lựa chọn xếp dọc `px-3 py-2 text-sm` có vòng chữ cái `h-7`; đúng `success/10` + dấu tích, sai `destructive/10`). Phải là thẻ từ sau khi chọn (từ `text-2xl text-primary`, phiên âm, nút phát âm UK/US, loại từ, nghĩa), ô ví dụ `bg-muted/40`, ô bài học nguồn `bg-warning/10`; đúng/sai chỉ hiện trên đáp án, không lặp lại. Trước khi chọn, cột phải là `RoundPanel`: lời nhắc, ba ô Right / Wrong / Left, lưới số câu (đúng xanh, sai đỏ, đang làm màu chính) và phím tắt.
- Thanh điều hướng dưới cùng (dính đáy khi cuộn): "Previous" và "Next word" / "See the results".

### Trang auth (`AuthLayout`)
Tham khảo: [login-page.webp](../assets/design/login-page.webp).

- Nền ngoài `bg-muted/70`; một **khung lớn** `max-w-6xl rounded-[2.5rem] border bg-card shadow-2xl`, chia đôi **bằng nhau** trên màn hình rộng.
- **Chiều cao cố định (D189):** từ `lg` khung cao `min(46rem, 100dvh − 4rem)`, trang không cuộn; mọi trang auth dùng cùng kích thước, nội dung dài cuộn trong nửa form. Form phải vừa khung mà không cuộn: tiêu đề `pb-6`, các ô cách nhau `space-y-4`, chân form `mt-6`, vùng nội dung `py-6`. Form đặt mật khẩu mới rộng `max-w-md`, hai ô mật khẩu nằm cạnh nhau từ `sm`. Màn hình rộng nhưng thấp (≥1024px, cao ≤820px) dùng biến thể Tailwind `short:` để thu nhỏ khoảng cách, tiêu đề `1.75rem` và ô OTP `h-12`; nửa form ẩn thanh cuộn (`auth-scroll`). Trang mã xác thực gộp "Resend code" vào chân form.
- **Nửa form:** nhãn logo dạng viên thuốc (SVG `LogoMark`) + `ThemeToggle` trên cùng; form `max-w-sm` căn giữa; tiêu đề căn giữa `text-3xl`; liên kết chân form kiểu "Have an account? Sign in".
- **Nửa hình (`AuthShowcase`):** tấm `bg-primary` phẳng bo `rounded-[2rem]`, lưới SVG mờ, vòng tròn lan quanh micro, các thẻ trắng nổi (bài học với sóng âm, avatar chữ cái, điểm Writing, dải tuần có ngọn lửa streak). Chỉ hiện từ `lg`.
- **Đổi phía:** `/register` và trang mã xác thực đến từ đăng ký (`state.authSide = 'right'`, hằng `AUTH_SIDE_RIGHT`) đặt form bên phải; hai nửa trượt đổi chỗ 0,7s. Các trang khác form bên trái.
- Thành phần trong `features/auth/components/AuthCard.jsx`: `AuthCard`, `AuthFields` (hiện lần lượt), `FieldLabel` (nhãn nhỏ thụt `px-5`, có chỗ cho liên kết bên phải), `FieldError`, `PasswordRule`, `AuthLink`, class `authInput`, `authButton`.
- **Kiểm form (D188):** không báo lỗi khi người dùng chưa gõ xong. Enter ở ô email chuyển sang ô mật khẩu (`focusOnEnter`); lỗi chỉ hiện sau khi bấm gửi. Ô đặt mật khẩu mới dùng `PasswordRule` thay cho dòng lỗi.

## 4. Thành phần

Dùng lại theo thứ tự: `src/components/shared` → `src/components/ui` (shadcn) → mới tạo. Không tạo biến thể riêng cho cùng một việc.

| Thành phần | Kiểu |
|---|---|
| Button | shadcn; cỡ `sm h-9`, mặc định `h-10`, `lg h-11`, `xl h-12`; luôn dùng `loading` khi chờ |
| Input | shadcn `h-10 rounded-md`; ở auth thêm `authInput`: `h-12 rounded-full border-transparent bg-muted/60 px-5`, focus nền `bg-background` + vòng `ring-primary/20` |
| Nút auth | `authButton`: `h-12 w-full rounded-full font-semibold`, nhấn co `scale-[0.99]` |
| Card | `rounded-lg border bg-card shadow-sm` |
| FeatureCard | ô biểu tượng `h-11 w-11 rounded-xl` nền tông nhạt (`primary/success/warning/info` `/10`), mũi tên dịch phải khi hover |
| EmptyState | `rounded-xl border-dashed bg-card`, biểu tượng trong vòng `bg-muted` |
| OtpInput | 6 ô, mỗi ô một số, `h-12 sm:h-14 rounded-2xl bg-muted/60`; có số thì `bg-background border-primary/30`; focus nhích lên 2px; sai thì viền `destructive` |
| FieldRule | dòng điều kiện có vòng tròn: xám → `success` có dấu tích khi đạt; `destructive` khi đã gửi mà chưa đạt (dùng cho "Passwords match") |
| NewPasswordFields | ô mật khẩu và ô "Confirm" cạnh nhau (xếp dọc dưới `sm`), bên dưới một hàng checklist: "At least 8 characters" và "Passwords match" (`FieldRule`); dùng chung cho đăng ký, đặt lại mật khẩu, nhận lời mời |
| PasswordRule | dòng điều kiện dưới ô mật khẩu mới: vòng tròn xám → tô `success` có dấu tích khi đủ độ dài; `destructive` chỉ khi đã gửi mà chưa đủ |
| CodeSentTo | dải `rounded-full bg-muted/60` "Code sent to …" + nút Change |
| PublishButton | hiệu ứng mũi tên và mây (`publish-*`) khi xuất bản; dùng cho nút Approve của Content Manager |
| ContentReview | nhãn Draft (`warning`), In review (`info`), Returned (`destructive`); dải trạng thái bản đang soạn; Approve/Return (D191) |
| ReadOnly | context khoá các thành phần soạn khi Content Manager xem; ô media trống hiện "No recording."/"No picture." |
| SectionCard | khu vực trang: tiêu đề + ô biểu tượng, `action` (ArrowLink) hoặc `aside` |
| CircleSwapLink | nút liên kết viên thuốc `h-12`; hover: chấm tròn trượt ra, mũi tên trượt vào (MicroKit) |
| ArrowLink | liên kết phụ; hover: chữ có nền `primary`, mũi tên trượt vào (MicroKit) |
| GlideCards | lưới thẻ liên kết; một lớp sáng trượt theo con trỏ, chỉ thấy trong hình thẻ (MicroKit) |
| ProgressBar | thanh `h-2 rounded-full bg-muted`, chạy từ 0 khi hiện (Motion) |
| CountUp | số đếm lên từ giá trị trước (anime.js), dạng hiển thị qua `format` |
| ScoreRing | vòng điểm; cung vẽ dần và số đếm lên (anime.js); `tone`: primary, success, destructive, inverse |
| Reveal | `RevealGroup`/`RevealItem`: con xuất hiện lần lượt, lệch 0,07s (Motion) |
| GridPattern | lưới SVG mờ cho khối màu chủ đạo |

## 5. Chuyển động

Chia việc theo D187: CSS cho hiệu ứng trang auth và các hiệu ứng cũ; **Motion** cho phần tử React (xuất hiện, hover, thanh tiến độ); **anime.js** cho số và SVG; **MicroKit UI** (đã chép thành component) cho microinteraction của nút, liên kết, thẻ. Không dùng hai thư viện cho cùng một loại hiệu ứng.

| Class | Hiệu ứng | Thời lượng | Dùng ở |
|---|---|---|---|
| `auth-rise` | mờ→rõ, lên 18px, phóng từ 98,5% | 0,7s | Khung auth khi mở trang |
| `auth-in` | mờ→rõ, lên 10px | 0,55s | Tiêu đề, trường form, chân form (lệch 0,06–0,08s) |
| `auth-pop` | bật lên từ 92% | 0,7s | Thẻ nổi xuất hiện (lệch 0,25 / 0,45 / 0,65 / 0,85s) |
| `auth-float` | trôi lên xuống 8px, lặp | 6s | Thẻ nổi sau khi hiện |
| `auth-wave` | co giãn `scaleY` 0,35↔1, lặp | 1,2s | Thanh sóng âm (lệch 0,09s mỗi thanh) |
| `auth-ring` | phóng 0,75→1,35 rồi mờ, lặp | 2,8s | Vòng quanh micro (lệch 0,9s) |
| `publish-arrow/cloud/pop` | mũi tên bay, mây nhún, dấu bật | 0,35–1,8s | `PublishButton` |
| Trượt auth | `transition-transform duration-700 ease-[cubic-bezier(0.65,0,0.35,1)]` | 0,7s | Đổi phía form ↔ hình |
| Nhóm sidebar | `transition-[grid-template-rows] duration-200` | 0,2s | Mở/đóng Practice |
| `RevealGroup/Item` (Motion) | mờ→rõ, lên 16px, lần lượt | 0,55s, lệch 0,07s | Các khu vực Home |
| `ProgressBar` (Motion) | rộng từ 0 | 0,9s, trễ 0,2s | Thanh tiến độ |
| `Stat` hover (Motion) | nâng 3px, lò xo | — | Ô chỉ số |
| Kế hoạch hôm nay (Motion) | trượt từ trái 10px, lần lượt | 0,45s, lệch 0,08s | Việc trong `TodayPlanCard` |
| Ngày streak (Motion) | bật từ 60%, lò xo | lệch 0,05s | `StreakCard` |
| `CountUp` (anime.js) | số đếm lên, `outExpo` | 1,1s | Số trên Home |
| `ScoreRing` (anime.js) | cung vẽ dần + số đếm | 1,3s | Vòng điểm mọi trang |
| `circle-swap`, `arrow-link`, `glide-cards` (MicroKit, CSS) | chấm/mũi tên trượt, lớp sáng trượt | 0,3–0,42s | Nút và liên kết |

Quy tắc:
- Hiệu ứng xuất hiện dùng `cubic-bezier(0.22, 1, 0.36, 1)` (nhanh rồi chậm dần); hiệu ứng lặp dùng `ease-in-out`.
- Chỉ đổi `transform` và `opacity`. Phần tử vừa bật lên vừa trôi thì tách hai lớp (`auth-pop` ngoài, `auth-float` trong) để không đè `transform`.
- Mỗi nhóm class mới phải có khối `@media (prefers-reduced-motion: reduce)` tắt nó; transition Tailwind thêm `motion-reduce:transition-none`.
- Hiệu ứng lặp chỉ dùng cho phần trang trí, không cho nội dung người dùng đang đọc hay nhập.

- Motion: `MotionConfig reducedMotion="user"` trong `main.jsx` lo phần giảm chuyển động; biến thể dùng chung trong `src/lib/motion.js` (`EASE_OUT`, `revealGroup`, `revealItem`).
- anime.js: chạy trong `useLayoutEffect`, dừng (`pause`) khi dọn dẹp, bỏ qua khi `prefersReducedMotion()`.
- MicroKit: thêm component mới thì chép từ https://github.com/henriquegpb/microkit, viết lại JavaScript, đổi màu sang token, bỏ comment, không lấy biến thể glow/gradient/aurora/neon (D153), ghi vào `apps/web-client/THIRD_PARTY_NOTICES.md`.

Phiên bản thư viện: xem mục "Hiệu ứng giao diện" trong [technology-stack.md](technology-stack.md).

### Email gửi mã (D189)

`apps/auth-service/src/auth/email-templates.js`: thẻ trắng `max-width 520px`, bo 28px, viền `#E5E7EB` trên nền `#F3F4F8`; logo ô vuông `#4F46E5` chữ "A"; nhãn viên thuốc nền `#EEF0FF`; tiêu đề 26px; mã 36px chữ đơn cách, giãn chữ 12px, khung `#EEF0FF` bo 18px; nút viên thuốc `#4F46E5`. Chỉ dùng bảng và style inline, không ảnh ngoài, không gradient, `color-scheme: light`.

## 6. Icon và hình

- **Icon chức năng** (sidebar, nút, trạng thái): `lucide-react`, cỡ `h-4 w-4` trong hàng và nút, `h-5 w-5` trong ô biểu tượng.
- **Hình trang trí** (khung auth, minh họa): SVG tự vẽ trong component (ví dụ `MicGlyph`, `BookGlyph`, `PenGlyph`, `FlameGlyph`, `LogoMark`, lưới `Pattern`), nét `strokeWidth 1.8`, đầu nét tròn, màu `currentColor`, có `aria-hidden="true"`.
- Avatar không có ảnh dùng chữ cái đầu trên nền tông nhạt (`Avatar`).

## 7. Ảnh tham khảo

Đặt trong `docs/assets/design/`.

| Ảnh | Áp dụng cho |
|---|---|
| [login-page.webp](../assets/design/login-page.webp) | Bố cục khung auth: nhãn logo, tiêu đề giữa, ô và nút bo tròn, tấm hình bo góc có thẻ nổi |
| `sidebar-design.webp` (chưa có trong repo) | Nhóm sidebar mở xuống bên trong (accordion) |
