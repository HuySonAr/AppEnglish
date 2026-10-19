"""One auto-time request handled from start to end (D97), without RabbitMQ:
the broker loop gives the request and sends what this returns."""

from __future__ import annotations

import os
import tempfile
import urllib.parse
import urllib.request

from .alignment import align_lines, split_lines

MAX_AUDIO_BYTES = 200 * 1024 * 1024


def download(url: str) -> str:
    """Saves the recording at url to a temporary file and returns its path."""
    suffix = os.path.splitext(urllib.parse.urlparse(url).path)[1] or ".audio"
    handle, path = tempfile.mkstemp(suffix=suffix)
    # Some storage hosts refuse requests without a user agent.
    request = urllib.request.Request(url, headers={"User-Agent": "appenglish-speech-service/1.0"})
    try:
        with os.fdopen(handle, "wb") as file, urllib.request.urlopen(request, timeout=120) as response:
            size = 0
            while chunk := response.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_AUDIO_BYTES:
                    raise ValueError("The recording is larger than 200 MB")
                file.write(chunk)
    except BaseException:
        # The file is closed by now (the with block ended), so it can go.
        if os.path.exists(path):
            os.remove(path)
        raise
    return path


def process(request: dict, transcribe, fetch=download, cache=None) -> dict:
    """The answer to one request.

    task "align" (Auto-time, D97): {jobId, audioUrl, language, lines: [{id, text}]};
    the answer has the times of those lines [{id, start, end, matched}].
    task "transcribe" (D98): {jobId, audioUrl, language, kind}; the answer has
    new lines [{text, start, end}], cut as lyrics when kind is "song".
    transcribe(path, language, prompt) returns the words heard
    [{"word", "start", "end"}]; fetch(url) returns a local file path; cache
    (WordCache, optional) keeps the words heard by recording, so a second job
    on it does not listen again (D99).
    The answer is DONE, or FAILED with a reason.
    """
    job_id = request.get("jobId")
    task = request.get("task", "align")
    path = None
    try:
        lines = [{"id": line["id"], "text": line["text"]} for line in request.get("lines") or []]
        if task == "align" and not lines:
            raise ValueError("No lines to time")
        words = cache.get(request["audioUrl"]) if cache else None
        if words is None:
            path = fetch(request["audioUrl"])
            # The transcript as a prompt helps Whisper spell names and rare words.
            prompt = " ".join(line["text"] for line in lines)[:800]
            words = transcribe(path, request.get("language") or "en", prompt)
            if words and cache:
                cache.put(request["audioUrl"], words)
        if not words:
            return {"jobId": job_id, "status": "FAILED", "error": "No speech was heard in the recording."}
        if task == "transcribe":
            return {"jobId": job_id, "status": "DONE", "lines": split_lines(words, song=request.get("kind") == "song")}
        return {"jobId": job_id, "status": "DONE", "lines": align_lines(lines, words)}
    except Exception as error:  # noqa: BLE001 - every failure goes back to the editor
        return {"jobId": job_id, "status": "FAILED", "error": f"{type(error).__name__}: {error}"[:500]}
    finally:
        if path and fetch is download and os.path.exists(path):
            os.remove(path)
