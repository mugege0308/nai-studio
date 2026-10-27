const assert = require("assert");
const ranking = require("../tag-search-ranking.js");

const ordered = ranking.dedupe([
  {en: "silver hairband", kind: "prefix", rank: ranking.RANKS.prefix, count: 99999, category: 0},
  {en: "white hair", kind: "related", rank: ranking.RANKS.related, count: 999999, category: 0},
  {en: "silver hair", kind: "free", rank: ranking.RANKS.free, count: 0, category: 0},
  {en: "grey hair", kind: "related", rank: ranking.RANKS.related, count: 321, category: 0},
  {en: "silver hair", kind: "exact", rank: ranking.RANKS.exact, count: 2, category: 0}
]);
assert.deepEqual(ordered.map(item => item.en), ["silver hair", "silver hairband", "white hair", "grey hair"]);

const generalFirst = ranking.dedupe([
  {en: "mako", kind: "exact", rank: ranking.RANKS.exact, category: 4, count: 900000},
  {en: "silver hair", kind: "exact", rank: ranking.RANKS.exact, category: 0, count: 2},
  {en: "artist name", kind: "exact", rank: ranking.RANKS.exact, category: 1, count: 999999}
], {preferGeneral: true});
assert.equal(generalFirst[0].en, "silver hair");
assert.equal(ranking.classify("silver hairband", "silver hair"), "prefix");
console.log("tag ranking exact/synonym/category/dedupe: OK");
