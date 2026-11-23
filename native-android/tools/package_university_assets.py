#!/usr/bin/env python3
"""Build an offline-only, fail-closed university exam asset pack for an Android APK.

The user confirms redistribution permission for the source materials. This script
does not import the original site's JavaScript or require Bilibili login.
A catalog entry alone never counts as a packaged paper.
"""
import argparse
import json
import logging
import math
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

BASE = "https://bilibilitoyassets.top/"
LEVELS = {"cet4", "cet6", "ielts", "kaoyan"}
SAFE_ID = re.compile(r"^[A-Za-z0-9_-]+$")
MAX_JSON = 16 * 1024 * 1024
MAX_AUDIO = 85 * 1024 * 1024
LOG = logging.getLogger("university-pack")


def download(url, maximum, retries=2):
    if not url.startswith(BASE):
        raise ValueError("Refusing untrusted origin: " + url[:100])
    last_error = None
    for attempt in range(retries + 1):
        try:
            req = Request(url, headers={"User-Agent": "ShiguangEnglish-AuthorizedOfflineBuilder/1.0",
                                        "Accept": "*/*"})
            with urlopen(req, timeout=24) as response:
                length = response.headers.get("Content-Length")
                if length and int(length) > maximum:
                    raise ValueError("Resource too large")
                content = response.read(maximum + 1)
                if len(content) > maximum:
                    raise ValueError("Resource too large")
                return content
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
            last_error = exc
            if attempt < retries and not (isinstance(exc, HTTPError) and exc.code in (400, 401, 403, 404)):
                time.sleep(1.5 * (attempt + 1))
            elif isinstance(exc, HTTPError) and exc.code in (400, 401, 403, 404):
                break
    raise RuntimeError(f"{last_error}") from last_error


def module_exists(payload, module):
    if module == "dictation":
        arr = payload.get("dictation") if isinstance(payload, dict) else payload
        return isinstance(arr, list) and bool(arr)
    if module == "listening":
        arr = payload.get("listening") if isinstance(payload, dict) else payload
        return isinstance(arr, list) and bool(arr)
    if module == "written" and isinstance(payload, dict):
        root = payload.get("written") or payload
        if isinstance(root, dict):
            return any(root.get(key) for key in ("questions", "reading", "writing",
                                                 "translation", "language_use", "paper_stem"))
    return False


def fetch_module(level, exam_id, module):
    prefix = f"{level}/jsons/{exam_id}"
    for suffix in (f"/{module}.json", ".json"):
        try:
            raw = download(BASE + prefix + suffix, MAX_JSON)
            value = json.loads(raw.decode("utf-8-sig"))
            if module_exists(value, module):
                return raw, value
        except (RuntimeError, UnicodeError, json.JSONDecodeError, ValueError):
            continue
    raise RuntimeError(f"No usable {module} JSON at {prefix}")


def audio_names(exam):
    level = exam["level"]
    title = exam["title"]
    exam_id = exam["id"]
    without_level = title.replace("四级", "").replace("六级", "")
    def without_set(s):
        return re.sub(r"\s*[（(]第[一二三123]套\s*[）)]", "", s)
    choices = []
    if level == "ielts":
        choices = [exam_id, title, re.sub(r"\s+", "", title).replace("Test", "test")]
    else:
        choices = [title, without_set(title), without_level, without_set(without_level), exam_id]
        if level == "cet6":
            choices.extend([without_level.replace("听力", "真题"),
                            without_level.replace("真题", "听力")])
    return list(dict.fromkeys(x for x in choices if x))


def dictation_last_end_ms(payload):
    """Return the latest real sentence end when the source exposes timestamps."""
    rows = payload.get("dictation") if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        return None
    latest = 0.0
    for row in rows:
        if not isinstance(row, dict):
            continue
        if not any(str(row.get(key) or "").strip()
                   for key in ("text", "sentence", "english")):
            continue
        for key in ("end", "endTime", "end_sec"):
            try:
                seconds = float(row[key])
            except (KeyError, ValueError, TypeError, OverflowError):
                continue
            if math.isfinite(seconds) and seconds > 0:
                latest = max(latest, seconds)
                break
    return round(latest * 1000) if latest > 0 else None


