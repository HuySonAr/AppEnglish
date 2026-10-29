
import logging

from .broker import run
from .cache import WordCache
from .config import load_settings
from .transcriber import Transcriber

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    logging.getLogger("pika").setLevel(logging.CRITICAL)

    settings = load_settings()
    logging.getLogger("speech-service").info(
        "Starting with model %s on %s (%s), %d pronunciation workers",
        settings.whisper_model,
        settings.whisper_device,
        settings.whisper_compute_type,
        settings.pronounce_workers,
    )
    run(settings, Transcriber(settings), WordCache(settings.cache_dir, settings.whisper_model), pronounce=True)
