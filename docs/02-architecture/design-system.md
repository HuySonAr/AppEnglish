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

Nguồn: `src/styles/index.css` (biến CSS HSL trong `:root` / `.dark`, ánh xạ sang màu Tailwind trong `@theme inline`, D222; không còn `tailwind.config.js`). Dùng class Tailwind theo token, không viết mã màu trực tiếp.

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

### Thanh cuộn
- Thanh cuộn chính của trang theo kiểu ChatGPT: `html { scrollbar-width: thin; scrollbar-color: hsl(var(--primary) / 0.5) transparent }`; trình duyệt tự vẽ thanh mảnh khoảng 10px, thanh kéo bo tròn, rãnh trong suốt, trên Windows có mũi tên nhỏ hai đầu (không tự vẽ mũi tên bằng ảnh vì ảnh SVG không đọc được token màu).
- Vùng cuộn bên trong (Chrome/Edge/Safari): `::-webkit-scrollbar` 3px, thanh `hsl(var(--primary) / 0.5)` bo tròn, hover `hsl(var(--primary))`, không nút mũi tên; `body * { scrollbar-color: auto }` (trong `@supports selector(::-webkit-scrollbar)`) để màu của `html` không truyền xuống, vì Chrome/Edge 121+ bỏ qua `::-webkit-scrollbar` khi phần tử có `scrollbar-color`/`scrollbar-width`. Firefox (`@supports not selector(::-webkit-scrollbar)`) dùng `scrollbar-width: thin` cùng màu cho mọi vùng. Trang auth vẫn ẩn thanh cuộn (`auth-scroll`).

## 3. Bố cục

### Trang trong ứng dụng (`SidebarLayout`)
- Trên màn hình nhỏ, nút mở menu (drawer) nằm bên phải header cho mọi vai trò (học viên, giáo viên, Content Manager, admin); sidebar máy tính vẫn bên trái.
- Sidebar rộng `w-64` (`lg:pl-64`), header cao `h-16` dính trên cùng, viền dưới.
- Sidebar chia **mục có tiêu đề** (`text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80`), khai báo trong `src/app/navigation.js` (`sections`).
- Hàng sidebar: `rounded-xl px-3 py-2.5 text-sm font-medium`; đang chọn `bg-primary/10 text-primary`, hover `bg-accent`.
- Nhóm có mục con (Practice): **bấm để mở/đóng**, không mở khi hover; tự mở khi đang ở trang con. Mục con treo trên **một đường kẻ thẳng** (`ml-5 border-l pl-3`), mục đang mở có chevron phải. Mở/đóng bằng chuyển `grid-template-rows` 200ms.
- Chân sidebar một hàng: avatar + tên + email (dẫn tới Profile), nút giao diện sáng/tối và đăng xuất dạng icon.
- Lề nội dung `main`: `px-4` (điện thoại), `sm:px-5`. Thanh dính đầu trình soạn/trang thi kéo ra đúng bằng lề đó (`-mx-4 px-4 sm:-mx-5 sm:px-5`); kéo rộng hơn sẽ sinh thanh cuộn ngang.
- `<fieldset>` bọc khung soạn phải có `min-w-0`: mặc định `fieldset` rộng tối thiểu bằng nội dung (bảng, chuỗi dài) và đẩy trang tràn ngang trên điện thoại.
- Lưới chứa ô tải file hoặc chữ dài phải khai báo cột (`grid-cols-1` trên điện thoại, rồi `lg:grid-cols-[minmax(0,1fr)_…]`): lưới không khai báo cột tự nới theo tên file dài và đẩy trang tràn ngang.
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

