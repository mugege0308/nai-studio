const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const cloud = fs.readFileSync('cloud-sync.js', 'utf8');

assert(html.includes('id="addManualFavorite"'));
assert(html.includes('id="manualFavoriteModal"'));
assert(html.includes('id="manualFavoriteTag"'));
assert(html.includes('id="manualFavoriteLabel"'));
assert(html.includes('id="manualFavoriteType"'));
assert(html.includes('id="manualFavoriteFolder"'));
assert(html.includes('value="works"'));
assert(html.includes('value="attributes"'));
assert(html.includes('value="uncategorized"'));

assert(html.includes('function openManualFavorite()'));
assert(html.includes('function updateManualFavoriteFolders()'));
assert(html.includes('function saveManualFavorite()'));
assert(html.includes('function closeManualFavorite()'));
assert(html.includes('内蔵辞書やDanbooruにないタグも登録できます') || html.includes('辞書やDanbooruにないタグも登録できます'));
assert(html.includes("if(list.some(entry=>normalize(entry.tag)===normalize(tag)))"));
assert(html.includes('persistFavoriteCollections()'));
assert(html.includes("addTag(entry.tag,'favorite')"));
assert(html.includes("copyFavoriteTag(entry.tag)"));
assert(html.includes("applySavedCharacter(entry.tag,target)"));
assert(html.includes('function renderFavoriteEntry(entry,type,folderId)'));

// Manual entries use the existing collection persistence and therefore remain in backup/cloud paths.
assert(html.includes('favoriteCollections'));
assert(html.includes('function exportAll()'));
assert(html.includes('favoriteCollections,savedSnapshots'));
assert(cloud.includes("function profilePayload(){return {state:captureSettings(),customLooks,favoriteTags,favoriteCollections"));

console.log('manual favorite registration and reuse contract: OK');
