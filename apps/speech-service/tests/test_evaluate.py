import json
import os
import tempfile
import unittest

from speech_service.evaluate import compare, load_speechocean, mae, pearson, run, sample, spearman


class MetricsTest(unittest.TestCase):
    def test_correlations_and_error(self):
        self.assertAlmostEqual(pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1.0)
        self.assertAlmostEqual(pearson([1, 2, 3], [3, 2, 1]), -1.0)
        self.assertIsNone(pearson([1, 1, 1], [1, 2, 3]))
        self.assertAlmostEqual(spearman([1, 2, 3, 4], [1, 4, 9, 16]), 1.0)
        self.assertAlmostEqual(spearman([1, 2, 2, 3], [1, 2, 2, 3]), 1.0)
        self.assertEqual(mae([1, 2, 3], [2, 2, 5]), 1.0)

    def test_compare_skips_missing_values(self):
        rows = [
            {"system": {"total": 8, "fluency": None}, "expert": {"total": 7, "fluency": 6}},
            {"system": {"total": 6, "fluency": 5}, "expert": {"total": 5, "fluency": 5}},
            {"system": {"total": 4, "fluency": 3}, "expert": {"total": 4, "fluency": 2}},
        ]
        report = compare(rows, fields=("total", "fluency"))
        self.assertEqual(report["total"]["n"], 3)
        self.assertEqual(report["fluency"]["n"], 2)
        self.assertAlmostEqual(report["total"]["mae"], 0.667)


class SpeechoceanTest(unittest.TestCase):
    def test_the_repository_layout_is_read_and_sampled(self):
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, "resource"))
            os.makedirs(os.path.join(root, "test"))
            os.makedirs(os.path.join(root, "WAVE", "SPEAKER0001"))
            scores = {
                "000010011": {"text": "WE CALL IT BEAR", "accuracy": 8, "completeness": 10.0, "fluency": 9, "total": 8},
                "000010035": {"text": "IT IS A NICE DAY", "accuracy": 6, "completeness": 1.0, "fluency": 7, "total": 6},
                "000020001": {"text": "TRAIN ONLY", "accuracy": 5, "completeness": 10.0, "fluency": 5, "total": 5},
            }
            with open(os.path.join(root, "resource", "scores.json"), "w", encoding="utf-8") as file:
                json.dump(scores, file)
            with open(os.path.join(root, "test", "text"), "w", encoding="utf-8") as file:
                file.write("000010011 WE CALL IT BEAR\n000010035 IT IS A NICE DAY\n")
            for utt in ("000010011", "000010035", "000020001"):
                open(os.path.join(root, "WAVE", "SPEAKER0001", f"{utt}.WAV"), "wb").close()
            items = load_speechocean(root)
            self.assertEqual([item["id"] for item in items], ["000010011", "000010035"])
            self.assertEqual(items[1]["expert"]["completeness"], 10.0)
            self.assertEqual(len(sample(items, 1, seed=1)), 1)
            self.assertEqual(sample(items, 5, seed=1), sample(items, 5, seed=2))

            rows = run(items, lambda path, language, prompt: [{"word": " we", "start": 0, "end": 0.3, "probability": 0.9}], lambda text, words: {"scores": {"accuracy": 9, "completeness": 3, "fluency": 10, "total": 7}})
            self.assertEqual(rows[0]["system"]["total"], 7)
            self.assertEqual(rows[0]["expert"]["total"], 8)


if __name__ == "__main__":
    unittest.main()
