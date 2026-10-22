# 600 Essential Words: bộ lesson của chương trình chính

Nội dung của 50 lesson theo bộ từ vựng *600 Essential Words for the TOEIC*
(Barron's): 10 unit, mỗi unit 5 lesson, mỗi lesson 12 từ. Chỉ danh sách từ và
tên lesson lấy từ sách; mọi câu chữ (nghĩa tiếng Việt, câu ví dụ, đoạn điền từ
"Words in Context", bài test 23 câu và giải thích) đều viết mới cho AppEnglish,
không chép từ sách.

| Mỗi lesson | |
|---|---|
| Vocabulary | 12 từ: từ loại, nghĩa tiếng Việt, câu ví dụ và bản dịch. Chưa có phiên âm và audio phát âm. |
| Fill-in | một đoạn văn 130–200 từ, 10–12 chỗ trống `___`, đáp án là từ của lesson (có thể chia dạng). |
| Lesson test | 23 câu đủ 7 part: Part 1–4 có transcript đầy đủ để thu âm, chưa có audio và ảnh; Part 5–7 hoàn chỉnh. Mỗi câu có giải thích tiếng Việt. |

`pack.json` liệt kê unit, lesson, tên file và 12 từ của từng lesson, cùng file
Unit review của mỗi unit (`reviews/NN-slug.json`, D121, D129: 10 câu Part 5 và 3 đoạn
Part 6 mỗi đoạn 3 chỗ trống, 19 câu, ôn các từ của unit). `AUTHORING.md` là quy tắc soạn; `lessons/*.json` là
nội dung; `to-content.mjs` chuyển một file lesson sang đúng shape content-service
lưu.

## Nhập từng file trong trình soạn

Trình soạn lesson và Unit review có nút **Import JSON** / **Export JSON** (D124)
đọc và ghi đúng định dạng này: chọn file, xem phần kiểm tra, bấm thay thế,
rồi Save draft hoặc Publish. Phiên âm, audio và ảnh đã có được giữ.

## Xuất từ hệ thống ra file

```
pnpm --filter @appenglish/content-service export:600-words                 # 10 bài Unit review
pnpm --filter @appenglish/content-service export:600-words -- --lessons    # 50 lesson
```

Ghi version đang xuất bản (hoặc bản nháp) của từng mục ra đúng file trong thư
mục này, để nội dung soạn trong trình soạn không bị lệch với bộ mẫu.

## Kiểm tra

```
cd apps/content-service
pnpm validate:600-words            # mọi lesson
pnpm validate:600-words -- 6 7     # chỉ lesson 6 và 7
pnpm validate:600-words -- reviews # 10 bài Unit review (thêm số unit để chọn)
```

Chạy schema thật và luật xuất bản; chỉ còn các lỗi thiếu audio/ảnh là chấp
nhận được.

## Nhập vào hệ thống

content-service phải đang chạy (`pnpm dev`).

```
pnpm --filter @appenglish/content-service seed:600-words -- --manager-id <id tài khoản Content Manager>
```

- Tạo unit và lesson còn thiếu (tìm theo tên), lưu mỗi lesson làm **bản nháp**;
  không xuất bản gì.
- Unit review của mỗi unit cũng được lưu làm bản nháp (`--reviews` chỉ nhập
  review; review đã đủ 19 câu được giữ nguyên trừ khi `--force`).
- Lesson đã có đủ 12 từ (ví dụ do Content Manager tự soạn) được giữ nguyên;
  thêm `--force` để ghi đè bằng bản nháp mới. `--only 1,2` chỉ nhập các lesson
  đó.
- Khi lesson đã có nội dung, phiên âm và audio phát âm của từ trùng tên, cùng
  audio/ảnh của bài test theo vị trí, được mang sang bản nháp mới để không mất
  file đã tải lên (audio cũ có thể không còn khớp transcript mới: thay lại).

Sau khi nhập, Content Manager mở từng lesson để thêm phiên âm, audio phát âm,
audio Part 1–4 (theo transcript đã có) và ảnh Part 1 (gợi ý ảnh nằm trong
`photoHint` của file lesson), rồi Publish.
