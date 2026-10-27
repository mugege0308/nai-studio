/* Shared ranking rules for local, upstream and online tag results. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NaiTagSearchRanking = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const RANKS = Object.freeze({exact: 0, synonym: 1, free: 1, prefix: 2, partial: 3, related: 4});
  const normalize = value => String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  function rankOf(item) {
    if (Number.isFinite(item?.rank)) return item.rank;
    return RANKS[item?.kind] ?? RANKS.partial;
  }

  function categoryRank(item, preferGeneral) {
    if (!preferGeneral) return 0;
    const category = Number(item?.category ?? item?.cat);
    if (category === 0) return 0;
    if (category === 5) return 1;
    return 2;
  }

  function compare(a, b, options = {}) {
    const rankDifference = rankOf(a) - rankOf(b);
    if (rankDifference) return rankDifference;
    const categoryDifference = categoryRank(a, options.preferGeneral) - categoryRank(b, options.preferGeneral);
    if (categoryDifference) return categoryDifference;
    const scoreDifference = Number(b?.score || 0) - Number(a?.score || 0);
    if (scoreDifference) return scoreDifference;
    const countDifference = Number(b?.count || 0) - Number(a?.count || 0);
    if (countDifference) return countDifference;
    return normalize(a?.en || a?.tag).localeCompare(normalize(b?.en || b?.tag));
  }

  function dedupe(items, options = {}) {
    const best = new Map();
    for (const item of items || []) {
      const key = normalize(item?.en || item?.tag);
      if (!key) continue;
      const previous = best.get(key);
      if (!previous || compare(item, previous, options) < 0) best.set(key, item);
    }
    return [...best.values()].sort((a, b) => compare(a, b, options));
  }

  function classify(tag, query) {
    const name = normalize(tag);
    const q = normalize(query);
    if (!q || name === q) return "exact";
    if (name.startsWith(q)) return "prefix";
    if (name.includes(q)) return "partial";
    return "partial";
  }

  return {RANKS, normalize, rankOf, compare, dedupe, classify};
});
