# Đánh giá độ chính xác AI và kiểm thử tải (F16, D181)

## Speaking đọc to – Speechocean762

Dữ liệu: kho `speechocean762` (CC BY 4.0) gồm `resource/scores.json` (điểm chuyên gia 0–10: accuracy, completeness, fluency, total) và `WAVE/`. Tải về máy rồi chạy:

```
pnpm --filter @appenglish/speech-service evaluate -- --root <thư mục speechocean762> --limit 150 --seed 762 --out speechocean762-report
```

Script lấy ngẫu nhiên có seed các câu của tập `test`, chạy Whisper (`WHISPER_MODEL`) và `score_read_aloud` như hệ thống, ghi `speechocean762-report.json` (Pearson, Spearman, MAE từng tiêu chí) và `.csv` từng câu. Completeness trong dữ liệu dạng 0–1 được đổi sang 0–10.

## Writing – ELLIPSE

Dữ liệu: `ELLIPSE_Final_github.csv` của ELLIPSE Corpus (bài luận của học sinh học tiếng Anh, điểm chuyên gia 1–5 bước 0,5: cohesion, syntax, vocabulary, phraseology, grammar, conventions, overall). Chạy bằng key Gemini của người phát triển (không dùng key học viên):

```
GEMINI_EVAL_KEY=<key> pnpm --filter @appenglish/writing-service evaluate:ellipse -- --csv ELLIPSE_Final_github.csv --limit 150 --seed 2024 --delay 7000
```

Script dùng cùng `SYSTEM`, `SCHEMA`, `buildWritingPrompt`, `parseWritingResult` và `GEMINI_MODEL`; đề lấy cột `prompt`, cấp B1, không có bài mẫu. So sáu tiêu chí và overall (trung bình sáu tiêu chí làm tròn 0,5) bằng Pearson, Spearman, MAE, QWK. `--delay` giữ dưới hạn mức phút của gói miễn phí; lỗi hết hạn mức chờ 30 s, 60 s, 90 s rồi bỏ qua bài.

## Kết quả

| Đánh giá | Ngày | Mẫu | Kết quả |
|---|---|---|---|
| Speechocean762 | — | — | Chưa chạy (cần tải dữ liệu) |
| ELLIPSE | — | — | Chưa chạy (cần dữ liệu và key Gemini của người phát triển) |

## Kiểm thử tải và chịu lỗi luồng chấm Writing

```
pnpm --filter @appenglish/writing-service load-test -- --jobs 200 --concurrency 4
```

Chạy writing-service thật trên RabbitMQ local với hàng đợi tạm `loadtest.<id>.*` (xóa khi xong), thời gian thử lại rút còn 0,3 s, 0,6 s, 1,2 s, và một Gemini giả trên máy: trễ 50–400 ms, 10% trả 429, 5% trả 503, 5% JSON hỏng. Khi xong 30% bài, worker bị dừng và chạy lại. Đạt khi mọi bài có đúng một kết quả.

| Ngày | Bài | Song song | Có kết quả | Mất | Trả hai lần | DONE / FAILED | Thời gian | Bài/giây | Độ trễ p50 / p95 |
|---|---|---|---|---|---|---|---|---|---|
| 2026-10-23 | 200 | 4 | 200 | 0 | 0 | 199 / 1 | 17,1 s | 11,7 | 9,1 s / 16,2 s |
| 2026-10-23 | 400 | 8 | 400 | 0 | 0 | 400 / 0 | 17,7 s | 22,6 | 8,7 s / 16,3 s |

Độ trễ tính từ lúc gửi tất cả bài cùng lúc, nên phần lớn là thời gian chờ trong hàng; bài FAILED là bài hết cả ba lần thử lại. Lần chạy đầu tiên làm worker sập khi dừng giữa chừng (ack trên kênh đã đóng); đã sửa ở mọi consumer (D181). Luồng Whisper chưa kiểm thử tải vì chạy model trên CPU; speech-service xử lý một bản ghi mỗi lúc cho mỗi luồng.
