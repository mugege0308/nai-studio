const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");

const modeStart = html.indexOf("const DEFAULT_TAG_SEARCH_MODE='local'");
const modeEnd = html.indexOf("function japaneseForItem", modeStart);
const modeSection = html.slice(modeStart, modeEnd);
assert(modeStart >= 0, "the local tag-search mode must be the initial mode");
assert(modeSection.includes("let searchMode=DEFAULT_TAG_SEARCH_MODE"));

const showTagSearchStart = html.indexOf("function showTagSearchView()");
const showTagSearchEnd = html.indexOf("function setMode", showTagSearchStart);
const showTagSearch = html.slice(showTagSearchStart, showTagSearchEnd);
assert(showTagSearch.includes("searchMode=DEFAULT_TAG_SEARCH_MODE"));
assert(showTagSearch.includes("renderTagList()"));
assert(showTagSearch.includes("requestTagDictionarySearch()"));
assert(!showTagSearch.includes("tagQuery').value='"), "entering the view must preserve the query");

const tabStart = html.indexOf("function tab(which)");
const tabEnd = html.indexOf("byId('tabBuild').onclick", tabStart);
const tabFunction = html.slice(tabStart, tabEnd);
assert(tabFunction.includes("showTagSearchView()"));
assert(!tabFunction.includes("searchMode='online'"), "tab navigation must not force Danbooru mode");

const setModeStart = html.indexOf("function setMode(mode)");
const setModeEnd = html.indexOf("for(const b of document.querySelectorAll('.modebtn'))", setModeStart);
const setMode = html.slice(setModeStart, setModeEnd);
assert(setMode.includes("if(mode==='online')scheduleOnlineSearch()"));
assert(setMode.includes("requestTagDictionarySearch()"));

console.log("tag search default mode, navigation, query preservation and manual online switch: OK");
