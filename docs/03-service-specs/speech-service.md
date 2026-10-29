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
| `speech_service/cache.py` | `WordCache`: the words heard, by recording address and model, as JSON files (D99). `AudioCache`: machine voices (`<key>.mp3` + `<key>.json` with the IPA), key = sha256 of cache version, voice, accent, speed and text (D220) |
| `speech_service/worker.py` | One request end to end: download (200 MB cap), transcribe without a prompt, align; answer DONE or FAILED. Words that cover less than `MIN_HEARD_SHARE` (0.5) of the line tokens are neither cached nor reused from the cache (D214) |
| `speech_service/transcriber.py` | faster-whisper, model loaded on the first request |
| `speech_service/broker.py` | pika loop: one request at a time (prefetch 1), work in a thread while heartbeats go on, answer RUNNING then DONE/FAILED, ack after answering, reconnect on failure |
| `speech_service/config.py` | Environment |

## Messages (RabbitMQ, durable queues on the default exchange)

| Queue | Producer → consumer | Body (JSON) |
|---|---|---|
| `speech.autotime.requests` | content-service → speech-service | `{ jobId, task, audioUrl, language: "en", kind, lines }`: task `align` (Auto-time) with `lines: [{ id, text }]` (song lines without their brackets); task `transcribe` (D98) with no lines |
| `speech.pronounce.requests` | content-service → speech-service (D123) | `{ word, accents?: ["uk", "us"], wordsPerMinute?, sentencePauseSeconds? }` with `reply_to` and `correlation_id` set; the answer goes to `reply_to` with the same `correlation_id`: `{ status: "DONE", word, phonetic: { uk, us }, audio: { uk, us } }` (IPA with slashes; MP3 as base64) or `{ status: "FAILED", error }` |
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
| `PIPER_VOICE_UK`, `PIPER_VOICE_US` | `en_GB-cori-medium`, `en_US-lessac-medium` | Piper voices for pronunciation (D123) |
| `PIPER_VOICES_DIR` | `apps/speech-service/.cache/voices` | Where the voices are kept; a missing voice is downloaded from Hugging Face on first use (about 60 MB each) |
| `PRONOUNCE_WORKERS` | `2` (1–3) | Processes that make machine voices and pronunciations in parallel (D220) |
| `SPEECH_AUDIO_CACHE_DIR` | `apps/speech-service/.cache/audio` | Machine voices already made, by voice, accent, speed and text (D220); delete it to make them again |

The model is downloaded from Hugging Face on first use (about 480 MB for
`small.en`) and cached in the user's profile.

Pronunciation (D123) runs in `speech_service/pronounce.py` on its own thread
and connection: `Pronouncer` loads one Piper voice per accent, `format_ipa`
turns espeak phonemes into dictionary-style IPA (D148): espeak's own symbols
become the dictionaries' ones (ɐ→ə, ɹ→r, ɛ→e, ᵻ→ɪ, ɾ→t, British a→æ but not
in aɪ/aʊ), the stress mark goes to the start of the stressed syllable (only
consonants that can begin an English syllable move with it, so "enjoy" is
/enˈdʒɔɪ/), and one-syllable words carry no mark, `wav_to_mp3` encodes with
PyAV (libmp3lame, 64 kbit/s mono), `process_pronounce` answers one request.
A word takes well under a second after the first load.
With `wordsPerMinute` (clamped 60–220) and `sentencePauseSeconds` (0–2), `Pronouncer` reads sentence by sentence, joins them with that pause, and tunes Piper `length_scale` (0.8–1.5, at most `SPEED_PASSES` = 3 passes) until the whole clip is near the rate (D200); without them it reads as before.

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

## Delivery (D168)

Requests carry `requestId` (also header `x-request-id`); every answer carries it back and has its own `message_id`. A request is acked only after the answer is published. A request redelivered after the worker stopped is put back once with header `x-attempt`; if it is redelivered again it goes to `speech.autotime.requests.dead` and the job is answered `FAILED` ("The speech worker stopped twice on this recording.").

## Speaking read aloud (F12, D177)