### Trình soạn đề Speaking (D217)
- Dạng câu ghi trên một hàng: nhãn "Task type:" rồi tên dạng câu (chữ thường `text-sm font-medium`, không khung khi đã cố định theo Part); nút dạng câu, nút Level và nút tốc độ giọng máy cùng cỡ `h-7 px-2.5 text-xs`.
- Chọn tốc độ giọng máy: nhãn `text-xs`, nút Slow / Normal / Natural `h-7 px-2.5 text-xs` bằng các nút công cụ.
- Trang danh sách đề Speaking của giáo viên: 5 Part trên **một hàng** `grid-cols-5` ở mọi cỡ màn hình; điện thoại mỗi ô chỉ "Part n" + số đề (ô đang chọn viền `primary`, số trên nền `primary`), dòng dưới ghi "Part n: tên dạng câu · Questions …"; từ `sm` mỗi ô thêm tên dạng câu và số câu.
- Thanh đầu trình soạn (dính trên cùng): dưới `sm` chỉ hai hàng — hàng 1 tiêu đề `text-base` (chấm `info` khi chưa lưu) và các nút dạng icon (Preview, Save) cùng nút "Send"; hàng 2 là dạng câu · mức · v{n} và nhãn trạng thái. Từ `sm` giữ tiêu đề `text-xl`, nhãn "Unsaved" và nút đủ chữ.
- Mỗi khung `rounded-xl border bg-card p-4`; hàng đầu là dạng câu (trái) và tốc độ giọng máy (phải). Ô chữ và ô tải lên đặt cùng hàng từ `lg` (`grid lg:grid-cols-[minmax(0,1fr)_17rem]`): Part 1 "Text to read" + audio mẫu; Part 2 hai cột `lg:grid-cols-[minmax(0,1fr)_20rem]`: trái là Sample answer, dưới là audio đọc mẫu; phải là ảnh (`MediaInput fill`) cao bằng cột trái (ô tải lên hoặc ảnh xem trước co giãn theo, tối thiểu `min-h-48`); không có Instructions; Part 3 câu hỏi chiếm cả hàng (không có audio câu hỏi), bài mẫu + audio đọc mẫu; Part 4 có câu hỏi (kèm ô "Bản dịch tiếng Việt" bên dưới) + audio câu hỏi trên một hàng cao bằng nhau (`AudioSlot stretch`), rồi bài mẫu + audio đọc mẫu như Part 3; Part 3–4 không có Instructions (D219). Ô audio (`AudioSlot`) có nút "Machine voice" khi chưa có file; nút đổi thành "Making…" (vòng xoay) hoặc "Waiting…" khi đang chờ lượt, các nút khác vẫn bấm được, Save / Send tạm khoá tới khi xong (D220). Khi ô chữ và ô audio đứng cạnh nhau (Part 1 "Text to read", bài mẫu Part 3) hai cột cao bằng nhau: ô chữ giãn theo (`flex-1 resize-none`, tối thiểu 5,5–7rem), ô tải lên giãn theo khi ô chữ cao hơn (`AudioSlot stretch`). Dưới bài mẫu là danh sách câu (`SentenceTimes`) theo cách của trình soạn Listening (`RecordingEditor`): hàng đầu "Sentences" + nhãn "n/N timed" + nút Auto-time; trình phát audio hiện rõ kèm "Player at m:ss.s" (ô tải lên không hiện trình phát thứ hai); Auto-time xong hiện khung kết quả "Auto-time found x of N sentences" với **Apply times** / **Dismiss**, chưa tự điền; mỗi câu có bản dịch, ô Start/End dạng `m:ss.s` với nút tăng/giảm 0,1 giây (hai mũi tên nhỏ xếp dọc giữa ô và nút Here) và nút **Here** lấy giờ đang phát; trong ô, phím ↑/↓ đổi 0,1 giây, Shift+↑/↓ đổi 1 giây, không xuống dưới 0 (`TimeField` dùng chung với trình soạn Listening, End Here điền luôn Start câu sau nếu trống), nút Play từng câu, viền `primary` khi đang phát, viền `warning` + nhãn "Check timing" khi Auto-time không chắc. Key points là lưới `sm:grid-cols-2 lg:grid-cols-4`, mỗi ô có số thứ tự và nút xoá, ô cuối là nút thêm viền đứt.

