const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert(html.includes('.png-editor-copybar'), 'PNG editor needs a top copy toolbar');
assert(html.includes('.metadata-tag-collapse'), 'metadata tag groups need collapsible styling');
assert(html.includes('.metadata-tag-category'), 'metadata tag categories need independent collapsible styling');
assert(html.includes('let metadataTagCollapseStateByRoot={}'), 'collapse state must be independent from saved prompt data');
assert(html.includes("{all:false,destinations:{},categories:{}}"), 'collapse state must start fully collapsed');
assert(html.includes("textContent='すべて開く'"));
assert(html.includes("textContent='すべて閉じる'"));
assert(html.includes('function metadataTagCollapseAll(rootId,open)'));
assert(html.includes('function renderPngEditorCopyBar(root)'));
assert(html.includes('function pngEditorOutputText(mode)'));
assert(html.includes('function copyPngEditorOutput(mode)'));
for (const mode of ['common', 'character1', 'character2', 'negative', 'all']) {
  assert(html.includes(`['${mode}'`), `copy mode missing: ${mode}`);
}
assert(html.includes("renderPngEditorCopyBar(root);renderPngFavoriteAdder(root)"));
assert(html.includes("copyPngEditorOutput(key)"));
assert(html.includes("metadataTagEntriesFromUI(rootId);renderMetadataTagEditor(metadataTagDraft,rootId,idPrefix)"), 'editing/moving/removing tags must preserve state before rerender');

console.log('PNG editor collapse and direct-copy contract: OK');
