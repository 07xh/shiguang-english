"""No real network requests are made by these audit regression tests."""
import io
import unittest
from unittest.mock import patch

from tools import audit_missing_audio as audit


class FakeResponse:
    def __init__(self, payload, status=206, content_type="audio/mpeg"):
        self.source = io.BytesIO(payload)
        self.status = status
        self.headers = {"Content-Type": content_type, "Content-Range": "bytes 0-1023/5000"}
    def read(self, count):
        return self.source.read(count)
    def getcode(self):
        return self.status
    def __enter__(self):
        return self
    def __exit__(self, *_):
        self.source.close()


class MissingAudioAuditTests(unittest.TestCase):
    def test_small_range_and_header_only_are_not_labeled_complete(self):
        with patch.object(audit, "urlopen", return_value=FakeResponse(b"ID3" + bytes(2000))) as fetch:
            result = audit.probe(audit.pack.BASE + "cet4/audios/example.mp3")
        self.assertEqual(result["status"], "mp3_header_reachable")
        self.assertEqual(result["http_status"], 206)
        self.assertEqual(fetch.call_args.args[0].get_header("Range"), "bytes=0-1023")
        self.assertFalse("complete" in result)

    def test_nonzero_byte_range_must_not_be_accepted_as_mp3_start(self):
        response = FakeResponse(b"ID3" + bytes(2048))
        response.headers["Content-Range"] = "bytes 1024-2047/5000"
        with patch.object(audit, "urlopen", return_value=response):
            result = audit.probe(audit.pack.BASE + "cet4/audios/example.mp3")
        self.assertEqual(result["status"], "invalid_content_range")

    def test_html_with_http_200_is_not_treated_as_audio(self):
        with patch.object(audit, "urlopen", return_value=FakeResponse(b"<html>not audio</html>", 200, "text/html")):
            self.assertEqual(
                audit.probe(audit.pack.BASE + "cet6/audios/example.mp3")["status"],
                "not_mp3_header"
            )

    def test_classifies_http_failures_without_exposing_response_body(self):
        from urllib.error import HTTPError
        for code, expected in [(404, "not_found"), (403, "access_denied"), (429, "rate_limited"), (500, "http_error")]:
            with self.subTest(code=code):
                error = HTTPError("https://example.invalid", code, "error", None, None)
                with patch.object(audit, "urlopen", side_effect=error):
                    result = audit.probe(audit.pack.BASE + "cet4/audios/example.mp3")
                self.assertEqual(result, {"status": expected, "http_status": code})

    def test_audit_stops_after_first_header_reachable_candidate(self):
        paper = {"level": "cet4", "id": audit.HISTORIC_MISSING[0], "title": "Test title"}
        with patch.object(audit.pack, "audio_names", return_value=["first", "second", "third"]):
            with patch.object(audit, "probe", side_effect=[
                {"status": "not_found", "http_status": 404},
                {"status": "mp3_header_reachable", "http_status": 206},
            ]) as probe:
                result = audit.audit_exam(paper, cooldown=0)
        self.assertEqual(result["outcome"], "candidate_header_found")
        self.assertEqual(result["candidates_checked"], 2)
        self.assertEqual(probe.call_count, 2)

    def test_report_scope_is_exactly_ten_historical_ids(self):
        self.assertEqual(len(audit.HISTORIC_MISSING), 10)
        self.assertEqual(len(set(audit.HISTORIC_MISSING)), 10)
        catalog = {"exams": [
            {"level": "cet4", "id": id, "title": id}
            for id in audit.HISTORIC_MISSING
        ]}
        def result(row, *_):
            return {"outcome": "no_candidate_header_found", "id": row["id"]}
        with patch.object(audit, "audit_exam", side_effect=result):
            report = audit.collect(catalog)
        self.assertEqual(report["checks"], 10)
        self.assertEqual(report["header_reachable"], 0)
        self.assertTrue(report["not_verified_complete"])
        with self.assertRaisesRegex(ValueError, "absent from catalog"):
            audit.collect({"exams": []})


if __name__ == "__main__":
    unittest.main()