### Trang luyện Speaking (đề đang làm)
- Đầu trang có nút "Exit" (icon X, `outline sm`) bên phải, cạnh "Your attempts", về đúng danh sách Part của đề (`?part=n`); breadcrumb "Speaking" và "Part n" cũng về Part đó, kể cả từ màn hình kết quả và trang lịch sử.
- Cột đề không lặp tên đề (đã có ở `h1`) và không hiện yêu cầu "Describe a picture." của Part 2 (đã có trong dòng "Question 3: Describe a picture").
- Thẻ đề trong danh sách Speaking: đề có ảnh (Part 2) hiện ảnh đầu thẻ `aspect-[16/9] object-cover`, phóng nhẹ khi hover.
- Cột phải bộ 3 câu: câu hỏi `text-sm sm:text-base font-medium`, bản dịch `text-xs sm:text-sm` nghiêng; bước chuẩn bị có nút "Start speaking now". Bài mẫu Part 3/4 ẩn sau một nút `outline sm` "Sample answers (3)" (mũi tên xoay, danh sách mở bằng hiệu ứng cao 0→auto) (D221).
- Bài mẫu Part 2–3 (D217) nằm trong cột đề, dưới ảnh/bối cảnh: khối `rounded-lg border bg-muted/30`, mặc định **thu gọn**; cả hàng tiêu đề (nhãn "Sample answer" hoặc "Sample · Question n" kèm câu hỏi) là nút bấm với chữ Show/Hide và icon mắt bên phải. Mở ra thì dưới đường kẻ là `ReadingBlock` gọn (Read sample `h-7`, tốc độ, Bilingual, chữ `text-sm sm:text-base`); ẩn đi thì audio dừng; phát một khối thì các khối khác dừng. Tiêu đề trong `ReadingBlock` rộng tối thiểu `10rem` để các nút xuống hàng trên màn hẹp thay vì đè lên chữ.
- Đầu trang gọn: `PageBreadcrumb` (Practice › Speaking), rồi một hàng gồm tiêu đề đề `h1 text-lg font-semibold` (cắt dòng khi dài), nhãn mức và dạng câu · chủ đề; tab Practice/History nằm bên phải cùng hàng (`PracticeTabs` nhận `toolbar`).
- Từ `lg`: hai cột trong vùng cao vừa màn hình (`h-[calc(100dvh-12rem)]`, tối thiểu `24rem`), trang không cuộn. Khung chỉ cao theo nội dung (`items-start`, `max-h-full`), cuộn bên trong khi dài. Khung gọn: `rounded-xl border bg-card p-4 sm:p-5`, không đổ bóng. Cột trái là đề (đoạn đọc `text-lg sm:text-xl`, hoặc yêu cầu và hình `max-h-[50dvh]`, hoặc bối cảnh và bảng thông tin); cột phải rộng `23rem` gồm khu ghi âm (công tắc bỏ đếm giờ, mốc thời gian ETS, nút micro `h-12`) và kết quả mới nhất.
- Dưới `lg`: các khối xếp dọc theo thứ tự đề → ghi âm → kết quả.
- Không có thanh phát cố định cuối màn hình (bỏ `ModelAudio` ngày 2026-10-29, D221): audio mẫu đọc to phát bằng nút "Read sample" trong đề; audio câu hỏi bộ 3 câu tự phát trong khung ghi âm (`QuestionAudio`), không nghe lại ở thanh dưới.
- Màn hình kết quả (`SpeakingResultScreen`, D203): cùng đầu trang gọn; trong lúc chấm là khung chờ `max-w-md` căn giữa (spinner, danh sách bước có trạng thái xong / đang làm / chờ); xong thì kết quả `max-w-3xl` với nút "Other prompts" và "Practice again". Nhận xét AI có `LanguageSwitch` English / Tiếng Việt (viên thuốc như `SpeedSwitch`).

### Banner trang luyện Listening / Speaking / Writing (D216)
- Danh sách luyện TOEIC Listening, TOEIC Speaking và TOEIC Writing (qua prop `banner` của `PracticePromptList`) dùng `PracticeBanner` (`src/components/shared/PracticeBanner.jsx`) thay `PageHeader`, theo ảnh "TOEIC Listening Practice Banner": khung phẳng `rounded-xl border bg-card`, `p-4 sm:px-6 sm:py-5`, không gradient hay đốm màu. Trái: viên eyebrow `bg-primary/10` chữ hoa 11px có icon, `h1` `text-2xl sm:text-3xl font-extrabold` ("TOEIC" + từ nhấn màu `primary`), mô tả một câu `text-sm sm:text-base`, từ `md` thêm ba điểm nổi bật (vòng icon `h-9` nền `tone/10`, tên `text-sm font-semibold`, chú thích `text-xs`). Phải: hình minh hoạ `h-20 sm:h-28 lg:h-36`, `rounded-lg`, giữ nền gốc của file. Cao khoảng 145px trên điện thoại, 195px trên máy tính.
- Hình: `src/svg/Listening Education.svg`, `src/svg/Speaking Education.svg`, `src/svg/Writing Education.svg` (người dùng cung cấp, VTracer, giữ màu gốc) dùng bằng `<img>` như logo.
- Word memory không dùng banner (trang làm bài ngay, cần gọn): header giữ chiều cao cũ, chỉ thay vòng icon não bằng hình `src/svg/Word Memory.svg` `h-11 w-11 rounded-lg border` (D216).

