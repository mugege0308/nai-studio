const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const messages = [];
const context = {
  self: {postMessage: message => messages.push(message)},
  fetch: async url => ({
    ok: true,
    json: async () => url.endsWith("tags-general.json")
      ? [{tag: "silver hair", jp: "銀髪", aliases: ["silver_hair"], count: 42, category: 0}, {tag: "silver hairband", jp: "銀髪飾り", aliases: [], count: 99999, category: 0}, {tag: "blue hair", jp: "", aliases: [], count: 12, category: 0}, {tag: "black hair", jp: "黒髪", aliases: [], count: 10, category: 0}, {tag: "blonde hair", jp: "金髪", aliases: [], count: 9, category: 0}, {tag: "from behind", jp: "後ろ姿", aliases: [], count: 8, category: 0}]
      : url.endsWith("translations-ja.json")
        ? {translations: {"blue hair": "青髪"}}
      : []
  })
};
context.importScripts = file => {
  vm.runInNewContext(fs.readFileSync(file, "utf8"), context, {filename: file});
  context.self.NaiTagSearchRanking = context.NaiTagSearchRanking;
};
vm.runInNewContext(fs.readFileSync("tag-search-worker.js", "utf8"), context);

(async () => {
  await context.self.onmessage({data: {
    type: "init",
    basePath: "./data/tagdb/",
    manifest: {status: "ready", supplement: "translations-ja.json", shards: {"0": {category: 0, file: "tags-general.json"}}},
    synonyms: {entries: [{terms: ["銀髪", "シルバーヘア", "銀色の髪"], tag: "silver hair", jp: "銀髪", related: ["white hair", "grey hair"]}, {terms: ["黒髪"], tag: "black hair", jp: "黒髪", related: ["dark hair"]}, {terms: ["金髪"], tag: "blonde hair", jp: "金髪", related: ["long blonde hair"]}, {terms: ["後ろ姿"], tag: "from behind", jp: "後ろ姿", related: ["back view"]}]}
  }});
  assert.equal(messages.at(-1).type, "ready");
  await context.self.onmessage({data: {type: "search", id: 1, query: "silver hair", category: "all"}});
  assert.equal(messages.at(-1).results[0].tag, "silver hair");
  assert.equal(messages.at(-1).results[0].kind, "exact");
  await context.self.onmessage({data: {type: "search", id: 2, query: "シルバーヘア", category: "all"}});
  assert.equal(messages.at(-1).results[0].kind, "synonym");
  assert.equal(messages.at(-1).results[0].tag, "silver hair");
  assert.deepEqual(messages.at(-1).results.slice(1).map(item => item.tag).sort(), ["grey hair", "white hair"]);
  await context.self.onmessage({data: {type: "search", id: 3, query: "青髪", category: "all"}});
  assert.equal(messages.at(-1).results[0].tag, "blue hair");
  assert.equal(messages.at(-1).results[0].jp, "青髪");
  await context.self.onmessage({data: {type: "search", id: 4, query: "黒髪", category: "all"}});
  assert.equal(messages.at(-1).results[0].tag, "black hair");
  await context.self.onmessage({data: {type: "search", id: 5, query: "後ろ姿", category: "all"}});
  assert.equal(messages.at(-1).results[0].tag, "from behind");
  console.log("worker Japanese/English/supplement search: OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
