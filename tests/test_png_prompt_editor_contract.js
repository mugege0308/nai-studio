const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const cloud = fs.readFileSync('cloud-sync.js', 'utf8');

for (const id of [
  'pngEditorViewTab',
  'pngSavedViewTab',
  'pngEditorPanel',
  'pngSavedPanel',
  'pngEditorContent',
  'pngSetList',
  'pngEditorAddDestination',
  'openPngEditorFile',
  'searchTagsForPngEditor',
  'returnPngEditorFromSearch',
]) assert(html.includes(`id="${id}"`), `missing PNG editor control: ${id}`);

assert(html.includes("const PNG_PROMPT_SETS_KEY='nai_png_prompt_sets_v1'"));
assert(html.includes('const MAX_PNG_PROMPT_SETS=200'));
assert(html.includes('function normalizePngPromptSet'));
assert(html.includes('originalPrompts'));
assert(html.includes('editedTags'));
assert(html.includes('function promptSetOutputs'));
assert(html.includes("['common','共通プロンプト']"));
assert(html.includes("['negative','UC']"));
assert(html.includes('function renderPngFavoriteAdder'));
assert(html.includes("showTagSearchView({pngEditorSearch:true})"));
assert(html.includes("if(pngEditorSearchMode&&metadataTagDraft)"));
assert(html.includes("function pngEditorSelectedEntries(mode)"));
assert(html.includes("['style','絵柄・品質のみ']"));
assert(html.includes("['composition','構図・POVのみ']"));
assert(html.includes('function savePngPromptSet'));
assert(html.includes('function openPngPromptSet'));
assert(html.includes('function duplicatePngPromptSet'));
assert(html.includes('function renamePngPromptSet'));
assert(html.includes('function deletePngPromptSet'));
assert(html.includes('version:15'));
assert(html.includes('pngPromptSets:savedPngPromptSets'));
assert(html.includes('payload.pngPromptSets'));
assert(html.includes("rootId!=='pngEditorTagEditor'"), 'PNG editor must not directly apply to the main form');
assert(cloud.includes("document.addEventListener('nai:pngpromptschanged',dirtyPngPromptSets)"));
assert(cloud.includes('function cleanRemotePngPromptObjects'));
assert(cloud.includes("root.child('pngPromptSets')"));
assert(cloud.includes('function pushPngPromptSets'));
assert(cloud.includes('function pngPromptSetsPayload'));
assert(cloud.includes('sourceImageId'));

console.log('PNG prompt editor, named saves, tag-search bridge, backup and Firebase contract: OK');
