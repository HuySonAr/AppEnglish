import unittest

from speech_service.speaking import fluency, heard_words, process_speaking, score_open_speaking, score_read_aloud


def said(*items):
    out = []
    at = 0.0
    for item in items:
        text, probability = item if isinstance(item, tuple) else (item, 0.95)
        out.append({"word": f" {text}", "start": at, "end": at + 0.3, "probability": probability})
        at += 0.35
    return out


class ScoreReadAloudTest(unittest.TestCase):
    def test_a_clean_reading_scores_high(self):
        result = score_read_aloud("The train leaves at nine.", said("The", "train", "leaves", "at", "nine."))
        self.assertEqual([word["status"] for word in result["words"]], ["correct"] * 5)
        self.assertEqual(result["extra"], [])
        self.assertEqual(result["scores"]["completeness"], 10.0)
        self.assertEqual(result["scores"]["accuracy"], 9.5)
        self.assertEqual(result["words"][4]["text"], "nine.")

    def test_low_confidence_missing_and_extra_words(self):
        result = score_read_aloud("I can't come today", said("I", ("can't", 0.4), "come", "um", "now"))
        self.assertEqual([word["status"] for word in result["words"]], ["correct", "mispronounced", "correct", "missing"])
        self.assertEqual(result["extra"], ["um", "now"])
        self.assertEqual(result["scores"]["completeness"], 8.0)
        self.assertEqual(result["words"][1]["confidence"], 0.4)

    def test_total_is_weighted(self):
        result = score_read_aloud("one two three four", said("one", "two"))
        scores = result["scores"]
        self.assertEqual((scores["accuracy"], scores["fluency"]), (9.5, 10.0))
        self.assertEqual(scores["total"], 8.3)
        self.assertEqual(scores["completeness"], 5.0)

    def test_nothing_matched_scores_zero(self):
        result = score_read_aloud("hello world", said("banana"))
        self.assertEqual(result["scores"], {"accuracy": 0.0, "completeness": 0.0, "fluency": 0.0, "total": 0.0})

    def test_apostrophe_pieces_are_joined(self):
        joined = heard_words([{"word": " don", "start": 0, "end": 0.2, "probability": 0.9}, {"word": "'t", "start": 0.2, "end": 0.4, "probability": 0.5}])
        self.assertEqual(joined, [{"word": "don't", "start": 0.0, "end": 0.4, "probability": 0.5}])


class FluencyTest(unittest.TestCase):
    def test_pauses_and_rate_cost_points(self):
        steady = [{"word": "a", "start": index * 0.4, "end": index * 0.4 + 0.3} for index in range(10)]
        self.assertEqual(fluency(steady)["score"], 10.0)
        gaps = [{"word": "a", "start": index * 1.3, "end": index * 1.3 + 0.3} for index in range(4)]
        result = fluency(gaps)
        self.assertEqual(result["pauses"], 3)
        self.assertLess(result["score"], 7.0)
        self.assertEqual(fluency([])["score"], 0.0)


class ProcessSpeakingTest(unittest.TestCase):
    def test_the_outbox_envelope_is_read(self):
        calls = []

        def transcribe(path, language, prompt):
            calls.append((path, language, prompt))
            return said("Hello", "there")

        message = {"id": "e1", "type": "speaking.requested", "payload": {"submissionId": "s1", "audioUrl": "https://media.test/r.webm", "text": "Hello there"}}
        answer = process_speaking(message, transcribe, fetch=lambda url: f"local:{url}")
        self.assertEqual(calls, [("local:https://media.test/r.webm", "en", "")])
        self.assertEqual((answer["submissionId"], answer["status"]), ("s1", "DONE"))
        self.assertEqual(answer["result"]["scores"]["completeness"], 10.0)

    def test_silence_and_errors_fail(self):
        message = {"payload": {"submissionId": "s2", "audioUrl": "x", "text": "Hi"}}
        self.assertEqual(process_speaking(message, lambda *args: [], fetch=lambda url: "x")["error"], "No speech was heard in the recording.")

        def broken(*args):
            raise RuntimeError("model missing")

        self.assertEqual(process_speaking(message, broken, fetch=lambda url: "x")["error"], "RuntimeError: model missing")
        empty = process_speaking({"payload": {"submissionId": "s3", "audioUrl": "x", "text": " "}}, broken, fetch=lambda url: "x")
        self.assertEqual(empty["status"], "FAILED")


class OpenSpeakingTest(unittest.TestCase):
    def test_fillers_cost_fluency_and_do_not_count_for_pronunciation(self):
        words = said("I", ("um", 0.2), "like", ("uh", 0.3), "travelling", ("abroad", 0.5))
        result = score_open_speaking(words)
        self.assertEqual(result["fillers"], 2)
        self.assertEqual(result["words"], 4)
        self.assertEqual(result["scores"]["pronunciation"], 8.4)
        self.assertEqual(result["scores"]["fluency"], 9.0)
        self.assertTrue(result["transcript"].startswith("I um like"))

    def test_pauses_from_one_second_and_a_gentler_rate(self):
        slow = [{"word": "a", "start": index * 1.2, "end": index * 1.2 + 0.3, "probability": 0.9} for index in range(6)]
        result = score_open_speaking(slow)
        self.assertEqual(result["pauses"], 0)
        self.assertEqual(result["wordsPerMinute"], 57)
        self.assertEqual(result["scores"]["fluency"], 8.7)
        with self.assertRaises(ValueError):
            score_open_speaking(said("um", "uh"))

    def test_open_answers_need_no_prompt_text(self):
        message = {"payload": {"submissionId": "s9", "kind": "open_speaking", "audioUrl": "x", "text": ""}}
        answer = process_speaking(message, lambda *args: said("I", "like", "it"), fetch=lambda url: "x")
        self.assertEqual(answer["status"], "DONE")
        self.assertEqual(answer["result"]["transcript"], "I like it")


if __name__ == "__main__":
    unittest.main()
