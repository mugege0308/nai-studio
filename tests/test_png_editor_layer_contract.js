const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert(html.includes('id="tabPngEditor"'), 'PNG edit needs a third main navigation button');
assert(html.includes("byId('tabPngEditor').onclick=()=>tab('png')"), 'PNG edit needs independent main navigation');
assert(html.includes('const PNG_EDITOR_OVERRIDE_DEFAULTS'), 'PNG editor needs a temporary override state');
for (const key of ['style', 'quality', 'character1', 'character2', 'appearance1', 'appearance2', 'expression', 'pose', 'composition', 'background', 'manual', 'search', 'favorite', 'uc']) {
  assert(html.includes(`${key}:false`), `temporary override missing: ${key}`);
}
assert(html.includes('function pngEditorEffectiveEntries'), 'PNG editor needs a derived output layer');
assert(html.includes('function withPngEditorStudioSettings'), 'Studio settings must be read without changing the normal form');
assert(html.includes('function renderPngEditorLayerControls'), 'temporary override controls are required');
assert(html.includes('override:pngEditorOverride'), 'temporary override state must be saved');
assert(html.includes('studioSettings:pngEditorStudioSettings'), 'Studio settings used by a saved PNG set must be saved');
assert(html.includes('normalizePngEditorOverride(value)'), 'old saved sets need a compatible default override');
assert(html.includes('pngEditorEffectiveEntries()'), 'copy/preview/application must use the derived output');
assert(html.includes('元PNGタグ'), 'original and effective tag counts should be visible');
assert(html.includes('PNGの元タグだけに戻す'), 'there must be a safe way to remove temporary overrides');

console.log('PNG editor independent screen and temporary override contract: OK');
