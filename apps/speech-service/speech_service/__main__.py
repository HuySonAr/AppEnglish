"""Starts the worker: python -m speech_service (run.mjs loads the .env)."""

import logging

from .broker import run
from .cache import WordCache
from .config import load_settings
from .transcriber import Transcriber

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logging.getLogger("pika").setLevel(logging.WARNING)

settings = load_settings()
logging.getLogger("speech-service").info(
    "Starting with model %s on %s (%s)", settings.whisper_model, settings.whisper_device, settings.whisper_compute_type
)
run(settings, Transcriber(settings), WordCache(settings.cache_dir, settings.whisper_model))
