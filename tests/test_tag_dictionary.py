import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("tag_dictionary_updater", ROOT / "scripts" / "update_tag_dictionary.py")
UPDATER = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(UPDATER)
SUPP_SPEC = importlib.util.spec_from_file_location("japanese_supplement", ROOT / "scripts" / "build_japanese_supplement.py")
SUPPLEMENT = importlib.util.module_from_spec(SUPP_SPEC)
assert SUPP_SPEC and SUPP_SPEC.loader
SUPP_SPEC.loader.exec_module(SUPPLEMENT)


class TagDictionaryTests(unittest.TestCase):
    def test_upstream_record_shape_and_aliases(self):
        record = UPDATER.normalize_item({"t": "silver hair", "ja": "銀髪", "c": 0, "cnt": 123, "a": ["silver_hair", "silver hair"]})
        self.assertEqual(record["tag"], "silver hair")
        self.assertEqual(record["jp"], "銀髪")
        self.assertEqual(record["category"], 0)
        self.assertEqual(record["count"], 123)
        self.assertEqual(record["aliases"], ["silver_hair"])

    def test_generated_manifest_and_shards(self):
        manifest = json.loads((ROOT / "data" / "tagdb" / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["status"], "ready")
        self.assertEqual(manifest["supplement"], "translations-ja.json")
        self.assertGreaterEqual(manifest["total"], 100_000)
        self.assertEqual(sum(item["count"] for item in manifest["shards"].values()), manifest["total"])
        for shard in manifest["shards"].values():
            path = ROOT / "data" / "tagdb" / shard["file"]
            self.assertTrue(path.exists())
            rows = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(len(rows), shard["count"])

    def test_supplement_is_separate_and_conservative(self):
        supplement = json.loads((ROOT / "data" / "tagdb" / "translations-ja.json").read_text(encoding="utf-8"))
        self.assertGreater(len(supplement["translations"]), 500)
        self.assertEqual(SUPPLEMENT.translate_composite("black hat"), "黒い帽子")
        self.assertEqual(SUPPLEMENT.translate_composite("anime character (cosplay)"), "")
        source_rows = [row for shard in json.loads((ROOT / "data" / "tagdb" / "manifest.json").read_text(encoding="utf-8"))["shards"].values() for row in json.loads((ROOT / "data" / "tagdb" / shard["file"]).read_text(encoding="utf-8"))]
        general = {row["tag"] for row in source_rows if row["category"] in (0, 5)}
        self.assertTrue(set(supplement["translations"]).issubset(general))
        self.assertTrue(all(not row["jp"] for row in source_rows if row["tag"] in supplement["translations"]))

    def test_maintained_synonyms_survive_upstream_update(self):
        synonyms = json.loads((ROOT / "data" / "tagdb" / "synonyms.json").read_text(encoding="utf-8"))
        terms = {term for entry in synonyms["entries"] for term in entry["terms"]}
        self.assertIn("銀髪", terms)
        self.assertIn("silver hair", terms)

    def test_invalid_update_fails_before_replacement(self):
        manifest_path = ROOT / "data" / "tagdb" / "manifest.json"
        before = manifest_path.read_bytes()
        original_fetch = UPDATER.fetch_json
        try:
            UPDATER.fetch_json = lambda _: []
            with self.assertRaises(SystemExit):
                UPDATER.main()
        finally:
            UPDATER.fetch_json = original_fetch
        self.assertEqual(before, manifest_path.read_bytes())


if __name__ == "__main__":
    unittest.main()
