const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const imageStore = fs.readFileSync('image-store.js', 'utf8');
const cloud = fs.readFileSync('cloud-sync.js', 'utf8');

for (const id of ['pngEditorSavedList', 'pngEditorSavedCount', 'openAllPngSaved']) {
  assert(html.includes(`id="${id}"`), `PNG vault control missing: ${id}`);
}
for (const id of ['pngEditorReplaceTarget', 'pngEditorReplaceFavorite']) {
  assert(html.includes(`id='${id}'`), `PNG vault control missing: ${id}`);
}

for (const token of [
  'function pngSetPreviewImage',
  'function pngSetCard',
  'function renderPngCharacterReplacer',
  'function applyPngEditorCharacterReplacement',
  'function undoPngEditorChange',
  'async function pngFileFingerprint',
  'sourceImageFingerprint',
  'savePngPromptSetWithAssetReuse',
  'favoriteEntries().filter(entry=>entry.kind===\'character\')',
  'sourceMetadata:{settings:source.settings||{}',
]) assert(html.includes(token), `PNG vault implementation missing: ${token}`);

assert(html.includes('window.NAIImageStore.put'), 'PNG bytes must be kept in the existing IndexedDB image store');
assert(imageStore.includes("const DB_NAME='nai-prompt-studio-assets-v1'"), 'PNG vault must reuse IndexedDB asset storage');
assert(!html.includes("localStorage.setItem(PNG_PROMPT_SETS_KEY,importedNovelAIImageBytes"), 'PNG bytes must not be written to localStorage');
assert(cloud.includes('sourceImageId'), 'Firebase payload must retain the image reference');
assert(cloud.includes('uploadSnapshotAsset(item)'), 'Firebase sync must upload referenced image assets');
assert(html.includes("savePngEditorUndo();"), 'character replacement needs an editor-local undo snapshot');
assert(html.includes("if(!confirm('PNG編集セット内の"), 'character replacement needs confirmation');

console.log('PNG prompt vault, thumbnail, character replacement and storage contract: OK');
