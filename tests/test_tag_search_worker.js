const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const messages = [];
const context = {
  self: {postMessage: message => messages.push(message)},
  fetch: async url => ({
    ok: true,
    json: async () => url.endsWith("tags-general.json")
      ? [{tag: "silver hair", jp: "銀髪", aliases: ["silver_hair"], count: 42, category: 0}]
      : []
  })
};
vm.runInNewContext(fs.readFileSync("tag-search-worker.js", "utf8"), context);

(async () => {
  await context.self.onmessage({data: {
    type: "init",
    basePath: "./data/tagdb/",
    manifest: {status: "ready", shards: {"0": {category: 0, file: "tags-general.json"}}},
    synonyms: {entries: [{terms: ["銀髪", "シルバーヘア"], tag: "silver hair", jp: "銀髪", related: ["white hair"]}]}
  }});
  assert.equal(messages.at(-1).type, "ready");
  await context.self.onmessage({data: {type: "search", id: 1, query: "silver hair", category: "all"}});
  assert.equal(messages.at(-1).results[0].tag, "silver hair");
  assert.equal(messages.at(-1).results[0].kind, "exact");
  await context.self.onmessage({data: {type: "search", id: 2, query: "シルバーヘア", category: "all"}});
  assert.equal(messages.at(-1).results[0].kind, "synonym");
  console.log("worker Japanese/English search: OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
