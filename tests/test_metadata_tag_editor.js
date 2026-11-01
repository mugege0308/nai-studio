const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf("const METADATA_TAG_CATEGORY_LABELS=");
const end = html.indexOf('function seedValue()', start);
assert.ok(start >= 0 && end > start, 'metadata tag editor functions must remain embedded in index.html');

const values = {
  negative: 'bad anatomy',
  character: '',
  maleMode: 'girl2',
  girl2Character: '',
};
const elements = Object.fromEntries(Object.keys(values).map(id => [id, { value: values[id] }]));
const context = {
  byId: id => elements[id] || { value: '' },
  document: { querySelectorAll: () => [] },
};
vm.runInNewContext(`let extraTags=[],femaleTags=[],maleTags=[],girl2Tags=[];${html.slice(start, end)}\nthis.metadataPromptTags=metadataPromptTags;this.metadataTagCategory=metadataTagCategory;this.buildMetadataTagDraft=buildMetadataTagDraft;this.applyMetadataTagEntry=applyMetadataTagEntry;this.getArrays=()=>({extraTags,femaleTags,maleTags,girl2Tags});`, context);

assert.strictEqual(JSON.stringify(context.metadataPromptTags('(silver hair:1.2), blue eyes\nfrom behind')), JSON.stringify(['(silver hair:1.2)', 'blue eyes', 'from behind']));
assert.strictEqual(context.metadataTagCategory('masterpiece', 'base'), 'quality');
assert.strictEqual(context.metadataTagCategory('cel shading', 'base'), 'style');
assert.strictEqual(context.metadataTagCategory('from behind', 'base'), 'composition');
assert.strictEqual(context.metadataTagCategory('original character', 'character', true), 'character');
assert.strictEqual(context.metadataTagCategory('explicit nudity', 'negative'), 'adult');

const draft = context.buildMetadataTagDraft({
  basePrompt: 'masterpiece, (silver hair:1.2), unknown_tag',
  characters: [{ caption: 'girl, mako kawai, blue eyes' }, { caption: 'girl, camera character, holding hands' }],
  negativePrompt: 'bad anatomy, explicit nudity',
});
assert.strictEqual(draft.entries.length, 11);
assert.ok(draft.entries.some(entry => entry.tag === '(silver hair:1.2)' && entry.category === 'appearance'));
assert.ok(draft.entries.some(entry => entry.tag === 'unknown_tag' && entry.category === 'unclassified'));
assert.ok(draft.entries.some(entry => entry.tag === 'mako kawai' && entry.destination === 'character1'));
assert.ok(draft.entries.some(entry => entry.tag === 'explicit nudity' && entry.category === 'adult' && entry.destination === 'negative'));

const warnings = [];
context.applyMetadataTagEntry({ tag: 'mako kawai', keep: true, category: 'character', destination: 'character1' }, warnings);
context.applyMetadataTagEntry({ tag: 'silver hair', keep: true, category: 'appearance', destination: 'character1' }, warnings);
context.applyMetadataTagEntry({ tag: 'camera character', keep: true, category: 'character', destination: 'character2' }, warnings);
context.applyMetadataTagEntry({ tag: 'holding hands', keep: true, category: 'pose', destination: 'character2' }, warnings);
context.applyMetadataTagEntry({ tag: 'explicit nudity', keep: true, category: 'adult', destination: 'negative' }, warnings);
assert.strictEqual(elements.character.value, 'mako kawai');
assert.strictEqual(elements.girl2Character.value, 'camera character');
assert.ok(context.getArrays().femaleTags.includes('silver hair'));
assert.ok(context.getArrays().girl2Tags.includes('holding hands'));
assert.ok(elements.negative.value.includes('explicit nudity'));

console.log('metadata tag split/classify/apply contract: OK');
