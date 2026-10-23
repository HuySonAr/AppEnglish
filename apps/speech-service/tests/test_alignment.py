import unittest

from speech_service.alignment import align_lines, split_lines, tokens


def heard(*items):
    return [{"word": word, "start": start, "end": end} for word, start, end in items]


class TokensTest(unittest.TestCase):
    def test_case_punctuation_contractions_and_numbers_do_not_matter(self):
        self.assertEqual(tokens("Don't stop, it's FIVE o'clock!"), ["do", "not", "stop", "it", "is", "5", "o'clock"])
        self.assertEqual(tokens("We’ll pay 2,500 dollars"), ["we", "will", "pay", "2500", "dollars"])
        self.assertEqual(tokens("Room twenty-one"), ["room", "20", "1"])


class AlignLinesTest(unittest.TestCase):
    lines = [
        {"id": "a", "text": "Attention, passengers."},
        {"id": "b", "text": "The train to Boston is delayed."},
        {"id": "c", "text": "We're sorry."},
    ]

    def test_each_line_spans_its_words_with_a_little_room(self):
        words = heard(
            (" Attention,", 0.5, 1.1), (" passengers.", 1.1, 1.8),
            (" The", 2.2, 2.3), (" train", 2.3, 2.6), (" to", 2.6, 2.7), (" Boston", 2.7, 3.1), (" is", 3.1, 3.2), (" delayed.", 3.2, 3.8),
            (" We", 4.4, 4.5), ("'re", 4.5, 4.6), (" sorry.", 4.6, 5.0),
        )
        self.assertEqual(
            align_lines(self.lines, words),
            [
                {"id": "a", "start": 0.4, "end": 2.0, "matched": 1.0},
                {"id": "b", "start": 2.1, "end": 4.0, "matched": 1.0},
                {"id": "c", "start": 4.3, "end": 5.2, "matched": 1.0},
            ],
        )

    def test_a_misheard_word_keeps_the_line_and_counts_as_not_matched(self):
        words = heard(
            (" Attention", 0.5, 1.1), (" passengers", 1.1, 1.8),
            (" The", 2.2, 2.3), (" train", 2.3, 2.6), (" to", 2.6, 2.7), (" Austin", 2.7, 3.1), (" is", 3.1, 3.2), (" delayed", 3.2, 3.8),
            (" We", 4.4, 4.5), (" are", 4.5, 4.6), (" sorry", 4.6, 5.0),
        )
        result = align_lines(self.lines, words)
        self.assertEqual([line["start"] for line in result], [0.4, 2.1, 4.3])
        self.assertEqual(result[1]["matched"], 0.83)
        self.assertEqual(result[2]["matched"], 1.0)

    def test_a_line_not_heard_has_no_times_and_neighbours_do_not_overlap(self):
        words = heard((" Attention", 0.5, 1.1), (" passengers", 1.1, 2.25), (" We", 2.3, 2.4), (" are", 2.4, 2.5), (" sorry", 2.5, 2.9))
        result = align_lines(self.lines, words)
        self.assertEqual(result[1], {"id": "b", "start": None, "end": None, "matched": 0.0})
        self.assertLessEqual(result[0]["end"], result[2]["start"])
        self.assertEqual(result[2]["start"], 2.3)


class SplitLinesTest(unittest.TestCase):
    def test_speech_is_cut_into_sentences(self):
        words = heard(
            (" Attention,", 0.5, 1.1), (" passengers.", 1.1, 1.8),
            (" The", 2.2, 2.3), (" train", 2.3, 2.6), (" is", 2.6, 2.7), (" late.", 2.7, 3.2),
            (" We", 4.4, 4.5), ("'re", 4.5, 4.6), (" sorry", 4.6, 5.0),
        )
        self.assertEqual(
            split_lines(words),
            [
                {"text": "Attention, passengers.", "start": 0.4, "end": 2.0},
                {"text": "The train is late.", "start": 2.1, "end": 3.4},
                {"text": "We're sorry", "start": 4.3, "end": 5.2},
            ],
        )

    def test_a_song_is_cut_into_lyric_lines_from_whisper_phrases(self):
        sung = (
            "Love in your eyes, sitting silent by my side Going on holding hands, walking through the nights "
            "Teaching me to love with heart Helping me to open my mind I can fly, I'm proud that I can fly "
            "To give the best of mine To the end of the time Believe me, I can fly I'm proud that I can fly"
        )
        words = heard(*[(f" {word}", index * 0.4, index * 0.4 + 0.35) for index, word in enumerate(sung.split())])
        self.assertEqual(
            [line["text"] for line in split_lines(words, song=True)],
            [
                "Love in your eyes, sitting silent by my side",
                "Going on holding hands, walking through the nights",
                "Teaching me to love with heart Helping me to open my mind",
                "I can fly, I'm proud that I can fly",
                "To give the best of mine To the end of the time",
                "Believe me, I can fly I'm proud that I can fly",
            ],
        )

    def test_a_long_pause_ends_a_song_line(self):
        words = heard((" The", 50.0, 50.3), (" heaven", 50.3, 50.9), (" in", 50.9, 51.0), (" the", 51.0, 51.1), (" sky", 51.1, 52.0), (" stars", 56.5, 57.0), (" in", 57.0, 57.2), (" the", 57.2, 57.4), (" sky", 57.4, 58.0))
        self.assertEqual([line["text"] for line in split_lines(words, song=True)], ["The heaven in the sky", "stars in the sky"])

if __name__ == "__main__":
    unittest.main()
