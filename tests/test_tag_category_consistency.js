const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const categories = require("../tag-search-category.js");

for (const value of [4, "4", "character", "characters", "char", "character_tag", "キャラ", "キャラクター"]) {
  assert.strictEqual(categories.isCharacter(value), true, `character alias: ${value}`);
  assert.strictEqual(categories.canonical(value), 4);
  assert.strictEqual(categories.label(value), "キャラ");
}
for (const value of [0, "general", "artist", "作品", "meta", "face", "hair", "pose", "camera", "scene", "light", "details"]) {
  assert.notStrictEqual(categories.isCharacter(value), true, `non-character category: ${value}`);
}
assert.strictEqual(categories.label("face"), "表情・顔");
assert.strictEqual(categories.label("hair"), "髪");
assert.strictEqual(categories.label(3), "作品");

const html = fs.readFileSync("index.html", "utf8");
assert(html.includes("function canonicalTagCategory(value)"));
assert(html.includes("function tagCategoryLabel(value)"));
assert(html.includes("window.NaiTagSearchCategory.isCharacter(cat)"));
assert(html.includes("replaceCharacterFromTag(en,replacementTarget)"));
assert(html.includes("cat:type==='works'?4:''"));
assert(html.includes("category:normalizeTagCategory(rawCategory)"));

// Exercise the same replacement branch used by a search result, including
// the previously missing call from addTag to replaceCharacterFromTag.
const replacementStart = html.indexOf("function characterReplaceTarget");
const replacementEnd = html.indexOf("for(const key of Object.keys(opts))", replacementStart);
const addStart = html.indexOf("function addTag(");
const addEnd = html.indexOf("function toggleFavorite", addStart);
assert(replacementStart >= 0 && replacementEnd > replacementStart);
assert(addStart >= 0 && addEnd > addStart);
const fields = {
  tagDestination: {value: "replace_character"},
  maleMode: {value: "none"},
  character: {value: "old character"},
  tagSearchStatus: {textContent: ""}
};
const context = {
  window: {NaiTagSearchCategory: categories},
  byId: id => fields[id],
  normalize: value => String(value || "").toLowerCase().normalize("NFKC").replace(/[_-]/g, " ").replace(/\s+/g, " ").trim(),
  setFavoriteStatus: message => { context.status = message; },
  refresh: () => { context.refreshed = true; },
  renderTagList: () => { context.rendered = true; },
  pngEditorSearchMode: false,
  metadataTagDraft: null,
  tagArrayForDestination: () => [],
  emptySearchAdded: () => ({positive: [], female: [], male: [], girl2: [], negative: []}),
  searchAddedTags: {positive: [], female: [], male: [], girl2: [], negative: []},
  favoriteAddedTags: {positive: [], female: [], male: [], girl2: [], negative: []}
};
vm.runInNewContext(html.slice(replacementStart, replacementEnd) + html.slice(addStart, addEnd), context);
context.addTag("和泉元エイミ", "search", {en: "izumi motoko", category: "characters"});
assert.strictEqual(fields.character.value, "和泉元エイミ");
assert.strictEqual(context.refreshed, true);
context.addTag("silver hair", "search", {en: "silver hair", cat: "hair"});
assert.match(context.status, /キャラクターカテゴリ/);
assert.strictEqual(fields.character.value, "和泉元エイミ");
console.log("tag category normalization, display and replacement contract: OK");
