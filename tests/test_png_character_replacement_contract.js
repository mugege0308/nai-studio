const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('function pngEditorCharacterReplacementEntries');
const end = html.indexOf('function applyPngEditorCharacterReplacement', start);
assert(start >= 0 && end > start, 'character replacement helper must remain available');

let sequence = 0;
const split = value => String(value || '').split(/[,，\n]/).map(item => item.trim()).filter(Boolean);
const makeEntry = (tag, source, charIndex, category, destination) => ({
  id: `test-${++sequence}`,
  tag: String(tag),
  source,
  charIndex,
  category,
  destination,
  keep: true,
});
const replace = new Function('metadataPromptTags', 'metadataMakeTagEntry', `${html.slice(start, end)}; return pngEditorCharacterReplacementEntries;`)(split, makeEntry);

const before = [
  makeEntry('girl', 'character', 0, 'unclassified', 'character1'),
  makeEntry('kushima kamome', 'character', 0, 'character', 'character1'),
  makeEntry('shy smile', 'character', 0, 'expression', 'character1'),
  makeEntry('adjusting hair「グポ♡グポ♡」', 'character', 0, 'pose', 'character1'),
  makeEntry('adjusting hair', 'character', 0, 'pose', 'character1'),
  makeEntry('fellatio', 'base', 0, 'pose', 'common'),
];
const after = replace(before, 'haruka (casual) (arknights)', 'character1');
const kept = after.filter(entry => entry.keep !== false);

assert.strictEqual(kept.filter(entry => entry.destination === 'character1' && entry.category === 'character').length, 1);
assert.strictEqual(kept.filter(entry => entry.tag === 'kushima kamome').length, 0);
assert.strictEqual(kept.filter(entry => entry.tag === 'haruka (casual) (arknights)').length, 1);
assert.ok(kept.some(entry => entry.tag === 'shy smile'), 'expression must remain');
assert.ok(kept.some(entry => entry.tag === 'adjusting hair'), 'action must remain');
assert.ok(kept.some(entry => entry.tag === 'adjusting hair「グポ♡グポ♡」'), 'comma-less Japanese quoted text must remain intact');
assert.ok(kept.some(entry => entry.tag === 'fellatio'), 'common scene tag must remain');

const repeated = replace(after, 'haruka (casual) (arknights)', 'character1');
const repeatedKept = repeated.filter(entry => entry.keep !== false);
assert.strictEqual(repeatedKept.filter(entry => entry.tag === 'haruka (casual) (arknights)').length, 1);
assert.strictEqual(repeatedKept.filter(entry => entry.tag === 'kushima kamome').length, 0);

const withAppearance = replace(before, 'haruka (casual) (arknights)', 'character1', 'long blonde hair, blue eyes');
const appearanceKept = withAppearance.filter(entry => entry.keep !== false);
assert.strictEqual(appearanceKept.filter(entry => entry.category === 'appearance' && entry.destination === 'character1').length, 2);
assert.ok(!appearanceKept.some(entry => entry.tag === 'kushima kamome'));

// The PNG-derived builder must keep one generated count tag while retaining
// the remaining imported sequence, so direct copy and form application agree.
const promptStart = html.indexOf('function promptPartsText(parts)');
const promptEnd = html.indexOf('\nfunction buildPrompts()', promptStart);
const promptPartsText = new Function('metadataPromptTags', 'metadataTagKey', 'pngAppliedOutputMode', `${html.slice(promptStart, promptEnd)}; return promptPartsText;`)(split, value => String(value).trim().toLowerCase().replace(/\s+/g, ' '), true);
assert.strictEqual(promptPartsText([
  { value: 'girl', source: 'automatic' },
  { value: 'haruka (casual) (arknights)', source: 'automatic' },
  { value: 'girl, haruka (casual) (arknights), shy smile, adjusting hair', source: 'additional' },
]), 'girl,\nharuka (casual) (arknights),\nshy smile,\nadjusting hair');

assert(html.includes("pngEditorOverride[destination]=false"), 'explicit character replacement must override a stale Studio character layer');
assert(html.includes("byId('character').value=tag"), 'character 1 replacement must replace the main character field');
assert(html.includes('pngEditorCharacterReplacementEntries'), 'replacement must use a deterministic entry transformation');
assert(html.includes('function preparePngEditorTransfer'), 'reapplying another PNG set must restore the pre-PNG form before transfer');
assert(html.includes('preparePngEditorTransfer();persistMetadataUndo();selected.forEach'), 'PNG transfer must use the replacement preparation path');

console.log('PNG character replacement, stale-layer removal, preservation and form-output contract: OK');
