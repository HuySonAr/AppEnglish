
from __future__ import annotations

import base64
import io
import logging
import os
import wave

from .config import Settings

log = logging.getLogger("speech-service")

_VOWELS = set("aeiouyæɐɑɒɔəɛɜɪʊʌɚɝɨʉɯɤøœɶɵɞᵻ")
_MARKS = set("ːˑ̩̯̃ʲ")
_STRESS = {"ˈ", "ˌ"}


_SYMBOLS = {"ɹ": "r", "ɛ": "e", "ᵻ": "ɪ", "ɾ": "t", "ʲ": "", "ɐ": "ə"}

_ONSETS = {
    "pl", "pr", "bl", "br", "tr", "dr", "kl", "kr", "ɡl", "ɡr", "fl", "fr", "θr", "ʃr",
    "sp", "st", "sk", "sm", "sn", "sl", "sw", "sf", "spl", "spr", "str", "skr", "skw", "skj", "spj",
    "tw", "dw", "kw", "ɡw", "θw", "sw",
    "pj", "bj", "tj", "dj", "kj", "ɡj", "mj", "nj", "fj", "vj", "hj", "lj", "sj", "θj",
}


def _dictionary_symbols(text: str) -> str:
    out: list[str] = []
    for index, char in enumerate(text):
        if char == "a" and text[index + 1 : index + 2] not in ("ɪ", "ʊ"):
            out.append("æ")
        else:
            out.append(_SYMBOLS.get(char, char))
    return "".join(out)


def _sounds(consonants: str) -> list[str]:
    sounds: list[str] = []
    for char in consonants:
        if char in "ʃʒ" and sounds and sounds[-1] in ("t", "d"):
            sounds[-1] += char
        else:
            sounds.append(char)
    return sounds


def _onset_length(consonants: str) -> int:
    sounds = _sounds(consonants)
    for take in range(len(sounds), 0, -1):
        group = sounds[-take:]
        if take == 1 and group[0] != "ŋ" or "".join(group) in _ONSETS:
            return len("".join(group))
    return 0


def _syllables(word: str) -> int:
    count, inside = 0, False
    for char in word:
        vowel = char in _VOWELS
        if vowel and not inside:
            count += 1
        inside = vowel or (inside and char in _MARKS)
    return count


def _place_stress(word: str) -> str:
    moved: list[str] = []
    for char in word:
        if char not in _STRESS:
            moved.append(char)
            continue
        at = len(moved)
        while at > 0 and moved[at - 1] not in _VOWELS and moved[at - 1] not in _MARKS and moved[at - 1] not in _STRESS:
            at -= 1
        group = "".join(moved[at:])
        start = at if at == 0 else len(moved) - _onset_length(group)
        moved.insert(start, char)
    text = "".join(moved)
    return "".join(char for char in text if char not in _STRESS) if _syllables(text) <= 1 else text


def format_ipa(phonemes: list[list[str]]) -> str:
    words: list[str] = []
    for sentence in phonemes:
        text = _dictionary_symbols("".join(sentence))
        words.extend(_place_stress(word) for word in text.split())
    return f"/{' '.join(words)}/" if words else ""


def wav_to_mp3(wav_bytes: bytes, bit_rate: int = 64000) -> bytes:
    import av

    source = av.open(io.BytesIO(wav_bytes), format="wav")
    out = io.BytesIO()
    target = av.open(out, mode="w", format="mp3")
    stream = target.add_stream("libmp3lame", rate=source.streams.audio[0].rate)
    stream.bit_rate = bit_rate
    stream.layout = "mono"
    for frame in source.decode(audio=0):
        for packet in stream.encode(frame):
            target.mux(packet)
    for packet in stream.encode(None):
        target.mux(packet)
    target.close()
    source.close()
    return out.getvalue()


class Pronouncer:

    def __init__(self, settings: Settings):
        self.settings = settings
        self.voices: dict = {}

    def voice(self, accent: str):
        if accent not in self.voices:
            from piper import PiperVoice

            name = self.settings.voices[accent]
            path = os.path.join(self.settings.voices_dir, f"{name}.onnx")
            if not os.path.exists(path):
                from piper.download_voices import download_voice

                os.makedirs(self.settings.voices_dir, exist_ok=True)
                log.info("Downloading Piper voice %s", name)
                download_voice(name, self.settings.voices_dir)
            self.voices[accent] = PiperVoice.load(path)
        return self.voices[accent]

    def __call__(self, text: str, accent: str) -> tuple[str, bytes]:
        voice = self.voice(accent)
        ipa = format_ipa(voice.phonemize(text))
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav_file:
            voice.synthesize_wav(text, wav_file)
        return ipa, wav_to_mp3(buffer.getvalue())


def process_pronounce(request: dict, pronounce) -> dict:
    word = (request.get("word") or "").strip()
    accents = [accent for accent in request.get("accents") or ["uk", "us"] if accent in ("uk", "us")]
    if not word:
        return {"status": "FAILED", "error": "No word to pronounce"}
    try:
        phonetic: dict = {}
        audio: dict = {}
        for accent in accents:
            ipa, mp3 = pronounce(word, accent)
            phonetic[accent] = ipa
            audio[accent] = base64.b64encode(mp3).decode("ascii")
        return {"status": "DONE", "word": word, "phonetic": phonetic, "audio": audio}
    except Exception as error:  # noqa: BLE001 - every failure goes back to content-service
        return {"status": "FAILED", "error": f"{type(error).__name__}: {error}"[:500]}