### Luyện nghe TOEIC (D206)
- Danh sách (2026-10-28): mỗi Test là một thẻ `rounded-2xl border bg-card` có ô biểu tượng `bg-primary`, tên, số bài · số câu và `ProgressBar` phần trăm; bên trong lưới 4 ô Part (`rounded-xl border bg-background`, icon riêng mỗi Part: Image, MessagesSquare, Users, Megaphone; số câu `text-3xl` đếm lên; `ProgressBar` mảnh; chân ô "Not started / n/N done / Completed" và "Start / Continue / Practise again →"). Part chưa có bài là ô viền đứt mờ. Hiệu ứng: `RevealGroup`/`RevealItem` cho từng Test và từng ô Part; ô Part nhấc 3px khi rê chuột (lò xo Motion); ô hoàn thành viền và icon `success`.
- Màn hình luyện (`PartPractice`): từ `lg` hai cột `minmax(0,1fr)_20rem`. Trái: khung phát (thanh sóng theo câu, câu trước / nút phát tròn / câu sau ở giữa, chọn tốc độ 0.75x · 1x · 1.25x dạng viên thuốc chữ 10px bên phải; không có Replay đếm lượt và Loop từ 2026-10-28) và khung làm bài (`ModeSwitch`, câu với ô điền hoặc ô chép trong nền `bg-muted/30`, hàng Reveal 1/2/3/All, Check/Next). Phải: danh sách câu (chú thích màu, Redo wrong, tab Ex, lưới số câu `grid-cols-6`: đang học `primary`, xong `success/10`, sai `destructive/10`, chưa làm `muted`). Thanh dưới dính đáy: phím tắt và nút n/N bật/tắt danh sách.
- Hiệu ứng màn hình luyện (Motion): khung phát, khung làm bài và danh sách câu hiện lần lượt (`RevealGroup`); đổi câu thì câu cũ trượt ra trái, câu mới trượt vào (`AnimatePresence`, 0,22s); Check đúng thì khung câu nảy nhẹ, sai thì rung ngang (`useAnimate`); dòng thông báo mờ dần đổi nội dung; vòng sáng quanh số câu đang học trượt theo (`layoutId`).
- D207: khung phát gọn — `WaveStrip` cao `h-9`, mỗi câu một đoạn vạch sóng (biên độ thật hoặc mô phỏng), nút phát tròn `h-9`, các nút phụ `h-8` kiểu ghost; công tắc 30/50/100% nhỏ nằm phải; câu là hàng ô `h-7 text-sm` rộng theo độ dài từ; nút con mắt hiện một từ; số câu bên phải tròn `h-9 w-9 rounded-full`.
- Soạn: trang Listening tests, mỗi Test 4 cột Part (danh sách bài, trạng thái duyệt, "Add exercise").

### Trang Word memory (theo mẫu "Pastel Vocabulary Quiz Dashboard")
- Gọn trong một màn hình: đầu trang ô biểu tượng tròn `h-10 bg-primary/10`, tiêu đề `text-xl font-bold`, mô tả một câu; bên phải thẻ nhỏ "From your lessons" (số câu, số câu đúng).
- Thẻ tiến độ mảnh `px-4 py-2 text-sm`: "Question n / N", thanh `h-1.5` màu `primary`, phần trăm đã trả lời.
- Từ `lg` hai cột: trái là câu hỏi (nhãn viên thuốc "Question n" + hướng dẫn, đề `text-lg font-semibold`, bốn lựa chọn xếp dọc `px-3 py-2 text-sm` có vòng chữ cái `h-7`; đúng `success/10` + dấu tích, sai `destructive/10`). Phải là thẻ từ sau khi chọn (từ `text-2xl text-primary`, phiên âm, nút phát âm UK/US, loại từ, nghĩa), ô ví dụ `bg-muted/40`, ô bài học nguồn `bg-warning/10`; đúng/sai chỉ hiện trên đáp án, không lặp lại. Trước khi chọn, cột phải là `RoundPanel`: lời nhắc, ba ô Right / Wrong / Left, lưới số câu (đúng xanh, sai đỏ, đang làm màu chính) và phím tắt.
- Thanh điều hướng dưới cùng (dính đáy khi cuộn): "Previous" và "Next word" / "See the results".

### Trang auth (`AuthLayout`)
Tham khảo: [login-page.webp](../assets/design/login-page.webp).

