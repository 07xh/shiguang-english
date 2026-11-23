#!/usr/bin/env python3
"""Check actual decodable audio and known dictation coverage for ten CET IDs.

This downloads authorized audio privately into process memory, verifies tracks
and duration with ffprobe, writes ONLY metadata, and never redistributes audio.
"""
import argparse
import json
from pathlib import Path
import time

from tools.audit_missing_audio import HISTORIC_MISSING
from tools import package_university_assets as pack


def verify_exam(exam: dict) -> dict:
    """One paper, one bounded authorized origin and the existing candidate list."""
    item = {"level": exam["level"], "id": exam["id"],
            "status": "unverified", "container": None,
            "duration_ms": None, "known_last_end_ms": None,
            "coverage": None, "audio_bytes": None}
    try:
        _, dictation = pack.fetch_module(exam["level"], exam["id"], "dictation")
        expected_end = pack.dictation_last_end_ms(dictation)
        item["known_last_end_ms"] = expected_end
    except Exception as exc:
        item["dictation_issue"] = type(exc).__name__
        expected_end = None

    try:
        raw, _, duration, coverage = pack.fetch_audio(exam, expected_end)
        item.update(
            status="verified_timeline" if coverage == "timeline_covered"
                   else "duration_only",
            container=pack.audio_container(raw),
            duration_ms=duration,
            coverage=coverage,
            audio_bytes=len(raw),
        )
        del raw
    except Exception as exc:
        item["status"] = "unavailable_or_invalid"
        item["failure_type"] = type(exc).__name__
        item["failure"] = str(exc)[:160]
    return item


def verify_catalog(catalog: dict, sleep_seconds: float = 0.2) -> dict:
    by_id = {e["id"]: e for e in catalog["exams"]}
    if any(x not in by_id for x in HISTORIC_MISSING):
        raise ValueError("Historic CET IDs missing from catalog")
    entries = []
    for ident in HISTORIC_MISSING:
        item = verify_exam(by_id[ident])
        entries.append(item)
        print("CET_AUDIO_COVERAGE", ident, item["status"],
              "container=", item["container"],
              "duration_ms=", item["duration_ms"],
              "known_last_end_ms=", item["known_last_end_ms"], flush=True)
        if sleep_seconds:
            time.sleep(sleep_seconds)
    return {
        "schema": 1,
        "scope": "ten_historical_CET_audio_ids",
        "checked": len(entries),
        "timeline_covered": sum(x["status"] == "verified_timeline" for x in entries),
        "duration_only": sum(x["status"] == "duration_only" for x in entries),
        "unavailable_or_invalid": sum(
            x["status"] == "unavailable_or_invalid" for x in entries),
        "note": ("Metadata and last known dictation end only. This is NOT a "
                 "word-by-word or question-by-question original audio audit."),
        "entries": entries,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", default="app/src/main/assets/university/catalog.json")
    parser.add_argument("--output", default="ten-cet-audio-coverage.json")
    parser.add_argument("--strict", action="store_true",
                        help="Fail job if any of the ten recordings cannot be validated")
    args = parser.parse_args()
    catalog = json.loads(Path(args.catalog).read_text(encoding="utf-8"))
    result = verify_catalog(catalog)
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n",
                      encoding="utf-8")
    print("CET_AUDIO_COVERAGE_RESULT", "checked=", result["checked"],
          "timeline=", result["timeline_covered"],
          "duration_only=", result["duration_only"],
          "unavailable=", result["unavailable_or_invalid"],
          "report=", str(target), flush=True)
    if args.strict and result["unavailable_or_invalid"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