`speech_service/speaking.py`: `heard_words` joins Whisper's apostrophe pieces and keeps the lowest probability; `score_read_aloud(text, words)` aligns the prompt words (whitespace words, normalised with `alignment.tokens`) with the heard tokens using difflib `equal` blocks only, gives each prompt word `correct` / `mispronounced` / `missing` (worst of its tokens) or `null` for punctuation-only words, lists unmatched heard words as `extra`, and scores Accuracy, Completeness, Fluency and Total with `READ_ALOUD_SCORING` in `config.py` (values in D177). `process_speaking(message)` reads the learning outbox envelope (`payload.submissionId`, `payload.audioUrl`, `payload.text`), downloads the recording, transcribes it without a prompt and answers `{ submissionId, status: "DONE", result }` or `{ submissionId, status: "FAILED", error }`.

The transcriber now returns each word's `probability` and holds a lock, because the auto-time and speaking threads share one Whisper model.

| Queue | Direction | Body |
|---|---|---|
| `speech.speaking.requests` | learning-service → speech-service | Outbox envelope `{ id, type: "speaking.requested", occurredAt, requestId?, payload: { submissionId, kind, audioUrl, text } }` |
| `speech.speaking.results` | speech-service → learning-service | `{ submissionId, status, result?, error?, requestId? }`; `result`: `{ words: [{ text, status, confidence }], extra[], scores: { accuracy, completeness, fluency, total }, wordsPerMinute, pauses, heard }` |

The speaking loop runs on its own thread and connection, one recording at a time, with the same redelivery rule as auto-time (`speech.speaking.requests.dead` after two worker stops, answering FAILED). Tests: `tests/test_speaking.py`. Restart the worker after updating.

## Speaking open answers (F14, D179)

`score_open_speaking(words)` in `speech_service/speaking.py` (no prompt text): the transcript, `fillers` (words made only of `OPEN_SPEAKING_SCORING.fillers`), `words` (the rest), Pronunciation = 10 × mean probability of the non-filler words, Fluency from `fluency()` with `OPEN_SPEAKING_SCORING` (pause from 1.0 s, rate 70–170 words per minute counting fillers) minus 0.2 per filler (at most 2). A recording with only fillers fails. `process_speaking` picks it when `payload.kind` is `open_speaking`; the answer goes on `speech.speaking.results` as `{ submissionId, status: "DONE", result: { transcript, scores: { fluency, pronunciation }, wordsPerMinute, pauses, fillers, words } }`.

## Accuracy evaluation (F16, D181)

`speech_service/evaluate.py` (`pnpm --filter @appenglish/speech-service evaluate -- --root <speechocean762>`): `load_speechocean` (resource/scores.json, `test/text`, WAVE files), seeded `sample`, `run` with the real transcriber and `score_read_aloud`, `compare` (Pearson, Spearman, MAE). See `docs/05-operations/ai-evaluation.md`. Tests: `tests/test_evaluate.py`.

## Parallel machine voices (D220)

- `speech.pronounce.requests` is served by `PRONOUNCE_WORKERS` separate processes (`multiprocessing` spawn), each with its own Piper voices and `prefetch_count=1`; RabbitMQ hands requests round robin. Processes, not threads, because Piper phonemizes with espeak-ng, which is not safe across threads.
- A supervisor thread in the main process starts them and starts a stopped one again every 10 s; each worker exits when the main process is gone (it waits on `multiprocessing.parent_process()`), so a hard kill leaves no worker behind. `__main__.py` runs only under `if __name__ == "__main__"` so the spawned workers do not start the service again.
- Measured on the development machine (8 logical CPUs, 4 sample answers at 145 words per minute): 1 worker 16.9 s, 2 workers 10.7 s, 3 workers 14.3 s, 4 workers 20.5 s; limiting onnxruntime threads per worker was slower. Hence the default 2 and the cap 3.
- `Pronouncer(settings, cache)` reads and writes `AudioCache`; a cached voice comes back in about 0.03 s instead of 4–6 s.
- content-service waits 120 s for an answer and publishes each request with `expiration` = that wait, so a request nobody waits for any more leaves the queue instead of being made.

