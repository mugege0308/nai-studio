const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');

// The parser must keep weighted/bracketed expressions and Japanese quoted text
// intact. A comma-less string is intentionally one tag: splitting it would
// invent structure that was not present in the PNG metadata.
const parserStart = html.indexOf('function metadataPromptTags');
const parserEnd = html.indexOf('function metadataTagKey', parserStart);
assert(parserStart >= 0 && parserEnd > parserStart, 'metadata prompt parser must remain available');
const parserContext = {};
vm.runInNewContext(`${html.slice(parserStart, parserEnd)}\nthis.metadataPromptTags=metadataPromptTags;`, parserContext);
assert.strictEqual(
  JSON.stringify(parserContext.metadataPromptTags('adjusting hair, 「グポ♡グポ♡, test」, (weight:1.2), second')),
  JSON.stringify(['adjusting hair', '「グポ♡グポ♡, test」', '(weight:1.2)', 'second']),
);
assert.strictEqual(
  JSON.stringify(parserContext.metadataPromptTags('adjusting hair「グポ♡グポ♡」')),
  JSON.stringify(['adjusting hair「グポ♡グポ♡」']),
);
assert.strictEqual(JSON.stringify(parserContext.metadataPromptTags(['one, two', 'three'])), JSON.stringify(['one', 'two', 'three']));
assert.strictEqual(JSON.stringify(parserContext.metadataPromptTags({ tag: 'not a prompt' })), JSON.stringify([]));

// The output builder uses the tag value only. UI labels/Japanese translations
// and saved-set names cannot leak into generated prompts.
const outputStart = html.indexOf('function promptSetOutputs');
const outputEnd = html.indexOf('function normalizePngPromptSet', outputStart);
assert(outputStart >= 0 && outputEnd > outputStart, 'PNG output builder must remain available');
const outputContext = {};
vm.runInNewContext(`${html.slice(outputStart, outputEnd)}\nthis.promptSetOutputs=promptSetOutputs;`, outputContext);
assert.strictEqual(JSON.stringify(outputContext.promptSetOutputs([
  { tag: 'first', destination: 'character1', keep: true, label: '最初' },
  { tag: 'adjusting hair', destination: 'character1', keep: true, label: '髪を整える' },
  { tag: 'second', destination: 'character1', keep: true, label: '二番目' },
])), JSON.stringify({ common: '', character1: 'first, adjusting hair, second', character2: '', negative: '' }));
assert.strictEqual(JSON.stringify(outputContext.promptSetOutputs([
  { tag: 'silver hair', destination: 'common', keep: true, label: '銀髪' },
])), JSON.stringify({ common: 'silver hair', character1: '', character2: '', negative: '' }));
assert.strictEqual(
  outputContext.promptSetOutputs([
    { tag: 'adjusting hair', destination: 'character1', keep: true },
    { tag: 'adjusting hair', destination: 'character1', keep: true },
  ]).character1,
  'adjusting hair, adjusting hair',
  'intentional repeats in the source must not be globally deduplicated',
);

// Save/re-edit must retain the original array order rather than the visual
// destination/category grouping used by the editor.
const uiOrderStart = html.indexOf('function metadataTagEntriesFromUI');
const uiOrderEnd = html.indexOf('function updateMetadataTagDuplicates', uiOrderStart);
assert(uiOrderStart >= 0 && uiOrderEnd > uiOrderStart, 'metadata UI state reader must remain available');
const uiOrderSource = html.slice(uiOrderStart, uiOrderEnd);
assert(uiOrderSource.includes('return metadataTagDraft.entries.filter(entry=>visible.has(entry.id))'));
assert(!uiOrderSource.includes('].map(row=>'), 'UI reader must not return DOM grouping order');

// Search/favorite additions are explicitly marked as generated layers and are
// deduplicated at insertion time. Raw PNG entries are not rewritten.
const appendStart = html.indexOf('function metadataPngAppendEntry');
const appendEnd = html.indexOf('function buildMetadataTagDraft', appendStart);
assert(appendStart >= 0 && appendEnd > appendStart, 'PNG append guard must remain available');
const appendSource = html.slice(appendStart, appendEnd);
assert(appendSource.includes("new Set(['search','favorite'])"));
assert(appendSource.includes('metadataTagKey(item.tag)===metadataTagKey(entry.tag)'));
assert(html.includes("metadataPngAppendEntry(en,'search'"));
assert(html.includes("metadataPngAppendEntry(tag,'favorite'"));
assert(html.includes("typeof item.tag!=='string'"), 'malformed saved tags must not become [object Object] or comma-joined tags');

console.log('PNG prompt parsing, provenance, order preservation and output isolation contract: OK');