- Nền ngoài `bg-muted/70`; một **khung lớn** `max-w-6xl rounded-[2.5rem] border bg-card shadow-2xl`, chia đôi **bằng nhau** trên màn hình rộng.
- **Chiều cao cố định (D189):** từ `lg` khung cao `min(46rem, 100dvh − 4rem)`, trang không cuộn; mọi trang auth dùng cùng kích thước, nội dung dài cuộn trong nửa form. Form phải vừa khung mà không cuộn: tiêu đề `pb-6`, các ô cách nhau `space-y-4`, chân form `mt-6`, vùng nội dung `py-6`. Form đặt mật khẩu mới rộng `max-w-md`, hai ô mật khẩu nằm cạnh nhau từ `sm`. Màn hình rộng nhưng thấp (≥1024px, cao ≤820px) dùng biến thể Tailwind `short:` để thu nhỏ khoảng cách, tiêu đề `1.75rem` và ô OTP `h-12`; nửa form ẩn thanh cuộn (`auth-scroll`). Trang mã xác thực gộp "Resend code" vào chân form.
- **Nửa form:** nhãn logo dạng viên thuốc (`src/svg/graduation.svg`) + `ThemeToggle` trên cùng; form `max-w-sm` căn giữa; tiêu đề căn giữa `text-3xl`; liên kết chân form kiểu "Have an account? Sign in".
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
| PageBreadcrumb | mỗi mục là một ô bo `rounded-md` cùng cỡ nút công cụ (`h-7 px-2 text-xs` mọi màn hình), ngăn bằng chevron `›` 12px `muted-foreground/60`; mục có link nền `muted/60` chữ `muted-foreground`, bóng `shadow-sm` chỉ ở chế độ sáng, hover nền `muted` chữ `foreground`; mục hiện tại (cuối) nền `primary/10` chữ `primary` `font-medium`; mục nhận `icon` tuỳ chọn; tên dài cắt "…" (theo ảnh Breadcrumb1, màu theo token, 2026-10-29) |
| PassageText | đoạn chữ hiển thị từng dòng `whitespace-pre-wrap` (dòng trống giữ cao `1lh`), dòng `<center>` / `<right>` căn giữa / phải, hiểu `**đậm**` và `*nghiêng*` cả ngoài bảng; bảng viền bo `rounded-lg`, hàng đầu nền `muted/50` chữ thường (đậm khi người soạn dùng `**`), ô gộp ngang căn giữa, hàng một ô trải hết bảng nền `muted/30` chữ đậm, `**…**` đậm, `*…*` nghiêng, `<br>` xuống dòng |
| TableTool | đặt **cùng hàng với nhãn ô, bên phải** (prop `actions` của `Field` / `TextField`; màn hẹp tự xuống dưới nhãn), nút chữ nhỏ `h-7/h-8 text-xs` có icon và chữ: nhóm "Bold" / "Italic" và nhóm "Left" / "Center" / "Right" viền mảnh (với `targetId`, áp lên chữ hoặc dòng đang chọn của ô đó), "Add table", "Edit table n" (`outline sm`, icon bảng) và "Edit table n" (`ghost`); hộp thoại `max-w-4xl`: thanh công cụ cùng cỡ bên ngoài (`h-7/h-8 text-xs`, icon + chữ): Upload CSV, nhóm Row / Column, nhóm Bold / Italic, nhóm Merge → / Unmerge, kích thước "r × c" bên phải; bảng `table-fixed` mỗi cột mặc định 160px, kéo tay cầm mép phải tiêu đề cột để đổi 80–480px (chỉ khi soạn, không lưu); lưới ô `Input h-8 min-w-[7rem]` trong khung cuộn `max-h-[55dvh]`, hàng đầu nền `muted` (không tự in đậm), thanh định dạng cho ô đang chọn (B, I, "Merge →", "Unmerge"), ô là `Textarea` một dòng tự cao theo số dòng (Enter xuống dòng), ô đã gộp hiện khung viền đứt "← merged", nút X xoá cột ở trên và xoá hàng bên trái, chân hộp thoại "Remove table" (đỏ, trái) và Cancel / Insert table hoặc Save table (phải) |
| AnswerProgress | thân hộp thoại nộp/rời bài (`TestExam`): nút X tròn góc phải; hàng đầu gồm hình minh hoạ trong ô `h-14 rounded-2xl` nền nhạt (`ClipboardAlert` màu `warning` khi còn câu chưa làm, `ClipboardCheck` màu `success` khi đủ, `DoorExit` màu `destructive` khi rời bài) cạnh tiêu đề `text-base font-semibold` và mô tả `text-xs`; dưới là "Answered n / N" và thanh `h-1.5`; các số câu chưa làm dạng viên tròn đỏ nhạt căn phải, tối đa 4 rồi "+N". Chân hộp thoại các nút chia đều, Submit màu `primary` có icon gửi |
| Pronunciation | nút viên thuốc `rounded-full border bg-card p-1 shadow-sm`: cờ tròn (`country-flag-icons` 1x1, `h-5` → `sm:h-6`), nhãn US/UK chỉ từ `md` (≥768px), ô loa tròn `bg-muted` → `bg-primary/10 text-primary` khi đang phát; US đứng trước UK (D204) |

