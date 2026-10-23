# writing-service

## Trạng thái xác minh
F13 (D172, D175, D178). App Node mới, không database, không framework; gọi Gemini REST bằng `fetch` có sẵn của Node, chỉ dùng `amqplib` (đã có trong repo) và hai package nội bộ.

## Trách nhiệm
- Chấm bài Writing bằng Gemini với key của chính học viên (key đi kèm job ở dạng mã hóa, mở bằng `GEMINI_KEY_SECRET`).
- Kiểm tra key khi học viên lưu.
- Không lưu gì, không ghi key hay bài làm vào log (log chỉ có mã bài và trạng thái).

## Code
| File | Việc |
|---|---|
| `src/config.js` | `RABBITMQ_URL`, `GEMINI_MODEL` (mặc định `gemini-3.8-flash`), `GEMINI_API_URL`, `GEMINI_TIMEOUT_MS` (90 s), `GEMINI_KEY_SECRET`, `WRITING_CONCURRENCY` (2) |
| `src/gemini.js` | `GeminiClient`: `generateJson` (`POST models/{model}:generateContent`, `systemInstruction`, `generationConfig { temperature: 1, responseMimeType: application/json, responseSchema }`), `checkKey` (`GET models/{model}`); key ở header `x-goog-api-key`. `classify`: 401/403 hoặc `API_KEY_INVALID` → KEY, 429/`RESOURCE_EXHAUSTED` → QUOTA, 5xx/mạng/quá giờ → UNAVAILABLE (thử lại), 400 khác → REJECTED |
| `src/rubric.js` | `SYSTEM`, `SCHEMA`, `buildWritingPrompt` (cấp CEFR, loại bài, giới hạn từ, đề, ý chính, bài mẫu, tiêu chí, thang 1–5, bài làm), `parseWritingResult` (điểm về bước 0,5 trong 1–5, bỏ lỗi không trích đúng bài, nhóm và tổng theo D178 qua `writingScores` của learning-contracts) |
| `src/worker.js` | `gradeWriting` (mở key, gọi Gemini, JSON hỏng thử lại một lần, lỗi cuối thành `FAILED` kèm câu cho học viên; QUOTA/UNAVAILABLE ném ra để thử lại), `checkKey` (VALID / INVALID / UNAVAILABLE; hết hạn mức vẫn VALID) |
| `src/broker.js` | Nhận `writing.grading.requests` (prefetch = `WRITING_CONCURRENCY`, thử lại `.retry.1|2|3`, sau lần cuối gửi `FAILED` rồi chuyển `.dead`), gửi `writing.grading.results`; trả lời `writing.key-checks` theo `replyTo`/`correlationId` |
| `src/main.js` | Dừng khi thiếu `GEMINI_KEY_SECRET` (≥ 32 ký tự); log JSON có `requestId` |

## Messages
| Queue | Hướng | Nội dung |
|---|---|---|
| `writing.grading.requests` | learning-service (outbox) → writing-service | `{ id, type: "writing.requested", occurredAt, requestId?, payload: { submissionId, accountId, prompt: { title, level, taskType, instructions, minWords, maxWords, sampleAnswer, keyPoints }, answer, key: { v, iv, data, tag } } }` |
| `writing.grading.results` | writing-service → learning-service | `{ submissionId, status: "DONE" \| "FAILED", result?, error?, requestId? }`; `result`: `{ criteria{7}, scores: { vocabulary, grammar, coherence, task, total }, feedback, errors: [{ text, suggestion, explanation }], rewrite }` |
| `writing.key-checks` | learning-service → writing-service (request/reply, hết hạn 25 s) | `{ key: { v, iv, data, tag } }` → `{ status: "VALID" \| "INVALID" \| "UNAVAILABLE", reason? }` |

## Lệnh
```
pnpm --filter @appenglish/writing-service dev    # cũng chạy bởi pnpm dev
pnpm --filter @appenglish/writing-service test   # không gọi Gemini thật, không cần broker
```

## Giới hạn
- Gemini không nghe giọng và có thể chấm sai; giao diện ghi "Scored by Gemini; it can be wrong."
- Gói miễn phí của Google có thể dùng dữ liệu gửi lên để cải thiện sản phẩm; giao diện báo trước khi dán key.

## Speaking open answers (F14, D179)

A job with `type: "speaking.grading.requested"` on `writing.grading.requests` carries `{ submissionId, accountId, prompt: { title, level, instructions, maxSeconds, sampleAnswer, keyPoints }, answer: <transcript>, durationSeconds, key }`. It is graded with `OPEN_SYSTEM` (a transcript, not audio: ignore punctuation and fillers, do not judge pronunciation), `OPEN_SCHEMA` and `buildOpenSpeakingPrompt` on four criteria (task, vocabulary, grammar, coherence); `parseOpenSpeakingResult` returns `{ criteria, feedback, errors, rewrite }` without a total. Results, including the final FAILED after the last retry, go to `writing.open-speaking.results`. Tests: `test/open-speaking.test.js`.

## Evaluation and load test (F16, D181)

- `src/metrics.js` (Pearson, Spearman, MAE, QWK on half points), `src/ellipse.js` (CSV reader, seeded sample, evaluation job without a sample answer, overall from six criteria), `scripts/evaluate-ellipse.mjs` (`evaluate:ellipse`, needs `GEMINI_EVAL_KEY`).
- `scripts/load-test.mjs` (`load-test`): the real broker on temporary queues with a local fake Gemini and a worker restart. `WritingBroker` now takes `config.queues` and `config.retryDelays` (defaults: the shared queues and D168 delays).
- Consumer callbacks catch errors from a closed channel; the unacknowledged job is redelivered.
- Results: `docs/05-operations/ai-evaluation.md`. Tests: `test/evaluate.test.js`.

## Status port (D182)

`src/status-server.js` listens on `127.0.0.1:${WRITING_SERVICE_PORT}` (default 3005) with `GET /metrics` (Prometheus text from the shared registry: `grading_jobs_total{task,status}`, `grading_job_seconds`, `key_checks_total{status}`, `messages_handled_total`, process figures) and `GET /health`. The gateway's System overview reads it. Tests: `test/status-server.test.js`.
