"""Offline audio package checks: no requests or copyrighted media in tests."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from tools import package_university_assets as pack


def sample_mp3(marker=b"A"):
    return b"ID3" + marker + bytes(2048)


class AudioVerificationTests(unittest.TestCase):
    def test_known_sentence_end_from_actual_dictation_rows(self):
        payload = {"dictation": [
            {"text": "First.", "end": "3.1"},
            {"sentence": "Second.", "endTime": "22.75"},
            {"english": "Third.", "end_sec": 21},
            {"section": "metadata", "end": 999},
            {"text": "Bad", "end": "nan"},
        ]}
        self.assertEqual(pack.dictation_last_end_ms(payload), 22750)
        self.assertIsNone(pack.dictation_last_end_ms({"dictation": [{"text": "No timings"}]}))

    def test_short_or_timeline_incomplete_mp3_is_rejected(self):
        with patch.object(pack, "probe_mp3_duration_ms", return_value=4000):
            with self.assertRaisesRegex(ValueError, "too short"):
                pack.validate_audio(sample_mp3())
        with patch.object(pack, "probe_mp3_duration_ms", return_value=48000):
            with self.assertRaisesRegex(ValueError, "known last sentence"):
                pack.validate_audio(sample_mp3(), expected_end_ms=60000)

    def test_duration_only_is_not_misrepresented_as_timeline_covered(self):
        with patch.object(pack, "probe_mp3_duration_ms", return_value=90000):
            self.assertEqual(pack.validate_audio(sample_mp3(), None),
                             (90000, "duration_only"))
            self.assertEqual(pack.validate_audio(sample_mp3(), 91750),
                             (90000, "timeline_covered"))

    def test_non_mp3_content_never_calls_duration_probe(self):
        with patch.object(pack, "probe_mp3_duration_ms") as probe:
            with self.assertRaisesRegex(ValueError, "MP3 header"):
                pack.validate_audio(b"<html>" + bytes(3000), 10000)
            probe.assert_not_called()

    def test_ffprobe_duration_is_required_and_parsed(self):
        with patch.object(pack.shutil, "which", return_value="/usr/bin/ffprobe"):
            with patch.object(pack.subprocess, "run", return_value=SimpleNamespace(
                returncode=0, stdout="121.500\n", stderr=""
            )):
                self.assertEqual(pack.probe_mp3_duration_ms(sample_mp3()), 121500)
            with patch.object(pack.subprocess, "run", return_value=SimpleNamespace(
                returncode=1, stdout="", stderr="decode failed"
            )):
                with self.assertRaisesRegex(ValueError, "could not be decoded"):
                    pack.probe_mp3_duration_ms(sample_mp3())

    def test_bad_candidate_does_not_block_next_valid_audio(self):
        def fake_download(url, maximum, retries=1):
            return sample_mp3(b"A" if "first" in url else b"B")

        def fake_duration(raw):
            return 10000 if raw[3:4] == b"A" else 35000

        with patch.object(pack, "audio_names", return_value=["first", "second"]):
            with patch.object(pack, "download", side_effect=fake_download):
                with patch.object(pack, "probe_mp3_duration_ms", side_effect=fake_duration):
                    raw, url, duration, state = pack.fetch_audio(
                        {"level": "cet4", "id": "fixture"}, expected_end_ms=30000
                    )
        self.assertEqual(raw[3:4], b"B")
        self.assertIn("second", url)
        self.assertEqual((duration, state), (35000, "timeline_covered"))


if __name__ == "__main__":
    unittest.main()
