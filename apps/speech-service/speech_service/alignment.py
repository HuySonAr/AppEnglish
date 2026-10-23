
from __future__ import annotations

import difflib
import math
import re

_IRREGULAR_NOT = {"won't": ["will", "not"], "can't": ["can", "not"], "cannot": ["can", "not"], "shan't": ["shall", "not"]}
_SUFFIXES = {"'m": "am", "'re": "are", "'ve": "have", "'ll": "will", "'d": "would"}
_S_WORDS = {"it", "he", "she", "that", "there", "here", "what", "where", "who", "how", "when", "why", "this", "let"}
_NUMBERS = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "seven": "7",
    "eight": "8", "nine": "9", "ten": "10", "eleven": "11", "twelve": "12", "thirteen": "13", "fourteen": "14",
    "fifteen": "15", "sixteen": "16", "seventeen": "17", "eighteen": "18", "nineteen": "19", "twenty": "20",
    "thirty": "30", "forty": "40", "fifty": "50", "sixty": "60", "seventy": "70", "eighty": "80", "ninety": "90",
}


def tokens(text: str) -> list[str]:
    out: list[str] = []
    text = text.replace("’", "'").replace("‘", "'").lower()
    for raw in re.split(r"[\s\-–—/]+", text):
        if re.fullmatch(r"[^a-z0-9]*\d[\d,.:]*[^a-z0-9]*", raw):
            word = re.sub(r"^[^0-9]+|[^0-9]+$", "", raw).replace(",", "")
            if word:
                out.append(word)
            continue
        word = re.sub(r"[^a-z0-9']", "", raw).strip("'")
        if not word:
            continue
        if word in _IRREGULAR_NOT:
            out.extend(_IRREGULAR_NOT[word])
        elif word.endswith("n't") and len(word) > 3:
            out.extend([word[:-3], "not"])
        elif word == "let's":
            out.extend(["let", "us"])
        else:
            suffix = next((s for s in _SUFFIXES if word.endswith(s) and len(word) > len(s)), None)
            if suffix:
                out.extend([word[: -len(suffix)], _SUFFIXES[suffix]])
            elif word.endswith("'s") and word[:-2] in _S_WORDS:
                out.extend([word[:-2], "is"])
            else:
                out.append(_NUMBERS.get(word, word))
    return out


def _round_down(value: float) -> float:
    return math.floor(value * 10) / 10


def _round_up(value: float) -> float:
    return math.ceil(value * 10) / 10


def align_lines(lines: list[dict], words: list[dict], *, before: float = 0.1, after: float = 0.2) -> list[dict]:
    line_tokens: list[tuple[str, int]] = []
    for index, line in enumerate(lines):
        line_tokens.extend((token, index) for token in tokens(line["text"]))
    joined: list[dict] = []
    for word in words:
        text = word["word"].strip()
        if joined and text[:1] in ("'", "’") and len(text) > 1:
            joined[-1] = {"word": joined[-1]["word"] + text, "start": joined[-1]["start"], "end": word["end"]}
        else:
            joined.append({"word": text, "start": word["start"], "end": word["end"]})
    heard: list[tuple[str, float, float]] = []
    for word in joined:
        for token in tokens(word["word"]):
            heard.append((token, float(word["start"]), float(word["end"])))

    times: list[tuple[float, float] | None] = [None] * len(line_tokens)
    exact = [False] * len(line_tokens)
    matcher = difflib.SequenceMatcher(a=[t for t, _ in line_tokens], b=[t for t, _, _ in heard], autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                times[i1 + k] = heard[j1 + k][1:]
                exact[i1 + k] = tag == "equal"

    result = []
    for index, line in enumerate(lines):
        own = [i for i, (_, at) in enumerate(line_tokens) if at == index]
        timed = [times[i] for i in own if times[i] is not None]
        matched = sum(1 for i in own if exact[i]) / len(own) if own else 0.0
        start = min(t[0] for t in timed) if timed else None
        end = max(t[1] for t in timed) if timed else None
        result.append({"id": line["id"], "start": start, "end": end, "matched": round(matched, 2)})

    previous_end = 0.0
    for index, line in enumerate(result):
        if line["start"] is None:
            continue
        start = max(line["start"] - before, previous_end, 0.0)
        following = next((later["start"] for later in result[index + 1:] if later["start"] is not None), None)
        end = line["end"] + after
        if following is not None:
            end = min(end, max(following, line["end"]))
        line["start"] = _round_down(start)
        line["end"] = max(_round_up(end), line["start"] + 0.1)
        previous_end = line["end"]
    return result


_JOINING = {"that", "and", "but", "or", "if", "when", "because", "so", "as", "than", "where", "while"}


def _song_phrases(words: list[dict], long_pause: float = 1.5) -> list[list[dict]]:
    phrases: list[list[dict]] = []
    current: list[dict] = []
    for word in words:
        text = word["word"]
        capital = text[:1].isupper() and not re.match(r"I(?![a-z])", text)
        bare_i = text.rstrip(",.?!") == "I"
        joined = bool(current) and re.sub(r"[^a-z]", "", current[-1]["word"].lower()) in _JOINING
        if current and (
            (capital and len(current) >= 2)
            or (bare_i and len(current) >= 6 and not joined)
            or word["start"] - current[-1]["end"] >= long_pause
        ):
            phrases.append(current)
            current = []
        current.append(word)
        if re.search(r"[.?!][\"')\]]*$", text):
            phrases.append(current)
            current = []
    if current:
        phrases.append(current)
    return phrases


def _song_lines(words: list[dict], short: int = 7, longest: int = 14) -> list[list[dict]]:
    lines: list[list[dict]] = []
    current: list[dict] = []
    for phrase in _song_phrases(words):
        pause = phrase[0]["start"] - current[-1]["end"] if current else 0.0
        if current and len(current) < short and len(current) + len(phrase) <= longest and pause < 1.5:
            current = current + phrase
        else:
            if current:
                lines.append(current)
            current = list(phrase)
    if current:
        lines.append(current)
    return lines


def _speech_lines(words: list[dict], pause: float = 1.2, longest: int = 30) -> list[list[dict]]:
    lines: list[list[dict]] = []
    current: list[dict] = []
    for word in words:
        if current and (word["start"] - current[-1]["end"] >= pause or len(current) >= longest):
            lines.append(current)
            current = []
        current.append(word)
        if re.search(r"[.?!][\"')\]]*$", word["word"]):
            lines.append(current)
            current = []
    if current:
        lines.append(current)
    return lines


def split_lines(words: list[dict], *, song: bool = False, before: float = 0.1, after: float = 0.2) -> list[dict]:
    heard = [
        {"word": word["word"].strip(), "start": float(word["start"]), "end": float(word["end"])}
        for word in words
        if word["word"].strip()
    ]
    lines = _song_lines(heard) if song else _speech_lines(heard)

    result = []
    for index, line in enumerate(lines):
        text = " ".join(item["word"] for item in line)
        text = re.sub(r" (?=['\u2019][a-z])", "", text)
        start = max(line[0]["start"] - before, result[-1]["end"] if result else 0.0, 0.0)
        end = line[-1]["end"] + after
        if index + 1 < len(lines):
            end = min(end, max(lines[index + 1][0]["start"], line[-1]["end"]))
        start = _round_down(start)
        result.append({"text": text, "start": start, "end": max(_round_up(end), start + 0.1)})
    return result