def audio_container(raw):
    """Identify real bytes: authorized .mp3 URLs can contain MP4-family audio."""
    if len(raw) <= 1024:
        return None
    if raw[:3] == b"ID3" or (raw[0] == 0xff and (raw[1] & 0xe0) == 0xe0):
        return "mp3"
    if (len(raw) >= 12 and raw[4:8] == b"ftyp" and
            16 <= int.from_bytes(raw[:4], "big") <= 4096):
        return "mp4"
    return None


def probe_mp3_duration_ms(raw):
    """Require a real audio stream and decoded duration, MP3 or MP4-family."""
    if shutil.which("ffprobe") is None:
        raise RuntimeError("ffprobe is required to verify original audio duration")
    with tempfile.NamedTemporaryFile(suffix=".bin") as temporary:
        temporary.write(raw)
        temporary.flush()
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "a:0",
             "-show_entries", "stream=codec_type,codec_name:format=duration",
             "-of", "json", temporary.name],
            capture_output=True, text=True, timeout=30, check=False,
        )
    if result.returncode != 0:
        raise ValueError("Media metadata could not be decoded")
    try:
        info = json.loads(result.stdout)
        if not any(x.get("codec_type") == "audio" for x in info.get("streams", [])):
            raise ValueError("Media has no audio track")
        seconds = float(info["format"]["duration"])
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise ValueError("Media has no usable audio duration") from exc
    if not math.isfinite(seconds) or seconds <= 0:
        raise ValueError("Audio duration is invalid")
    return round(seconds * 1000)


def validate_audio(raw, expected_end_ms=None):
    """Report time coverage separately from minimum-duration plausibility.

    This does not prove every spoken question is present when no verified
    sentence timeline exists. Full decoding or source comparison is separate.
    """
    if audio_container(raw) is None:
        raise ValueError("Unrecognized MP3/MP4 audio container header")
    duration_ms = probe_mp3_duration_ms(raw)
    if duration_ms < 5000:
        raise ValueError("Recording is too short to be usable")
    if expected_end_ms is not None and duration_ms + 2000 < expected_end_ms:
        raise ValueError("Recording does not cover the known last sentence")
    return duration_ms, ("timeline_covered" if expected_end_ms is not None
                         else "duration_only")


def fetch_audio(exam, expected_end_ms=None):
    for name in audio_names(exam):
        url = BASE + exam["level"] + "/audios/" + quote(name, safe="") + ".mp3"
        try:
            raw = download(url, MAX_AUDIO, retries=1)
            duration_ms, coverage = validate_audio(raw, expected_end_ms)
            return raw, url, duration_ms, coverage
        except (RuntimeError, ValueError, subprocess.TimeoutExpired):
            continue
    raise RuntimeError("No MP3 passing duration/timeline checks for exam ID " + exam["id"])


def need_modules(exam):
    if exam["level"] == "ielts":
        return ("dictation",)
    if exam["level"] == "kaoyan":
        return ("written",)
    return tuple(x for x, yes in (
        ("listening", exam["listeningCount"] > 0),
        ("dictation", exam["dictationCount"] > 0),
        ("written", True)
    ) if yes)


