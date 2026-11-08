const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const cloud = fs.readFileSync('cloud-sync.js', 'utf8');

for (const token of [
  'extraTagPresetSelect',
  'applyExtraTagPresets',
  'saveExtraTagPreset',
  'manageExtraTagPresets',
  'extraTagPresetManage',
  'extraTagPresetList',
  'EXTRA_TAG_PRESETS_KEY',
  'readExtraTagPresets',
  'renderExtraTagPresetUI',
  'MAX_EXTRA_TAG_PRESETS'
]) assert.ok(html.includes(token), `missing extra tag preset token: ${token}`);

assert.ok(html.includes('extraTagPresets:normalizeExtraTagPresets(extraTagPresets)'), 'JSON backup must include extra tag presets');
assert.ok(html.includes('if(Array.isArray(payload.extraTagPresets))'), 'JSON import must restore extra tag presets');
assert.ok(html.includes('readExtraTagPresets();'), 'startup must load extra tag presets');
assert.ok(html.includes('setupExtraTagPresetUI();'), 'startup must wire extra tag preset UI');
assert.ok(cloud.includes('extraTagPresets:normalizeExtraTagPresets(extraTagPresets)'), 'Firebase profile must include extra tag presets');
assert.ok(cloud.includes('if(Array.isArray(value.extraTagPresets))'), 'Firebase profile restore must include extra tag presets');
assert.ok(!html.includes('favoriteTags=normalizeExtraTagPresets'), 'extra presets must not overwrite single-tag favorites');

const start = html.indexOf("const EXTRA_TAG_PRESETS_KEY=");
const end = html.indexOf("const DEFAULT_TAG_SEARCH_MODE=", start);
assert.ok(start >= 0 && end > start, 'extra tag preset implementation block must be present');
const implementation = html.slice(start, end);
const context = {
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  document: { dispatchEvent: () => {} },
  window: { prompt: () => null, confirm: () => true },
  byId: id => id === 'pasteTags' ? { value: 'beta, beta' } : null,
  refresh: () => {}
};
vm.runInNewContext(`const normalize=s=>String(s).toLowerCase().normalize('NFKC').replace(/[_\\-]/g,' ').replace(/\\s+/g,' ').trim(); let extraTags=['alpha']; ${implementation} this.normalizeExtraTagPreset=normalizeExtraTagPreset; this.splitExtraTagPresetTags=splitExtraTagPresetTags; this.appendExtraTagPresetTags=appendExtraTagPresetTags; this.getExtraTags=()=>extraTags;`, context);

const normalized = context.normalizeExtraTagPreset({ name: 'test', tags: ['alpha', 'beta', 'alpha', ' gamma '] });
assert.deepStrictEqual(Array.from(normalized.tags), ['alpha', 'beta', 'gamma'], 'preset tags must preserve order and remove duplicates');
assert.deepStrictEqual(Array.from(context.splitExtraTagPresetTags('alpha, , beta\ngamma, beta')), ['alpha', 'beta', 'gamma'], 'empty and duplicate tags must be ignored');
assert.deepStrictEqual(Array.from(context.appendExtraTagPresetTags(['alpha', 'beta', 'gamma'])), ['gamma'], 'applying a preset must skip tags already in committed or pasted input');
assert.deepStrictEqual(Array.from(context.getExtraTags()), ['alpha', 'gamma'], 'applying a preset must append only new tags');

console.log('extra tag presets, backup, Firebase and dedupe contract: OK');
