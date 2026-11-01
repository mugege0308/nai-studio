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
assert(html.includes("typeof tagView!=='undefined'&&tagView==='pngEditor'"), 'PNG editor apply must use its independent transfer path');
assert(html.includes('pngAppliedOutputMode=true'), 'applying PNG output must mark the form as PNG-derived');
assert(html.includes('function pngEditorEntryAlreadyApplied'), 'repeated PNG application needs exact-tag detection');
assert(html.includes('pngEditorApplyAllowDuplicate=!pngAppliedOutputMode'), 'the first transfer must preserve the PNG tag sequence while repeats are deduplicated');
assert(html.includes('applyPngEditorTagEntry(entry)'), 'PNG-derived tags must be routed to additional output arrays');

// The direct editor output and the form output use different whitespace, but
// their ordered tag content must be identical after automatic duplicates are
// suppressed.
const promptPartsStart = html.indexOf('function promptPartsText(parts)');
const promptPartsEnd = html.indexOf('\nfunction buildPrompts()', promptPartsStart);
assert(promptPartsStart >= 0 && promptPartsEnd > promptPartsStart, 'promptPartsText implementation must be present');
const promptPartsFactory = new Function('metadataPromptTags', 'metadataTagKey', 'pngAppliedOutputMode', `${html.slice(promptPartsStart, promptPartsEnd)}; return promptPartsText;`);
const metadataPromptTags = value => String(value).split(/[,，\n]/).map(item => item.trim()).filter(Boolean);
const metadataTagKey = value => String(value).replace(/[()]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
const promptPartsText = promptPartsFactory(metadataPromptTags, metadataTagKey, true);
const direct = 'hand-drawn anime style, slightly rough lineart, shy smile, heart-shaped pupils, masterpiece';
const transferred = promptPartsText([
  { value: 'masterpiece, hand-drawn anime style, shy smile', source: 'automatic' },
  { value: 'hand-drawn anime style, slightly rough lineart, shy smile, heart-shaped pupils, masterpiece', source: 'additional' }
]);
const normalizePrompt = value => metadataPromptTags(value).map(metadataTagKey).join('|');
assert.strictEqual(normalizePrompt(transferred), normalizePrompt(direct), 'PNG direct copy and form output must contain the same ordered tags without automatic duplicates');

console.log('PNG editor independent screen and temporary override contract: OK');
