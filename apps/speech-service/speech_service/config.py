"""Settings from the environment (the repository's .env is loaded by run.mjs)."""

from __future__ import annotations

import os
from dataclasses import dataclass

REQUESTS_QUEUE = "speech.autotime.requests"
RESULTS_QUEUE = "speech.autotime.results"


@dataclass(frozen=True)
class Settings:
    rabbitmq_url: str
    whisper_model: str
    whisper_device: str
    whisper_compute_type: str
    vad_filter: bool
    cache_dir: str


def load_settings() -> Settings:
    return Settings(
        rabbitmq_url=os.environ.get("RABBITMQ_URL", "amqp://localhost:5672"),
        # small.en is a good balance on a CPU; base.en is faster, medium.en finer.
        whisper_model=os.environ.get("WHISPER_MODEL", "small.en"),
        whisper_device=os.environ.get("WHISPER_DEVICE", "cpu"),
        whisper_compute_type=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"),
        vad_filter=os.environ.get("WHISPER_VAD_FILTER", "false").lower() == "true",
        # Words heard, by recording (D99); delete the folder to listen again.
        cache_dir=os.environ.get("SPEECH_CACHE_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), ".cache", "words")),
    )
