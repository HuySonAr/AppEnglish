import unittest

from speech_service.worker import process

REQUEST = {
    "jobId": "job-1",
    "audioUrl": "https://media.test/a.mp3",
    "language": "en",
    "lines": [{"id": "a", "text": "Hello there."}, {"id": "b", "text": "Good morning."}],
}


class ProcessTest(unittest.TestCase):
    def test_a_request_is_answered_with_the_times_of_its_lines(self):
        calls = []

        def transcribe(path, language, prompt):
            calls.append((path, language, prompt))
            return [
                {"word": " Hello", "start": 1.0, "end": 1.4}, {"word": " there.", "start": 1.4, "end": 1.9},
                {"word": " Good", "start": 2.5, "end": 2.8}, {"word": " morning.", "start": 2.8, "end": 3.4},
            ]

        answer = process(REQUEST, transcribe, fetch=lambda url: f"local:{url}")
        self.assertEqual(calls, [("local:https://media.test/a.mp3", "en", "")])
        self.assertEqual(answer["jobId"], "job-1")
        self.assertEqual(answer["status"], "DONE")
        self.assertEqual([(line["id"], line["start"], line["end"]) for line in answer["lines"]], [("a", 0.9, 2.1), ("b", 2.4, 3.6)])

    def test_failures_are_answered_too(self):
        def broken(path, language, prompt):
            raise RuntimeError("model missing")

        failed = process(REQUEST, broken, fetch=lambda url: "x")
        self.assertEqual((failed["status"], failed["error"]), ("FAILED", "RuntimeError: model missing"))
        silent = process(REQUEST, lambda *args: [], fetch=lambda url: "x")
        self.assertEqual((silent["status"], silent["error"]), ("FAILED", "No speech was heard in the recording."))
        def unreachable(url):
            raise OSError("404")

        self.assertEqual(process(REQUEST, broken, fetch=unreachable)["error"], "OSError: 404")


    def test_transcribe_answers_new_lines(self):
        words = [
            {"word": " Hello", "start": 1.0, "end": 1.4}, {"word": " there.", "start": 1.4, "end": 1.9},
            {"word": " Good", "start": 2.5, "end": 2.8}, {"word": " morning.", "start": 2.8, "end": 3.4},
        ]
        request = {"jobId": "job-2", "task": "transcribe", "audioUrl": "u", "language": "en", "kind": "part4"}
        answer = process(request, lambda *args: words, fetch=lambda url: "x")
        self.assertEqual(answer["status"], "DONE")
        self.assertEqual([line["text"] for line in answer["lines"]], ["Hello there.", "Good morning."])
        self.assertEqual(process({**REQUEST, "lines": []}, lambda *args: words, fetch=lambda url: "x")["error"], "ValueError: No lines to time")


    def test_a_recording_heard_once_is_not_listened_to_again(self):
        import tempfile

        from speech_service.cache import WordCache

        words = [{"word": " Hello", "start": 1.0, "end": 1.4}, {"word": " there.", "start": 1.4, "end": 1.9}]
        calls = []

        def transcribe(path, language, prompt):
            calls.append(path)
            return words

        with tempfile.TemporaryDirectory() as directory:
            cache = WordCache(directory, "small.en")
            first = process({**REQUEST, "task": "transcribe", "lines": []}, transcribe, fetch=lambda url: "x", cache=cache)
            second = process(REQUEST, transcribe, fetch=lambda url: self.fail("downloaded again"), cache=cache)
            self.assertEqual(calls, ["x"])
            self.assertEqual((first["status"], second["status"]), ("DONE", "DONE"))
            self.assertEqual(second["lines"][0]["start"], 0.9)
            self.assertIsNone(WordCache(directory, "base.en").get(REQUEST["audioUrl"]))

    def test_a_transcript_that_misses_most_of_the_text_is_not_kept(self):
        import tempfile

        from speech_service.cache import WordCache

        short = [{"word": " morning.", "start": 2.8, "end": 3.4}]
        full = [
            {"word": " Hello", "start": 1.0, "end": 1.4}, {"word": " there.", "start": 1.4, "end": 1.9},
            {"word": " Good", "start": 2.5, "end": 2.8}, {"word": " morning.", "start": 2.8, "end": 3.4},
        ]
        heard = [short, full]

        with tempfile.TemporaryDirectory() as directory:
            cache = WordCache(directory, "small.en")
            cache.put(REQUEST["audioUrl"], short)
            first = process(REQUEST, lambda *args: heard.pop(0), fetch=lambda url: "x", cache=cache)
            self.assertIsNone(first["lines"][0]["start"])
            second = process(REQUEST, lambda *args: heard.pop(0), fetch=lambda url: "x", cache=cache)
            self.assertEqual([line["start"] for line in second["lines"]], [0.9, 2.4])
            self.assertEqual(cache.get(REQUEST["audioUrl"]), full)


if __name__ == "__main__":
    unittest.main()
