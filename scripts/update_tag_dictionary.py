#!/usr/bin/env python3
"""Build the browser-friendly tag dictionary from PYU224/tagdb-updater.

The download is parsed and validated in a temporary directory. Existing
generated files are never touched until every validation succeeds.
"""

from __future__ import annotations

import json
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "tagdb"
SOURCE_URL = "https://raw.githubusercontent.com/PYU224/tagdb-updater/main/dist/tags.json"
UPSTREAM_REPO = "https://github.com/PYU224/tagdb-updater"
LICENSE_URL = "https://raw.githubusercontent.com/PYU224/tagdb-updater/main/LICENSE.txt"
MAX_BYTES = 64 * 1024 * 1024
MIN_TAGS = 100_000
MAX_TAGS = 500_000
CATEGORY_NAMES = {0: "general", 1: "artists", 3: "copyrights", 4: "characters", 5: "meta"}


def fail(message: str) -> "NoReturn":
    print(f"::error::{message}", file=sys.stderr)
    raise SystemExit(1)


def fetch_json(url: str) -> object:
    request = Request(url, headers={"User-Agent": "nai-studio-tag-dictionary/1.0", "Accept": "application/json"})
    with urlopen(request, timeout=60) as response:
        length = response.headers.get("Content-Length")
        if length and int(length) > MAX_BYTES:
            fail(f"upstream file is too large: {length} bytes")
        data = response.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        fail(f"upstream file exceeded {MAX_BYTES} bytes")
    try:
        return json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        fail(f"upstream JSON could not be decoded: {exc}")


def as_int(value: object) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def normalize_item(item: object) -> dict[str, object] | None:
    if not isinstance(item, dict):
        return None
    tag = str(item.get("t") or item.get("tag") or item.get("name") or "").strip()
    if not tag:
        return None
    category = as_int(item.get("c") if "c" in item else item.get("category"))
    if category not in CATEGORY_NAMES:
        return None
    aliases = item.get("a") if "a" in item else item.get("aliases")
    if isinstance(aliases, str):
        aliases = [aliases]
    if not isinstance(aliases, list):
        aliases = []
    aliases = sorted({str(alias).strip() for alias in aliases if str(alias).strip() and str(alias).strip() != tag})
    japanese = str(item.get("ja") or item.get("jp") or item.get("japanese") or "").strip()
    return {
        "tag": tag,
        "category": category,
        "jp": japanese,
        "aliases": aliases,
        "count": as_int(item.get("cnt") if "cnt" in item else item.get("post_count")),
    }


def validate_and_normalize(raw: object) -> list[dict[str, object]]:
    if not isinstance(raw, list):
        fail("upstream tags.json is not an array")
    normalized = [item for raw_item in raw if (item := normalize_item(raw_item)) is not None]
    if not MIN_TAGS <= len(normalized) <= MAX_TAGS:
        fail(f"normalized tag count {len(normalized):,} is outside {MIN_TAGS:,}..{MAX_TAGS:,}")
    unique = {str(item["tag"]).casefold() for item in normalized}
    if len(unique) < len(normalized) * 0.99:
        fail("too many duplicate tag names in upstream data")
    translated = sum(1 for item in normalized if item["jp"])
    if translated / len(normalized) < 0.40:
        fail(f"translated ratio {translated / len(normalized):.1%} is unexpectedly low")
    return normalized


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n", encoding="utf-8")


def build(staging: Path, records: list[dict[str, object]]) -> dict[str, object]:
    grouped: dict[int, list[dict[str, object]]] = {category: [] for category in CATEGORY_NAMES}
    for record in records:
        grouped[int(record["category"])].append(record)
    shards: dict[str, dict[str, object]] = {}
    for category, name in CATEGORY_NAMES.items():
        rows = sorted(grouped[category], key=lambda item: str(item["tag"]).casefold())
        filename = f"tags-{name}.json"
        path = staging / filename
        write_json(path, rows)
        shards[str(category)] = {"category": category, "name": name, "file": filename, "count": len(rows), "bytes": path.stat().st_size}
    manifest = {
        "schemaVersion": 1,
        "status": "ready",
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": {"repository": UPSTREAM_REPO, "file": SOURCE_URL, "license": "MIT (repository)", "licenseUrl": LICENSE_URL,
                   "provenance": "Tag metadata is derived from Danbooru data; see the upstream README and attribution file."},
        "total": len(records),
        "translated": sum(1 for record in records if record["jp"]),
        "shards": shards,
        "synonyms": "synonyms.json",
    }
    write_json(staging / "manifest.json", manifest)
    return manifest


def copy_if_changed(source: Path, destination: Path) -> bool:
    if destination.exists() and destination.read_bytes() == source.read_bytes():
        return False
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)
    return True


def install(staging: Path) -> bool:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    changed = False
    generated = {path.name for path in staging.glob("tags-*.json")} | {"manifest.json"}
    for path in staging.iterdir():
        changed |= copy_if_changed(path, OUTPUT / path.name)
    for old in OUTPUT.glob("tags-*.json"):
        if old.name not in generated:
            old.unlink()
            changed = True
    return changed


def main() -> int:
    try:
        raw = fetch_json(SOURCE_URL)
        records = validate_and_normalize(raw)
        with tempfile.TemporaryDirectory(prefix="nai-tagdb-", dir=ROOT) as temp:
            staging = Path(temp)
            manifest = build(staging, records)
            previous_manifest = OUTPUT / "manifest.json"
            previous_shards = list(staging.glob("tags-*.json"))
            unchanged_shards = previous_manifest.exists() and all(
                (OUTPUT / path.name).exists() and (OUTPUT / path.name).read_bytes() == path.read_bytes()
                for path in previous_shards
            )
            if unchanged_shards:
                try:
                    previous = json.loads(previous_manifest.read_text(encoding="utf-8"))
                    if previous.get("status") == "ready":
                        manifest["generatedAt"] = previous.get("generatedAt")
                        write_json(staging / "manifest.json", manifest)
                except (OSError, json.JSONDecodeError):
                    pass
            changed = install(staging)
        print(f"validated {manifest['total']:,} tags / {manifest['translated']:,} translated")
        print("changed" if changed else "no changes")
        return 0
    except SystemExit:
        raise
    except Exception as exc:
        fail(f"tag dictionary update failed before replacement: {exc}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
