#!/usr/bin/env python3
"""Package the user's authorized original Word Toy university vocabulary.

The source uses vocab_master.json (word records) and books_manifest.json
(book-to-word integer indexes). This creates an offline Android JSON resource,
not a browser bundle. It fails rather than shipping false "full vocabulary".
"""
import argparse
import base64
import json
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE = "https://bilibilitoyassets.top/word_toy/data/"
ALLOWED = (
    "cet4", "cet6", "zhuanshengben", "kaoyan_core", "kaoyan_2",
    "ielts_core", "toefl_core", "tem4_core", "tem8_core"
)
MASK = bytes([
    87, 84, 95, 50, 48, 50, 54, 95, 154, 76, 227, 113, 43, 216, 101, 25,
    167, 62, 242, 132, 92, 193, 13, 119, 233, 35, 107, 181, 72, 145, 212, 58, 130,
    247, 20, 110, 163, 89, 200, 47, 125, 176, 65, 149, 236, 51, 138, 209, 31, 100,
    186, 7, 82, 230, 156, 56, 245, 77, 129, 202, 38, 115, 185, 14
])
MAX_BYTES = 40 * 1024 * 1024
BOOK_COVERS = {
    "cet4": "coffee.webp", "cet6": "dinosaur.webp",
    "zhuanshengben": "book.webp",
    "kaoyan_core": "compass.webp", "kaoyan_2": "telescope.webp",
    "ielts_core": "guitar.webp", "toefl_core": "globe.webp",
    "tem4_core": "feather.webp", "tem8_core": "crown.webp"
}

def unwrap(data):
    if not isinstance(data, dict) or data.get("_v") != 1:
        return data
    seed_text = data["_s"]
    value = 0
    for c in seed_text:
        value = (value * 33 + ord(c)) & 255
    cipher = base64.b64decode(data["_c"], validate=True)
    table = [MASK[(i + value) & 63] ^ ((i * 31 + value) & 255) for i in range(256)]
    return json.loads(bytes(x ^ table[i & 255] for i, x in enumerate(cipher)).decode("utf-8"))

def fetch_json(filename):
    assert filename in ("vocab_master.json", "books_manifest.json")
    error = None
    for attempt in range(3):
        try:
            req = Request(BASE + filename, headers={
                "User-Agent": "ShiguangEnglish-AuthorizedNativePacker/1.0",
                "Accept": "application/json"
            })
            with urlopen(req, timeout=50) as response:
                length = response.headers.get("Content-Length")
                if length and int(length) > MAX_BYTES:
                    raise ValueError("Upstream resource is too large")
                raw = response.read(MAX_BYTES + 1)
                if len(raw) > MAX_BYTES:
                    raise ValueError("Upstream resource is too large")
                return unwrap(json.loads(raw.decode("utf-8-sig")))
        except (HTTPError, URLError, OSError, ValueError, TimeoutError, UnicodeError) as exc:
            error = exc
            if attempt < 2:
                time.sleep((attempt + 1) * 3)
    raise RuntimeError("Cannot download " + filename + ": " + str(error))

def text(row, key):
    value = row.get(key, "")
    return value if isinstance(value, str) else ""

def compile_pack(master, manifests):
    if not isinstance(master, list) or len(master) < 1000:
        raise ValueError("Original vocab_master is not a full word array")
    if not isinstance(manifests, list):
        raise ValueError("books_manifest is not an array")
    selected = {}
    for book in manifests:
        if not isinstance(book, dict) or book.get("id") not in ALLOWED:
            continue
        identifier = book["id"]
        indexes = book.get("words")
        if identifier in selected or not isinstance(indexes, list) or len(indexes) < 500:
            raise ValueError("Missing or duplicate word indexes: " + identifier)
        if any(not isinstance(n, int) or n < 0 or n >= len(master) for n in indexes):
            raise ValueError("Invalid original index in " + identifier)
        selected[identifier] = book
    missing = [b for b in ALLOWED if b not in selected]
    if missing:
        raise ValueError("Missing university books: " + ",".join(missing))

    unique_indexes = sorted({n for book in selected.values() for n in book["words"]})
    compact = {original: idx for idx, original in enumerate(unique_indexes)}
    words = []
    for index in unique_indexes:
        item = master[index]
        if not isinstance(item, dict) or not text(item, "w"):
            raise ValueError("Invalid master word at position " + str(index))
        words.append({key: text(item, key) for key in (
            "w", "s", "t", "us", "uk", "en", "cn", "p", "tip"
        )})
    books = []
    for identifier in ALLOWED:
        book = selected[identifier]
        books.append({
            "id": identifier,
            "title": text(book, "title") or identifier,
            "tag": text(book, "tag"),
            "category": text(book, "category"),
            "description": text(book, "description"),
            "words": [compact[n] for n in book["words"]]
        })
    return {"schema": 1, "source": "original-word-toy-authorized",
            "books": books, "words": words}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dest", default="app/src/main/assets/vocabulary")
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()
    directory = Path(args.dest)
    directory.mkdir(parents=True, exist_ok=True)
    payload = compile_pack(fetch_json("vocab_master.json"),
                           fetch_json("books_manifest.json"))
    destination = directory / "university-words.json"
    destination.write_text(json.dumps(payload, ensure_ascii=False,
                                      separators=(",", ":")), encoding="utf-8")
    cover_dir = directory / "covers"
    cover_dir.mkdir(parents=True, exist_ok=True)
    cover_count = 0
    for book_id, filename in BOOK_COVERS.items():
        try:
            url = "https://bilibilitoyassets.top/word_toy/word_images/" + filename
            with urlopen(Request(url, headers={
                "User-Agent": "ShiguangEnglish-AuthorizedNativePacker/1.0"
            }), timeout=18) as response:
                payload = response.read(3 * 1024 * 1024)
            is_webp = payload[:4] == b"RIFF" and payload[8:12] == b"WEBP"
            if not is_webp or len(payload) < 100:
                raise ValueError("Not a valid WebP image")
            (cover_dir / (book_id + ".webp")).write_bytes(payload)
            cover_count += 1
            print("COVER_VERIFIED", book_id, len(payload), flush=True)
        except (HTTPError, URLError, ValueError, OSError, TimeoutError) as exc:
            print("COVER_MISSING", book_id, str(exc)[:90], file=sys.stderr)
    report = {
        "status": "verified",
        "source": "authorized-original-word-toy",
        "books": {b["id"]: len(b["words"]) for b in payload["books"]},
        "wordCount": len(payload["words"]),
        "bytes": destination.stat().st_size,
        "coverCount": cover_count
    }
    (directory / "vocab-verification.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("VOCAB_VERIFIED count=" + str(report["wordCount"]) +
          " books=" + str(len(report["books"])) +
          " bytes=" + str(report["bytes"]), flush=True)
    for key, amount in report["books"].items():
        print("BOOK_VERIFIED " + key + " " + str(amount), flush=True)
    if args.strict and (len(report["books"]) != len(ALLOWED) or report["wordCount"] < 1000):
        raise ValueError("Original university vocabulary incomplete")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("VOCAB_PACK_FAILED: " + str(exc), file=sys.stderr)
        sys.exit(1)
