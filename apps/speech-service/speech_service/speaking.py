from __future__ import annotations

import difflib
import math
import os

from .alignment import tokens
from .config import OPEN_SPEAKING_SCORING, READ_ALOUD_SCORING
from .worker import download

_RANK = {"correct": 0, "mispronounced": 1, "missing": 2}


def _one_decimal(value: float) -> float:
    return math.floor(value * 10 + 0.5) / 10


def heard_words(words: list[dict]) -> list[dict]:
    joined: list[dict] = []
    for word in words:
        text = str(word.get("word") or "").strip()
        probability = float(word.get("probability", 1.0))
        if not text:
            continue
        if joined and text[:1] in ("'", "’") and len(text) > 1:
            last = joined[-1]
            joined[-1] = {"word": last["word"] + text, "start": last["start"], "end": float(word["end"]), "probability": min(last["probability"], probability)}
        else:
            joined.append({"word": text, "start": float(word["start"]), "end": float(word["end"]), "probability": probability})
    return joined


def fluency(joined: list[dict], scoring: dict = READ_ALOUD_SCORING) -> dict:
    if not joined:
        return {"score": 0.0, "pauses": 0, "wordsPerMinute": 0}
    pauses = sum(1 for before, after in zip(joined, joined[1:]) if after["start"] - before["end"] > scoring["pause_seconds"])
    duration = joined[-1]["end"] - joined[0]["start"]
    rate = len(joined) / duration * 60 if duration > 0 else 0.0
    limits = scoring["rate"]
    rate_penalty = 0.0
    if duration >= 1.0:
        if rate < limits["min"]:
            rate_penalty = min(limits["penalty_max"], (limits["min"] - rate) / limits["words_per_point"])
        elif rate > limits["max"]:
            rate_penalty = min(limits["penalty_max"], (rate - limits["max"]) / limits["words_per_point"])
    score = max(0.0, 10 - min(scoring["pause_penalty_max"], pauses) - rate_penalty)
    return {"score": _one_decimal(score), "pauses": pauses, "wordsPerMinute": round(rate)}


def score_read_aloud(text: str, words: list[dict], scoring: dict = READ_ALOUD_SCORING) -> dict:
    display = text.split()
    reference: list[tuple[str, int]] = []
    for index, word in enumerate(display):
        reference.extend((token, index) for token in tokens(word))
    if not reference:
        raise ValueError("The prompt has no words to read")
    joined = heard_words(words)
    heard: list[tuple[str, int]] = []
    for index, word in enumerate(joined):
        heard.extend((token, index) for token in tokens(word["word"]))

    confidence: list[float | None] = [None] * len(reference)
    matched_heard: set[int] = set()
    matcher = difflib.SequenceMatcher(a=[t for t, _ in reference], b=[t for t, _ in heard], autojunk=False)
    for tag, i1, i2, j1, _j2 in matcher.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                confidence[i1 + k] = joined[heard[j1 + k][1]]["probability"]
                matched_heard.add(j1 + k)

    def status_of(value: float | None) -> str:
        if value is None:
            return "missing"
        return "correct" if value >= scoring["confidence"] else "mispronounced"

    shown = []
    for index, word in enumerate(display):
        values = [confidence[k] for k, (_, at) in enumerate(reference) if at == index]
        if not values:
            shown.append({"text": word, "status": None, "confidence": None})
            continue
        status = max((status_of(value) for value in values), key=lambda item: _RANK[item])
        found = [value for value in values if value is not None]
        shown.append({"text": word, "status": status, "confidence": round(min(found), 2) if found else None})

    extra: list[str] = []
    for index in sorted({heard[k][1] for k in range(len(heard)) if k not in matched_heard}):
        word = joined[index]["word"].strip(".,!?;:\"()[]")
        if word and word not in extra:
            extra.append(word)

    found = [value for value in confidence if value is not None]
    accuracy = 10 * sum(found) / len(found) if found else 0.0
    completeness = 10 * len(found) / len(reference)
    flow = fluency(joined, scoring) if found else {"score": 0.0, "pauses": 0, "wordsPerMinute": 0}
    weights = scoring["weights"]
    total = weights["accuracy"] * accuracy + weights["completeness"] * completeness + weights["fluency"] * flow["score"]
    return {
        "words": shown,
        "extra": extra,
        "scores": {
            "accuracy": _one_decimal(accuracy),
            "completeness": _one_decimal(completeness),
            "fluency": flow["score"],
            "total": _one_decimal(total),
        },
        "wordsPerMinute": flow["wordsPerMinute"],
        "pauses": flow["pauses"],
        "heard": " ".join(word["word"] for word in joined)[:1000],
    }


def score_open_speaking(words: list[dict], scoring: dict = OPEN_SPEAKING_SCORING) -> dict:
    joined = heard_words(words)
    fillers = set(scoring["fillers"])
    spoken = [word for word in joined if not (tokens(word["word"]) and all(token in fillers for token in tokens(word["word"])))]
    filler_count = len(joined) - len(spoken)
    if not spoken:
        raise ValueError("No words were heard in the recording")
    pronunciation = 10 * sum(word["probability"] for word in spoken) / len(spoken)
    flow = fluency(joined, scoring)
    penalty = min(scoring["filler_penalty_max"], filler_count * scoring["filler_penalty"])
    return {
        "transcript": " ".join(word["word"] for word in joined)[:4000],
        "scores": {"fluency": _one_decimal(max(0.0, flow["score"] - penalty)), "pronunciation": _one_decimal(pronunciation)},
        "wordsPerMinute": flow["wordsPerMinute"],
        "pauses": flow["pauses"],
        "fillers": filler_count,
        "words": len(spoken),
    }


def process_speaking(message: dict, transcribe, fetch=download) -> dict:
    payload = message.get("payload") if isinstance(message.get("payload"), dict) else message
    submission_id = payload.get("submissionId")
    path = None
    try:
        open_answer = payload.get("kind") == "open_speaking"
        text = str(payload.get("text") or "").strip()
        if not open_answer and not text:
            raise ValueError("The prompt has no text to read")
        path = fetch(payload["audioUrl"])
        words = transcribe(path, "en", "")
        if not words:
            return {"submissionId": submission_id, "status": "FAILED", "error": "No speech was heard in the recording."}
        result = score_open_speaking(words) if open_answer else score_read_aloud(text, words)
        return {"submissionId": submission_id, "status": "DONE", "result": result}
    except Exception as error:  # noqa: BLE001 - every failure goes back to learning-service
        return {"submissionId": submission_id, "status": "FAILED", "error": f"{type(error).__name__}: {error}"[:500]}
    finally:
        if path and fetch is download and os.path.exists(path):
            os.remove(path)
