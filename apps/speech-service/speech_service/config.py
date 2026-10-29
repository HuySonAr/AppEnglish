
from __future__ import annotations

import os
from dataclasses import dataclass

REQUESTS_QUEUE = "speech.autotime.requests"
RESULTS_QUEUE = "speech.autotime.results"
PRONOUNCE_QUEUE = "speech.pronounce.requests"
SPEAKING_REQUESTS_QUEUE = "speech.speaking.requests"
SPEAKING_RESULTS_QUEUE = "speech.speaking.results"

READ_ALOUD_SCORING = {
    "confidence": 0.6,
    "pause_seconds": 0.7,
    "pause_penalty_max": 5,
    "rate": {"min": 90, "max": 180, "words_per_point": 10, "penalty_max": 5},
    "weights": {"accuracy": 0.5, "completeness": 0.3, "fluency": 0.2},
}

OPEN_SPEAKING_SCORING = {
    "pause_seconds": 1.0,
    "pause_penalty_max": 5,
    "rate": {"min": 70, "max": 170, "words_per_point": 10, "penalty_max": 5},
    "filler_penalty": 0.2,
    "filler_penalty_max": 2,
    "fillers": ["um", "uh", "er", "erm", "uhm", "hmm", "ah", "mm"],
}

DEFAULT_VOICES = {"uk": "en_GB-cori-medium", "us": "en_US-lessac-medium"}
DEFAULT_PRONOUNCE_WORKERS = 2
MAX_PRONOUNCE_WORKERS = 3


@dataclass(frozen=True)
class Settings:
    rabbitmq_url: str
    whisper_model: str
    whisper_device: str
    whisper_compute_type: str
    vad_filter: bool
    cache_dir: str
    voices_dir: str
    voices: dict
    pronounce_workers: int = 2
    audio_cache_dir: str = ""


def load_settings() -> Settings:
    root = os.path.dirname(os.path.dirname(__file__))
    return Settings(
        voices_dir=os.environ.get("PIPER_VOICES_DIR", os.path.join(root, ".cache", "voices")),
        voices={
            "uk": os.environ.get("PIPER_VOICE_UK", DEFAULT_VOICES["uk"]),
            "us": os.environ.get("PIPER_VOICE_US", DEFAULT_VOICES["us"]),
        },
        rabbitmq_url=os.environ.get("RABBITMQ_URL", "amqp://localhost:5672"),
        whisper_model=os.environ.get("WHISPER_MODEL", "small.en"),
        whisper_device=os.environ.get("WHISPER_DEVICE", "cpu"),
        whisper_compute_type=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"),
        vad_filter=os.environ.get("WHISPER_VAD_FILTER", "false").lower() == "true",
        cache_dir=os.environ.get("SPEECH_CACHE_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), ".cache", "words")),
        pronounce_workers=pronounce_workers(os.environ.get("PRONOUNCE_WORKERS")),
        audio_cache_dir=os.environ.get("SPEECH_AUDIO_CACHE_DIR", os.path.join(root, ".cache", "audio")),
    )


def pronounce_workers(value: str | None) -> int:
    try:
        return min(MAX_PRONOUNCE_WORKERS, max(1, int(value or DEFAULT_PRONOUNCE_WORKERS)))
    except ValueError:
        return DEFAULT_PRONOUNCE_WORKERS
