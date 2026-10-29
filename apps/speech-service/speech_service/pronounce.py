
from __future__ import annotations

import base64
import io
import logging
import os
import wave

from .config import Settings

log = logging.getLogger("speech-service")

MIN_LENGTH_SCALE = 0.8
MAX_LENGTH_SCALE = 1.5
MIN_WORDS_PER_MINUTE = 60
MAX_WORDS_PER_MINUTE = 220
MAX_PAUSE_SECONDS = 2.0
SPEED_PASSES = 3

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


AUDIO_CACHE_VERSION = 1


class Pronouncer:

    def __init__(self, settings: Settings, cache=None):
        self.settings = settings
        self.voices: dict = {}
        self.cache = cache

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

    def __call__(self, text: str, accent: str, speed: dict | None = None) -> tuple[str, bytes]:
        if not self.cache:
            return self.synthesize(text, accent, speed)
        key = self.cache.key(AUDIO_CACHE_VERSION, self.settings.voices.get(accent), accent, speed, text)
        found = self.cache.get(key)
        if found:
            return found
        ipa, mp3 = self.synthesize(text, accent, speed)
        self.cache.put(key, ipa, mp3)
        return ipa, mp3

    def synthesize(self, text: str, accent: str, speed: dict | None = None) -> tuple[str, bytes]:
        voice = self.voice(accent)
        ipa = format_ipa(voice.phonemize(text))
        if not speed:
            buffer = io.BytesIO()
            with wave.open(buffer, "wb") as wav_file:
                voice.synthesize_wav(text, wav_file)
            return ipa, wav_to_mp3(buffer.getvalue())
        from piper import SynthesisConfig

        words = count_words(text)
        chunks = list(voice.synthesize(text))
        pauses = speed["pause"] * max(0, len(chunks) - 1)
        scale = 1.0
        for _ in range(SPEED_PASSES):
            next_scale = length_scale(words, chunk_seconds(chunks), pauses, speed["rate"], scale)
            if abs(next_scale - scale) < 0.02:
                break
            scale = next_scale
            chunks = list(voice.synthesize(text, SynthesisConfig(length_scale=(voice.config.length_scale or 1.0) * scale)))
        return ipa, wav_to_mp3(join_chunks(chunks, speed["pause"]))


def chunk_seconds(chunks) -> float:
    return sum(len(chunk.audio_int16_bytes) / (chunk.sample_width * chunk.sample_channels * chunk.sample_rate) for chunk in chunks)


def join_chunks(chunks, pause: float) -> bytes:
    first = chunks[0]
    frame = first.sample_width * first.sample_channels
    silence = b"\x00" * (int(first.sample_rate * pause) * frame)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setframerate(first.sample_rate)
        wav_file.setsampwidth(first.sample_width)
        wav_file.setnchannels(first.sample_channels)
        wav_file.writeframes(silence.join(chunk.audio_int16_bytes for chunk in chunks))
    return buffer.getvalue()


def count_words(text: str) -> int:
    return len([word for word in text.split() if any(ch.isalnum() for ch in word)])


def length_scale(words: int, speech_seconds: float, pause_seconds: float, words_per_minute: int, current: float = 1.0) -> float:
    if words < 1 or speech_seconds <= 0 or words_per_minute <= 0:
        return current
    wanted = words * 60 / words_per_minute - pause_seconds
    return round(min(MAX_LENGTH_SCALE, max(MIN_LENGTH_SCALE, current * wanted / speech_seconds)), 3)


def read_speed(request: dict) -> dict | None:
    rate = request.get("wordsPerMinute")
    if isinstance(rate, bool) or not isinstance(rate, (int, float)):
        return None
    pause = request.get("sentencePauseSeconds")
    pause = pause if isinstance(pause, (int, float)) and not isinstance(pause, bool) else 0
    return {"rate": int(min(MAX_WORDS_PER_MINUTE, max(MIN_WORDS_PER_MINUTE, rate))), "pause": float(min(MAX_PAUSE_SECONDS, max(0, pause)))}


def process_pronounce(request: dict, pronounce) -> dict:
    word = (request.get("word") or "").strip()
    accents = [accent for accent in request.get("accents") or ["uk", "us"] if accent in ("uk", "us")]
    if not word:
        return {"status": "FAILED", "error": "No word to pronounce"}
    speed = read_speed(request)
    try:
        phonetic: dict = {}
        audio: dict = {}
        for accent in accents:
            ipa, mp3 = pronounce(word, accent, speed) if speed else pronounce(word, accent)
            phonetic[accent] = ipa
            audio[accent] = base64.b64encode(mp3).decode("ascii")
        return {"status": "DONE", "word": word, "phonetic": phonetic, "audio": audio}
    except Exception as error:  # noqa: BLE001 - every failure goes back to content-service
        return {"status": "FAILED", "error": f"{type(error).__name__}: {error}"[:500]}
