# Listening course: bộ nội dung demo

Nội dung gốc viết cho AppEnglish (không lấy từ nguồn có bản quyền), dùng để
Content Manager có sẵn giáo trình nghe A1 → C1 (F05C, D100–D105).
Đây chỉ là bộ chạy thử: nội dung chính thức của Listening course soạn từ bộ sách
Cambridge English Skills *Real Listening & Speaking* (D106).

| Mỗi cấp (A1, A2, B1, B2, C1) | |
|---|---|
| 1 unit × 3 bài học | mỗi bài: 1 bản ghi, 4 từ khóa (nghĩa tiếng Việt), 1 câu ý chính, 2 câu chi tiết, 2 câu để chép |
| Unit check | 1 bản ghi, 5 câu |
| Level test | 2 bản ghi, 8 câu |
| Listening placement | 3 câu/cấp trên bản ghi của Unit check (tổng 15 câu) |

Tổng: 30 bản ghi, 125 câu hỏi có giải thích. Tốc độ đọc chậm dần từ C1 về A1.

## Tệp

- `content.py`: kịch bản, câu hỏi, đáp án, giải thích, từ khóa. Sửa nội dung ở đây.
- `build.py`: tạo `audio/*.mp3`, `audio/*.srt` và `pack.json`.
  - Mỗi câu được đọc bằng giọng Windows (Zira cho Woman, David cho Man) rồi cắt khoảng lặng.
  - Các câu được ghép với quãng nghỉ 0,6 giây, nên mốc thời gian từng câu là chính xác.
  - Thứ tự đáp án được xáo cố định, chạy lại vẫn ra cùng thứ tự.
- `audio/`: 30 file MP3 (khoảng 7,6 MB) và file `.srt` tương ứng. Có thể nhập tay bằng "Import timed file" trong trình soạn Listening library.
- `pack.json`: toàn bộ dữ liệu cho script nhập.

## Tạo lại âm thanh (khi sửa content.py)

Cần Windows (PowerShell, System.Speech) và ffmpeg trên PATH.

```
cd content-samples/listening-course
python build.py
```

## Nhập vào hệ thống

content-service phải đang chạy (`pnpm dev`), vì file âm thanh được tải lên
kho media đã cấu hình trong `.env`.

```
pnpm --filter @appenglish/content-service seed:listening-course -- --manager-id <id tài khoản Content Manager>
```

Script làm qua đúng các RPC mà trang của Content Manager dùng:

1. Tạo chủ đề "Listening course (demo)" (dạng TOEIC).
2. Tạo 30 bài nghe đã xuất bản trong Listening library.
3. Với mỗi cấp, tạo và xuất bản unit và Level test.
4. Tạo và xuất bản Listening placement.

Chạy lại không tạo trùng: mục cùng tên được dùng lại, mục đã xuất bản giữ
nguyên. Không có `--manager-id` thì người tạo được ghi bằng một id demo cố định.

Sau khi nhập, Content Manager vẫn sửa được mọi thứ trong trình soạn như nội dung tự tạo.
