# Speech service

## Trạng thái xác minh

VERIFIED 2026-10-14 (D97): unit tests of the alignment and of one request;
a real run through RabbitMQ on a published song (18 lines, all timed, about
130 s on a CPU) and on a generated talk (4 sentences, all matched).

## Trách nhiệm

`speech-service` finds the start and end of every line of a listening
exercise in its recording ("Auto-time" in the Content Manager's editor). It
is a worker: no HTTP or gRPC surface, no database. It reads requests from
RabbitMQ, downloads the recording, runs faster-whisper (word timestamps) and
aligns the words heard with the transcript, so the lines keep their text and
a misheard word does not lose a line.

Code: `apps/speech-service/` (Python 3.12).

| File | Role |
|---|---|
| `speech_service/alignment.py` | Pure: tokens (case, punctuation, contractions, numbers as digits), `align_lines` (difflib matching, line span from first to last matched word, small padding, no overlap) and `split_lines` for Transcribe: speech by sentence (ends, pauses of 1.2 s, at most 30 words); songs in phrases started by Whisper's capitals (a bare "I" after six words unless a joining word comes before, a long pause of 1.5 s), short phrases put together up to 14 words (D99) |
| `speech_service/cache.py` | `WordCache`: the words heard, by recording address and model, as JSON files (D99) |
| `speech_service/worker.py` | One request end to end: download (200 MB cap), transcribe with the transcript as prompt, align; answer DONE or FAILED |
| `speech_service/transcriber.py` | faster-whisper, model loaded on the first request |
| `speech_service/broker.py` | pika loop: one request at a time (prefetch 1), work in a thread while heartbeats go on, answer RUNNING then DONE/FAILED, ack after answering, reconnect on failure |
| `speech_service/config.py` | Environment |

## Messages (RabbitMQ, durable queues on the default exchange)

| Queue | Producer → consumer | Body (JSON) |
|---|---|---|
| `speech.autotime.requests` | content-service → speech-service | `{ jobId, task, audioUrl, language: "en", kind, lines }`: task `align` (Auto-time) with `lines: [{ id, text }]` (song lines without their brackets); task `transcribe` (D98) with no lines |
| `speech.autotime.results` | speech-service → content-service | `{ jobId, status: "RUNNING" \| "DONE" \| "FAILED", lines?, error? }`. align: `lines: [{ id, start, end, matched }]`, times in seconds (one decimal) or null when the line was not heard, `matched` the share (0–1) of the line's words heard. transcribe: `lines: [{ text, start, end }]` |

Queue names and statuses are in `@appenglish/content-contracts` (`SpeechQueue`,
`AutoTimeStatus`) and repeated in `speech_service/config.py`.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `RABBITMQ_URL` | `amqp://localhost:5672` | Broker (shared `.env`) |
| `WHISPER_MODEL` | `small.en` | faster-whisper model; `base.en` faster, `medium.en` finer |
| `WHISPER_DEVICE` | `cpu` | `cuda` with an NVIDIA GPU |
| `WHISPER_COMPUTE_TYPE` | `int8` | CTranslate2 compute type |
| `WHISPER_VAD_FILTER` | `false` | Skip non-speech parts before transcribing |
| `SPEECH_CACHE_DIR` | `apps/speech-service/.cache/words` | Words heard by recording (D99); delete it to make the service listen again |

The model is downloaded from Hugging Face on first use (about 480 MB for
`small.en`) and cached in the user's profile.

## Commands

```
pnpm --filter @appenglish/speech-service python:setup   # .venv + requirements.txt
pnpm --filter @appenglish/speech-service dev            # the worker (also started by pnpm dev)
pnpm --filter @appenglish/speech-service test           # unittest, needs no model and no broker
```

`run.mjs` runs the service's `.venv` Python (or `python` on the PATH) with the
repository's `.env` loaded.

## Limits

- The recording must have a public address (R2/ImageKit); locally stored
  files are refused by content-service.
- Songs: Whisper may stretch a line's last word over the music after it; the
  editor marks lines longer than 12 s, or less than 80% heard, "Check timing".
- No time limit per job inside the worker; content-service shows a job
  without an answer after 30 minutes as failed.
- Transcribe (D98) gives a draft: on the song "Proud of you" 27 lines close to
  the lyrics in about 106 s, with a few lines split at a breath or joined,
  and a few misheard words to correct.
- `pnpm dev` starts the worker only when `.venv` exists; otherwise `run.mjs`
  prints how to set it up and exits with 0 so the other services keep running.
- A second job on the same recording uses the cached words (D99): Auto-time
  after Transcribe took 0.01 s instead of about 108 s on "Proud of you".
  Python does not reload code: restart the worker (`pnpm dev`) after changing it.
