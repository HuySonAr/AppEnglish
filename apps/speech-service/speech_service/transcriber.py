
from __future__ import annotations

from .config import Settings


class Transcriber:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.model = None

    def __call__(self, path: str, language: str, prompt: str) -> list[dict]:
        if self.model is None:
            from faster_whisper import WhisperModel

            self.model = WhisperModel(
                self.settings.whisper_model,
                device=self.settings.whisper_device,
                compute_type=self.settings.whisper_compute_type,
            )
        segments, _ = self.model.transcribe(
            path,
            language=language,
            word_timestamps=True,
            initial_prompt=prompt or None,
            vad_filter=self.settings.vad_filter,
        )
        return [
            {"word": word.word, "start": word.start, "end": word.end}
            for segment in segments
            for word in (segment.words or [])
        ]
