import tempfile
import unittest

from speech_service.broker import supervise_pronounce
from speech_service.cache import AudioCache
from speech_service.config import Settings, pronounce_workers
from speech_service.pronounce import Pronouncer


def settings(**extra):
    base = dict(
        rabbitmq_url="amqp://x",
        whisper_model="small.en",
        whisper_device="cpu",
        whisper_compute_type="int8",
        vad_filter=False,
        cache_dir="",
        voices_dir="",
        voices={"uk": "en_GB-cori-medium", "us": "en_US-lessac-medium"},
    )
    base.update(extra)
    return Settings(**base)


class FakeWorker:
    def __init__(self, alive=True, exitcode=None):
        self.alive = alive
        self.exitcode = exitcode

    def is_alive(self):
        return self.alive


class PronounceWorkersTest(unittest.TestCase):
    def test_the_worker_count_is_read_and_kept_in_range(self):
        self.assertEqual(pronounce_workers(None), 2)
        self.assertEqual(pronounce_workers("3"), 3)
        self.assertEqual(pronounce_workers("0"), 1)
        self.assertEqual(pronounce_workers("12"), 3)
        self.assertEqual(pronounce_workers("many"), 2)

    def test_stopped_workers_are_started_again(self):
        started = []

        def start(index):
            worker = FakeWorker(alive=len(started) != 0)
            started.append(index)
            return worker

        supervise_pronounce(settings(pronounce_workers=2), start=start, rounds=1, pause=0)
        self.assertEqual(started, [0, 1])
        started.clear()
        dead = FakeWorker(alive=False, exitcode=1)
        workers = iter([dead, FakeWorker()])
        supervise_pronounce(settings(pronounce_workers=1), start=lambda index: started.append(index) or next(workers), rounds=2, pause=0)
        self.assertEqual(started, [0, 0])


class AudioCacheTest(unittest.TestCase):
    def test_a_voice_made_once_is_read_from_the_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            pronouncer = Pronouncer(settings(), AudioCache(directory))
            made = []

            def synthesize(text, accent, speed=None):
                made.append((text, accent, speed))
                return "/həˈləʊ/", b"mp3-bytes"

            pronouncer.synthesize = synthesize
            speed = {"rate": 145, "pause": 0.45}
            self.assertEqual(pronouncer("Hello.", "uk", speed), ("/həˈləʊ/", b"mp3-bytes"))
            self.assertEqual(pronouncer("Hello.", "uk", speed), ("/həˈləʊ/", b"mp3-bytes"))
            self.assertEqual(len(made), 1)
            pronouncer("Hello.", "uk", {"rate": 130, "pause": 0.8})
            pronouncer("Hello.", "us", speed)
            self.assertEqual(len(made), 3)

    def test_a_missing_or_broken_entry_is_a_miss(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = AudioCache(directory)
            self.assertIsNone(cache.get("nothing"))
            cache.put("k", "/a/", b"x")
            with open(f"{directory}/k.json", "w", encoding="utf-8") as file:
                file.write("{")
            self.assertIsNone(cache.get("k"))


if __name__ == "__main__":
    unittest.main()