### Hình minh hoạ SVG
- Mỗi hình là một component riêng trong `src/components/illustrations/` (một file một hình, `index.js` export tất cả); trang chỉ import, không viết SVG thẳng vào component nghiệp vụ.
- Khung `viewBox="0 0 48 48"`, nhận `className` để đặt cỡ, luôn `aria-hidden="true"` (chữ bên cạnh đã nói nội dung).
- Màu theo token: nét và mảng chính dùng `currentColor` (`fill-current`, `stroke-current`, độ đậm nhạt bằng `fillOpacity`/`strokeOpacity`), phần "giấy" và viền cắt của huy hiệu dùng `fill-card`/`stroke-card` (`paintOrder="stroke"`), nên hình tự đổi theo trạng thái và chế độ tối. Không dùng mã màu cứng hay gradient.
- Phần dùng chung giữa các hình tách thành component nội bộ (ví dụ `ClipboardBase`).
- Logo ứng dụng: file `src/svg/graduation.svg` (mũ tốt nghiệp nhiều màu do người dùng cung cấp, giữ màu gốc) dùng thẳng bằng `<img src={logoUrl} alt="">` (import file SVG qua Vite), không chuyển sang JSX vì không cần đổi màu. Dùng ở `Brand` (sidebar, header di động, `h-9`, không còn ô nền `primary`) và nhãn logo trang auth (`h-7`); `index.html` dùng cùng file làm biểu tượng tab (`<link rel="icon" type="image/svg+xml" href="/src/svg/graduation.svg">`). Thay file này là đổi cả logo lẫn icon tab. Hình cần đổi màu theo trạng thái mới viết thành component JSX.
- Hiện có: `ClipboardAlert`, `ClipboardCheck`, `DoorExit` (hộp thoại nộp/rời bài). Ba hình này do người dùng cung cấp (2026-10-28, file `canh-bao.svg`, `complete.svg`, `doorexit.svg`, vẽ lại từ ảnh bằng VTracer), chuyển nguyên sang JSX với `viewBox="0 0 512 512"` và **giữ màu gốc**, là ngoại lệ của quy tắc màu theo token ở trên.

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
| Trang luyện Speaking (Motion) | đầu trang hạ xuống 6px; cột đề và cột ghi âm `RevealGroup/Item`; ảnh đề phóng từ 98% | 0,4–0,55s | `SpeakingPromptPage`, `SpeakingTaskCard` |
| Bài mẫu Show/Hide (Motion) | cao 0→auto + mờ→rõ, mũi tên xoay 180° | 0,35s (cao), 0,25s (mờ) | `SampleBlock` |
| Đổi Bilingual / bật tắt giờ (Motion) | `AnimatePresence mode="wait"`: mờ + lệch 6–8px | 0,22–0,25s | `ReadAloudText`, khung ghi âm |
| Tô câu đang đọc | `transition-colors duration-300` | 0,3s | `ReadAloudText` |
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
- **Hình trang trí** (khung auth, minh họa): SVG tự vẽ trong component (ví dụ `MicGlyph`, `BookGlyph`, `PenGlyph`, `FlameGlyph`, lưới `Pattern`), nét `strokeWidth 1.8`, đầu nét tròn, màu `currentColor`, có `aria-hidden="true"`.
- Avatar không có ảnh dùng chữ cái đầu trên nền tông nhạt (`Avatar`).

## 7. Ảnh tham khảo

Đặt trong `docs/assets/design/`.

| Ảnh | Áp dụng cho |
|---|---|
| [login-page.webp](../assets/design/login-page.webp) | Bố cục khung auth: nhãn logo, tiêu đề giữa, ô và nút bo tròn, tấm hình bo góc có thẻ nổi |
| `sidebar-design.webp` (chưa có trong repo) | Nhóm sidebar mở xuống bên trong (accordion) |
