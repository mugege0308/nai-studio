const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
assert(html.includes('id="clearSearchTags"'));
assert(html.includes("検索タグを一括解除"));
assert(html.includes("function removeReplacedStyleTags"));
assert(html.includes("function normalizeSearchAdded"));
assert(html.includes("data.searchAddedTags=searchAddedTags"));
assert(html.includes("state.searchAddedTags=normalizeSearchAdded"));
assert(html.includes("a.className='primary'"));
assert(html.includes("sub.className='secondary'"));
assert(html.includes("英語：'+en"));
console.log("tag deletion, style cleanup and bilingual display contract: OK");
