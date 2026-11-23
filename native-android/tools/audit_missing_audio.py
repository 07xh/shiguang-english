#!/usr/bin/env python3
"""Bounded, read-only recheck of ten historically unavailable CET audio files.

This probes only small HTTP byte ranges on the already-authorized media host.
A reachable MP3 *header* proves neither complete download nor full paper audio.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from tools import package_university_assets as pack

# IDs recorded as missing candidates by the 2026-11-18 offline build.
# That run stopped early at its configured asset-size limit; this is NOT an
# exhaustive list of missing audio across the 231-paper catalog.
HISTORIC_MISSING = (
    "2023_06_cet4_set1", "2023_06_cet4_set2",
    "2022_06_cet4_set1",
    "2019_12_cet4_set1", "2019_12_cet4_set2",
    "2023_06_cet6_set2", "2023_06_cet6_set1",
    "2022_06_cet6_set1",
    "2019_12_cet6_set2", "2019_12_cet6_set1",
)

USER_AGENT = "ShiguangEnglish-AudioAvailabilityAudit/1.0"
MAX_CANDIDATES = 8
MAX_PROBE_BYTES = 1024


def media_container_header(data: bytes) -> str | None:
    if len(data) < 12:
        return None
    if data.startswith(b"ID3") or (
        data[0] == 255 and (data[1] & 224) == 224
    ):
        return "mp3"
    # Some authorized .mp3 endpoints actually serve MP4-family media.
    if data[4:8] == b"ftyp" and 16 <= int.from_bytes(data[:4], "big") <= 4096:
        return "mp4"
    return None


def probe(url: str, timeout: float = 8.0) -> dict:
    """Small ranged GET; never save audio or treat its header as complete."""
    if not url.startswith(pack.BASE):
        raise ValueError("Unexpected audio origin")
    request = Request(url, headers={
        "Range": "bytes=0-1023",
        "Accept-Encoding": "identity",
        "Accept": "audio/mpeg,application/octet-stream,*/*",
        "User-Agent": USER_AGENT,
    })
    try:
        with urlopen(request, timeout=timeout) as response:
            # A server may ignore Range and send HTTP 200. Do not read its body.
            data = response.read(MAX_PROBE_BYTES)
            status = getattr(response, "status", response.getcode())
            # A 206 response must actually begin at byte zero. Capture only
            # non-content diagnostics (8-byte magic and response headers).
            content_range = response.headers.get("Content-Range", "")
            range_valid = status != 206 or content_range.startswith("bytes 0-")
            container = media_container_header(data) if range_valid else None
            return {
                "status": (container + "_header_reachable" if container else
                           "invalid_content_range" if not range_valid else
                           "unknown_media_header"),
                "container": container,
                "http_status": status,
                "content_type": response.headers.get("Content-Type", ""),
                "content_range": content_range,
                "bytes_read": len(data),
                "first_8_hex": data[:8].hex() if container is None else "",
            }
    except HTTPError as exc:
        state = ("not_found" if exc.code == 404 else
                 "access_denied" if exc.code in (401, 403) else
                 "rate_limited" if exc.code == 429 else "http_error")
        return {"status": state, "http_status": exc.code}
    except (URLError, TimeoutError, OSError) as exc:
        return {"status": "network_error", "error_type": type(exc).__name__}


def audit_exam(exam: dict, timeout: float = 8.0, cooldown: float = 0.25) -> dict:
    attempts = []
    candidates = pack.audio_names(exam)[:MAX_CANDIDATES]
    for name in candidates:
        path = exam["level"] + "/audios/" + quote(name, safe="") + ".mp3"
        item = {"candidate": name, **probe(pack.BASE + path, timeout)}
        attempts.append(item)
        if item["status"] in ("mp3_header_reachable", "mp4_header_reachable"):
            break
        if cooldown:
            time.sleep(cooldown)
    outcome = ("candidate_header_found" if any(
        item["status"] in ("mp3_header_reachable", "mp4_header_reachable") for item in attempts
    ) else "no_candidate_header_found")
    return {
        "level": exam["level"], "id": exam["id"], "title": exam["title"],
        "outcome": outcome, "candidates_checked": len(attempts),
        "attempts": attempts,
    }


def collect(catalog: dict, timeout: float = 8.0, workers: int = 2,
            cooldown: float = 0.25) -> dict:
    selected = {row["id"]: row for row in catalog["exams"]
                if row.get("id") in HISTORIC_MISSING}
    missing_from_catalog = [name for name in HISTORIC_MISSING if name not in selected]
    if missing_from_catalog:
        raise ValueError("Historic IDs absent from catalog: " +
                         ",".join(missing_from_catalog))
    with ThreadPoolExecutor(max_workers=workers) as executor:
        results = list(executor.map(
            lambda ident: audit_exam(selected[ident], timeout, cooldown),
            HISTORIC_MISSING,
        ))
    return {
        "schema": 1,
        "scope": "ten_historically_missing_cet_mp3_candidates",
        "historical_run": 44359632422,
        "checks": len(results),
        "header_reachable": sum(
            item["outcome"] == "candidate_header_found" for item in results
        ),
        "mp4_header_reachable": sum(
            any(attempt["status"] == "mp4_header_reachable"
                for attempt in item["attempts"]) for item in results
        ),
        "not_verified_complete": True,
        "note": ("Small ranged HTTP probes only. MP3/MP4 header-reachable is not a "
                 "validated complete recording. Other 231-paper sources "
                 "were not checked."),
        "entries": results,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", default="app/src/main/assets/university/catalog.json")
    parser.add_argument("--output", default="missing-audio-audit.json")
    parser.add_argument("--timeout", type=float, default=8.0)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--dry-run", action="store_true",
                        help="List candidate names without sending HTTP requests")
    args = parser.parse_args()
    if not 1 <= args.workers <= 2 or not 1 <= args.timeout <= 15:
        parser.error("workers must be 1-2 and timeout 1-15 seconds")
    catalog = json.loads(Path(args.catalog).read_text(encoding="utf-8"))
    if args.dry_run:
        entries = [row for row in catalog["exams"]
                   if row.get("id") in HISTORIC_MISSING]
        report = {"mode": "dry_run", "entries": [
            {"id": row["id"], "candidates": pack.audio_names(row)[:MAX_CANDIDATES]}
            for row in entries
        ]}
    else:
        report = collect(catalog, args.timeout, args.workers)
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n",
                      encoding="utf-8")
    print("AUDIO_AUDIT mode=" + ("dry_run" if args.dry_run else "ranged_http") +
          " entries=" + str(len(report["entries"])) +
          (" header_reachable=" + str(report["header_reachable"])
           if not args.dry_run else "") +
          " report=" + str(target))


if __name__ == "__main__":
    main()
