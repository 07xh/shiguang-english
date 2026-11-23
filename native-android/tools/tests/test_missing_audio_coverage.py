"""Pure unit tests; do not connect to the source media server."""
import unittest
from unittest.mock import patch

from tools import verify_missing_audio_coverage as verification
from tools.audit_missing_audio import HISTORIC_MISSING


class MissingAudioCoverageTests(unittest.TestCase):
    def test_actual_audio_track_and_timeline_result_is_reported(self):
        paper = {"level": "cet4", "id": HISTORIC_MISSING[0], "title": "fixture"}
        with patch.object(verification.pack, "fetch_module",
                          return_value=(b"{}", {"dictation": [
                              {"text": "One sentence.", "end": 32.0}]})):
            with patch.object(verification.pack, "fetch_audio",
                              return_value=(b"ftyp", "source", 34000, "timeline_covered")):
                with patch.object(verification.pack, "audio_container", return_value="mp4"):
                    item = verification.verify_exam(paper)
        self.assertEqual(item["status"], "verified_timeline")
        self.assertEqual(item["known_last_end_ms"], 32000)
        self.assertEqual(item["container"], "mp4")
        self.assertEqual(item["audio_bytes"], 4)

    def test_network_error_does_not_fabricate_success(self):
        paper = {"level": "cet6", "id": HISTORIC_MISSING[-1], "title": "fixture"}
        with patch.object(verification.pack, "fetch_module", side_effect=RuntimeError("offline")):
            with patch.object(verification.pack, "fetch_audio", side_effect=RuntimeError("no file")):
                item = verification.verify_exam(paper)
        self.assertEqual(item["status"], "unavailable_or_invalid")
        self.assertIsNone(item["duration_ms"])
        self.assertIsNone(item["container"])

    def test_aggregate_does_not_claim_every_paper_was_checked(self):
        catalog = {"exams": [
            {"id": name, "level": "cet4", "title": name}
            for name in HISTORIC_MISSING
        ]}
        def fake_exam(paper):
            status = ("verified_timeline" if paper["id"] == HISTORIC_MISSING[0]
                      else "unavailable_or_invalid")
            return {"id": paper["id"], "status": status,
                    "container": None, "duration_ms": None, "known_last_end_ms": None}
        with patch.object(verification, "verify_exam", side_effect=fake_exam):
            report = verification.verify_catalog(catalog, sleep_seconds=0)
        self.assertEqual(report["checked"], 10)
        self.assertEqual(report["timeline_covered"], 1)
        self.assertEqual(report["unavailable_or_invalid"], 9)
        self.assertIn("NOT", report["note"])
        with self.assertRaisesRegex(ValueError, "missing from catalog"):
            verification.verify_catalog({"exams": []}, sleep_seconds=0)


if __name__ == "__main__":
    unittest.main()