def run(args):
    dest = Path(args.dest)
    catalog_file = dest / "catalog.json"
    catalog = json.loads(catalog_file.read_text(encoding="utf-8"))
    exams = catalog["exams"]
    if shutil.which("ffprobe") is None:
        raise RuntimeError("ffprobe is required; install ffmpeg on the build runner")
    assert len(exams) == 231, "The complete authorized catalog must contain 231 entries"
    assert {e["level"] for e in exams} == LEVELS
    assert len({(e["level"], e["id"]) for e in exams}) == len(exams)
    if args.probe:
        samples = {lvl: next(x for x in exams if x["level"] == lvl) for lvl in LEVELS}
        exams = [samples[lvl] for lvl in ("cet4", "cet6", "ielts", "kaoyan")]
    entries = []
    failed = []
    total_bytes = 0

    for pos, exam in enumerate(exams, 1):
        level, exam_id = exam["level"], exam["id"]
        if level not in LEVELS or not SAFE_ID.fullmatch(exam_id):
            raise ValueError("Unsafe level or exam identifier")
        entry = {"id": exam_id, "level": level, "modules": {}, "audio": None,
                 "audioDurationMs": None, "audioContainer": None,
                 "audioCoverage": "not_required", "complete": False}
        try:
            expected_end_ms = None
            for module in need_modules(exam):
                raw, payload = fetch_module(level, exam_id, module)
                if module == "dictation":
                    expected_end_ms = dictation_last_end_ms(payload)
                out = dest / "exams" / level / exam_id / (module + ".json")
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_bytes(raw)
                entry["modules"][module] = str(out.relative_to(dest)).replace("\\", "/")
                total_bytes += len(raw)
            if level != "kaoyan" and exam["dictationCount"] > 0:
                entry["audioCoverage"] = "missing"
                raw, url, duration_ms, coverage = fetch_audio(exam, expected_end_ms)
                out = dest / "audio" / level / (exam_id + ".mp3")
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_bytes(raw)
                entry["audio"] = str(out.relative_to(dest)).replace("\\", "/")
                entry["audioDurationMs"] = duration_ms
                entry["audioContainer"] = audio_container(raw)
                entry["audioCoverage"] = coverage
                total_bytes += len(raw)
            entry["complete"] = True
        except Exception as exc:
            failed.append({"id": exam_id, "reason": str(exc)[:160]})
            LOG.error("[%s/%s] %s", pos, len(exams), str(exc)[:180])
        entries.append(entry)
        if pos % 10 == 0 or pos == len(exams):
            LOG.info("Verified %s/%s papers; completed=%s; missing=%s; bytes=%s",
                     pos, len(exams), pos - len(failed), len(failed), total_bytes)
        if args.max_mib and total_bytes > args.max_mib * 1024 * 1024:
            failed.append({"id": "PACK_LIMIT", "reason": "Configured APK asset limit exceeded"})
            break

    summary = {
        "schema": 1,
        "mode": "probe" if args.probe else "full",
        "expected": len(exams),
        "complete": sum(1 for e in entries if e["complete"]),
        "audioCount": sum(1 for e in entries if e["audio"]),
        "audioTimelineCovered": sum(e["audioCoverage"] == "timeline_covered" for e in entries),
        "audioDurationOnly": sum(e["audioCoverage"] == "duration_only" for e in entries),
        "audioMp4Container": sum(e["audioContainer"] == "mp4" for e in entries),
        "bytes": total_bytes,
        "entries": entries,
        "failures": failed,
    }
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "content-index.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"CONTENT_CHECK complete={summary['complete']}/{summary['expected']} "
          f"audio={summary['audioCount']} "
          f"timeline={summary['audioTimelineCovered']} "
          f"duration_only={summary['audioDurationOnly']} "
          f"mp4_container={summary['audioMp4Container']} "
          f"bytes={total_bytes} failed={len(failed)}", flush=True)
    if failed and args.strict:
        return 1
    if not args.probe and args.strict and summary["complete"] != 231:
        return 1
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dest", default="app/src/main/assets/university")
    parser.add_argument("--strict", action="store_true")
    parser.add_argument("--probe", action="store_true", help="Check a paper from each level")
    parser.add_argument("--max-mib", type=int, default=1550)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    sys.exit(run(args))
