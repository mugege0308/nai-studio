/* The large upstream dictionary is searched here, never in the page thread. */
let basePath = "./data/tagdb/";
let manifest = null;
let synonymEntries = [];
let supplement = {};
let supplementPromise = null;
const shardCache = new Map();

const normalize = value => String(value || "")
  .toLowerCase()
  .normalize("NFKC")
  .replace(/[_-]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

function categoryAllowed(shard, category) {
  return !category || category === "all" || category === "upstream:" + shard.category;
}

function supplementalJapanese(tag) {
  return supplement[normalize(tag)] || "";
}

function japaneseFor(record) {
  return String(record?.jp || "").trim() || supplementalJapanese(record?.tag || "");
}

async function loadSupplement() {
  if (supplementPromise) return supplementPromise;
  supplementPromise = (async () => {
    if (!manifest?.supplement) return;
    try {
      const response = await fetch(basePath + manifest.supplement, {cache: "force-cache"});
      if (!response.ok) return;
      const payload = await response.json();
      const translations = payload?.translations;
      if (!translations || typeof translations !== "object" || Array.isArray(translations)) return;
      supplement = Object.fromEntries(Object.entries(translations).map(([tag, jp]) => [normalize(tag), String(jp || "").trim()]).filter(([, jp]) => jp));
    } catch (_) {
      supplement = {};
    }
  })();
  return supplementPromise;
}

function scoreRecord(record, query) {
  const q = normalize(query);
  if (!q) return 0;
  const name = normalize(record.tag);
  const jp = normalize(japaneseFor(record));
  const aliases = (record.aliases || []).map(normalize);
  const exact = value => value === q;
  const starts = value => value.startsWith(q);
  if (exact(name)) return 1000;
  if (exact(jp)) return 980;
  if (aliases.some(exact)) return 940;
  if (starts(name) || starts(jp) || aliases.some(starts)) return 760;
  if (name.includes(q) || jp.includes(q) || aliases.some(value => value.includes(q))) return 560;
  return 0;
}

function synonymResults(query) {
  const q = normalize(query);
  if (!q) return [];
  const result = [];
  for (const entry of synonymEntries) {
    const terms = (entry.terms || []).map(normalize);
    if (!terms.some(term => term === q || (q.length >= 2 && term.includes(q)))) continue;
    result.push({
      tag: entry.tag,
      jp: entry.jp || "",
      aliases: [],
      count: 0,
      category: 0,
      score: terms.includes(q) ? 820 : 680,
      kind: "synonym",
      related: entry.related || []
    });
    for (const related of entry.related || []) {
      result.push({
        tag: related,
        jp: "",
        aliases: [],
        count: 0,
        category: 0,
        score: 310,
        kind: "related"
      });
    }
  }
  return result;
}

async function loadShard(shard) {
  if (shardCache.has(shard.file)) return shardCache.get(shard.file);
  const response = await fetch(basePath + shard.file, {cache: "force-cache"});
  if (!response.ok) throw new Error("辞書 shard HTTP " + response.status);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("辞書 shard の形式が不正です");
  shardCache.set(shard.file, rows);
  return rows;
}

async function search(message) {
  const query = String(message.query || "").trim();
  const category = String(message.category || "all");
  if (query.length < 2) return [];
  await loadSupplement();
  const shards = Object.values(manifest.shards || {}).filter(shard => categoryAllowed(shard, category));
  const ranked = synonymResults(query);
  for (const shard of shards) {
    const rows = await loadShard(shard);
    for (const record of rows) {
      const score = scoreRecord(record, query);
      if (score > 0) ranked.push({...record, score, kind: score >= 900 ? "exact" : "partial"});
    }
  }
  const best = new Map();
  for (const record of ranked) {
    const key = normalize(record.tag);
    if (!key || !best.has(key) || best.get(key).score < record.score) best.set(key, record);
  }
  return [...best.values()]
    .map(record => ({...record, jp: japaneseFor(record)}))
    .sort((a, b) => b.score - a.score || Number(b.count || 0) - Number(a.count || 0) || a.tag.localeCompare(b.tag))
    .slice(0, 120);
}

self.onmessage = async event => {
  const message = event.data || {};
  try {
    if (message.type === "init") {
      basePath = message.basePath || basePath;
      manifest = message.manifest;
      synonymEntries = Array.isArray(message.synonyms?.entries) ? message.synonyms.entries : [];
      supplement = {};
      supplementPromise = null;
      self.postMessage({type: "ready"});
      return;
    }
    if (message.type === "search") {
      if (!manifest || manifest.status !== "ready") {
        self.postMessage({type: "result", id: message.id, results: [], unavailable: true});
        return;
      }
      const results = await search(message);
      self.postMessage({type: "result", id: message.id, results});
    }
  } catch (error) {
    self.postMessage({type: "error", id: message.id, message: error?.message || "辞書検索に失敗しました"});
  }
};
