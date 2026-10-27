import base64
import unittest

from speech_service.pronounce import count_words, format_ipa, length_scale, process_pronounce


class FormatIpaTest(unittest.TestCase):
    def test_stress_marks_move_before_the_syllable_and_schwa_is_normalised(self):
        self.assertEqual(format_ipa([list("ɐbˈaɪd bˈaɪ")]), "/əˈbaɪd baɪ/")
        self.assertEqual(format_ipa([list("skˈɛdʒuːl")]), "/ˈskedʒuːl/")
        self.assertEqual(format_ipa([list("ɹˌɛpjuːtˈeɪʃən")]), "/ˌrepjuːˈteɪʃən/")
        self.assertEqual(format_ipa([list("ɐɡɹˈiːmənt")]), "/əˈɡriːmənt/")
        self.assertEqual(format_ipa([list("biːʲ ɪn"), list("tʃˈɑːdʒ")]), "/biː ɪn tʃɑːdʒ/")
        self.assertEqual(format_ipa([]), "")

    def test_espeak_symbols_become_dictionary_symbols(self):
        self.assertEqual(format_ipa([list("ɹᵻpˈɔːɹt")]), "/rɪˈpɔːrt/")
        self.assertEqual(format_ipa([list("ɹɪpˈɔːt")]), "/rɪˈpɔːt/")
        self.assertEqual(format_ipa([list("dɪpˈɑːtʃə")]), "/dɪˈpɑːtʃə/")
        self.assertEqual(format_ipa([list("wˈɔːɾɚ")]), "/ˈwɔːtɚ/")
        self.assertEqual(format_ipa([list("plˈatfɔːm")]), "/ˈplætfɔːm/")
        self.assertEqual(format_ipa([list("ɐbˈaʊt")]), "/əˈbaʊt/")
        self.assertEqual(format_ipa([list("həʊtˈɛl")]), "/həʊˈtel/")

    def test_the_stress_mark_starts_the_syllable(self):
        self.assertEqual(format_ipa([list("ɛndʒˈɔɪ")]), "/enˈdʒɔɪ/")
        self.assertEqual(format_ipa([list("ˈɪntəvjˌuː")]), "/ˈɪntəˌvjuː/")
        self.assertEqual(format_ipa([list("ɪmpɹˈuːv")]), "/ɪmˈpruːv/")
        self.assertEqual(format_ipa([list("ɪkstɹˈiːm")]), "/ɪkˈstriːm/")

    def test_one_syllable_words_have_no_stress_mark(self):
        self.assertEqual(format_ipa([list("tˈaɪm")]), "/taɪm/")
        self.assertEqual(format_ipa([list("hˈeə")]), "/heə/")
        self.assertEqual(format_ipa([list("tʃˈiːp")]), "/tʃiːp/")


class ProcessPronounceTest(unittest.TestCase):
    def test_a_word_is_answered_with_ipa_and_mp3_per_accent(self):
        calls = []

        def pronounce(text, accent):
            calls.append((text, accent))
            return f"/{accent}-{text}/", f"mp3-{accent}".encode()

        answer = process_pronounce({"word": " abide by ", "accents": ["uk", "us", "fr"]}, pronounce)
        self.assertEqual(calls, [("abide by", "uk"), ("abide by", "us")])
        self.assertEqual(answer["status"], "DONE")
        self.assertEqual(answer["phonetic"], {"uk": "/uk-abide by/", "us": "/us-abide by/"})
        self.assertEqual(base64.b64decode(answer["audio"]["us"]), b"mp3-us")
        self.assertEqual(sorted(process_pronounce({"word": "x"}, pronounce)["audio"]), ["uk", "us"])

    def test_failures_are_answered_too(self):
        self.assertEqual(process_pronounce({"word": "  "}, None)["status"], "FAILED")

        def broken(text, accent):
            raise RuntimeError("voice missing")

        failed = process_pronounce({"word": "x"}, broken)
        self.assertEqual((failed["status"], failed["error"]), ("FAILED", "RuntimeError: voice missing"))


class SpeedTest(unittest.TestCase):
    def test_a_speed_is_passed_to_the_voice_and_clamped(self):
        calls = []

        def pronounce(text, accent, speed=None):
            calls.append(speed)
            return "/x/", b"mp3"

        for extra in ({"wordsPerMinute": 125, "sentencePauseSeconds": 0.8}, {"wordsPerMinute": 999, "sentencePauseSeconds": 9}, {"wordsPerMinute": "fast"}, {}):
            process_pronounce({"word": "Hello there.", "accents": ["uk"], **extra}, pronounce)
        self.assertEqual(calls, [{"rate": 125, "pause": 0.8}, {"rate": 220, "pause": 2.0}, None, None])

    def test_the_length_scale_leaves_room_for_the_pauses_within_the_voice_limits(self):
        self.assertEqual(length_scale(30, 10.0, 0, 180), 1.0)
        self.assertEqual(length_scale(30, 12.0, 0, 120), 1.25)
        self.assertEqual(length_scale(30, 12.0, 3.0, 120), 1.0)
        self.assertEqual(length_scale(30, 6.0, 0, 120), 1.5)
        self.assertEqual(length_scale(30, 20.0, 0, 180), 0.8)
        self.assertEqual(length_scale(0, 5.0, 0, 120), 1.0)
        self.assertEqual(length_scale(30, 12.0, 0, 120, 1.2), 1.5)
        self.assertEqual(length_scale(30, 15.0, 0, 120, 1.2), 1.2)
        self.assertEqual(count_words("The 9:30 train - leaves now."), 5)
