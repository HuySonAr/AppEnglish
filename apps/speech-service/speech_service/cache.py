"""The words heard in a recording, kept on disk by recording and model (D99),
so a second job on the same recording (Auto-time after Transcribe, or a
second Auto-time) skips the download and Whisper and only aligns."""

from __future__ import annotations

import hashlib
import json
import os


class WordCache:
    def __init__(self, directory: str, model: str):
        self.directory = directory
        self.model = model

    def _path(self, url: str) -> str:
        key = hashlib.sha256(f"{self.model}|{url}".encode()).hexdigest()
        return os.path.join(self.directory, f"{key}.json")

    def get(self, url: str) -> list[dict] | None:
        try:
            with open(self._path(url), encoding="utf-8") as file:
                return json.load(file)
        except (OSError, ValueError):
            return None

    def put(self, url: str, words: list[dict]) -> None:
        os.makedirs(self.directory, exist_ok=True)
        path = self._path(url)
        with open(f"{path}.tmp", "w", encoding="utf-8") as file:
            json.dump(words, file)
        os.replace(f"{path}.tmp", path)
