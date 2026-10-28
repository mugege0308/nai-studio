const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert(html.includes('const openFavoriteWorkFolders=new Set()'));
assert(html.includes('function toggleFavoriteWorkFolder(folderId)'));
assert(html.includes("favorite-folder-toggle"));
assert(html.includes("favorite-folder-count"));
assert(html.includes("toggle.setAttribute('aria-expanded',String(open))"));
assert(html.includes("openFavoriteWorkFolders.has(folder.id)"));
assert(html.includes("source.length+'件'"));
assert(html.includes("type==='works'"));
assert(html.includes("openFavoriteWorkFolders.delete(id)"));

// The transient Set must not be part of persisted settings or cloud payloads.
assert(!html.includes('data.openFavoriteWorkFolders'));
assert(!html.includes('state.openFavoriteWorkFolders'));
assert(!html.includes('openFavoriteWorkFolders:'));
assert(html.includes('function captureSettings()'));
assert(html.includes('function saveState()'));

// Existing entry rendering remains underneath the expandable content.
assert(html.includes('renderFavoriteEntry(entry,type,folder.id)'));
assert(html.includes("addTag(entry.tag,'favorite')"));
assert(html.includes('applySavedCharacter(entry.tag,target)'));
assert(html.includes('copyFavoriteTag(entry.tag)'));

console.log('favorite works-folder accordion contract: OK');
