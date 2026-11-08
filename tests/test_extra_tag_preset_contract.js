const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const cloud = fs.readFileSync('cloud-sync.js', 'utf8');

for (const token of [
  'extraTagPresetSelect',
  'extraTagPresetDestination',
  'extraTagPresetSource',
  'extraTagPresetTags',
  'cancelExtraTagPresetEdit',
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
assert.ok(html.indexOf('id="extraTagPresetBox"') > html.indexOf('id="favoritesPanel"'), 'extra tag presets must be located with favorites');
assert.ok(html.indexOf('id="extraTagPresetBox"') < html.indexOf('id="pngEditorPanel"'), 'extra tag presets must not be in the direct-paste panel');
assert.ok(html.includes('value="female">キャラ1の追加タグ'), 'character 1 destination must be available');
assert.ok(html.includes('value="character2">キャラ2の追加タグ'), 'character 2 destination must be available');
assert.ok(html.includes('value="paste">直接貼り付け欄'), 'direct paste must be an independent save source');
assert.ok(html.includes('maxlength="24000"'), 'management form must provide a large multi-line tag input');
assert.ok(html.includes('カンマまたは改行区切り'), 'management form must explain comma/newline input');
assert.ok(html.includes("splitExtraTagPresetTags(byId('extraTagPresetTags')?.value||'')"), 'direct tag input must be normalized before saving');
assert.ok(html.includes("editingExtraTagPresetId=preset.id"), 'editing must load the selected preset into the management form');
assert.ok(html.includes("byId('extraTagPresetTags').value=preset.tags.join(',\\n')"), 'editing must expose existing tags for modification');
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
  byId: id => id === 'pasteTags' ? { value: 'beta, beta' } : id === 'maleMode' ? { value: 'visible' } : id === 'femaleExtras' ? { value: '' } : id === 'maleExtra' ? { value: '' } : id === 'girl2Extra' ? { value: '' } : null,
  refresh: () => {}
};
vm.runInNewContext(`const normalize=s=>String(s).toLowerCase().normalize('NFKC').replace(/[_\\-]/g,' ').replace(/\\s+/g,' ').trim(); let extraTags=['alpha'],femaleTags=[],maleTags=[],girl2Tags=[]; ${implementation} this.normalizeExtraTagPreset=normalizeExtraTagPreset; this.splitExtraTagPresetTags=splitExtraTagPresetTags; this.appendExtraTagPresetTags=appendExtraTagPresetTags; this.getArrays=()=>({extraTags,femaleTags,maleTags,girl2Tags});`, context);

const normalized = context.normalizeExtraTagPreset({ name: 'test', tags: ['alpha', 'beta', 'alpha', ' gamma '] });
assert.deepStrictEqual(Array.from(normalized.tags), ['alpha', 'beta', 'gamma'], 'preset tags must preserve order and remove duplicates');
assert.deepStrictEqual(Array.from(context.splitExtraTagPresetTags('alpha, , beta\ngamma, beta')), ['alpha', 'beta', 'gamma'], 'empty and duplicate tags must be ignored');
assert.deepStrictEqual(Array.from(context.appendExtraTagPresetTags(['alpha', 'beta', 'gamma'])), ['gamma'], 'common application must skip tags already in committed or pasted input');
assert.deepStrictEqual(Array.from(context.getArrays().extraTags), ['alpha', 'gamma'], 'common application must append only new tags');
assert.deepStrictEqual(Array.from(context.appendExtraTagPresetTags(['blush', 'blush', 'blue eyes'], 'female')), ['blush', 'blue eyes'], 'character 1 application must preserve order and dedupe');
assert.deepStrictEqual(Array.from(context.getArrays().femaleTags), ['blush', 'blue eyes'], 'character 1 application must use the character 1 array');
assert.deepStrictEqual(Array.from(context.appendExtraTagPresetTags(['tall', 'short black hair'], 'character2')), ['tall', 'short black hair'], 'character 2 application must resolve the active male destination');
assert.deepStrictEqual(Array.from(context.getArrays().maleTags), ['tall', 'short black hair'], 'character 2 application must use the active character 2 array');

const formFields = {
  extraTagPresetTags: { value: 'silver hair,\nblue eyes, silver hair', focus: () => {} },
  extraTagPresetName: { value: '直接入力セット' },
  extraTagPresetFolder: { value: '髪・瞳' },
  extraTagPresetDescription: { value: '直接入力の確認' },
  saveExtraTagPresetForm: { textContent: '' },
  cancelExtraTagPresetEdit: { classList: { add: () => {}, remove: () => {} } },
  extraTagPresetManage: { classList: { add: () => {}, remove: () => {} } }
};
const formContext = {
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  document: { dispatchEvent: () => {} },
  Event: function Event() {},
  window: { prompt: () => null, confirm: () => true },
  byId: id => formFields[id] || null
};
vm.runInNewContext(`const normalize=s=>String(s).toLowerCase().normalize('NFKC').replace(/[_\\-]/g,' ').replace(/\\s+/g,' ').trim(); let extraTags=[],femaleTags=[],maleTags=[],girl2Tags=[]; ${implementation} this.saveForm=saveExtraTagPresetForm; this.edit=editExtraTagPreset; this.getPresets=()=>extraTagPresets;`, formContext);
formContext.saveForm();
assert.deepStrictEqual(Array.from(formContext.getPresets()[0].tags), ['silver hair', 'blue eyes'], 'direct input must save newline/comma tags in order without duplicates');
formContext.edit(formContext.getPresets()[0].id);
assert.strictEqual(formFields.extraTagPresetTags.value, 'silver hair,\nblue eyes', 'editing must load tags into the multi-line form');
formFields.extraTagPresetTags.value = 'red hair\nblue eyes\nred hair';
formContext.saveForm();
assert.deepStrictEqual(Array.from(formContext.getPresets()[0].tags), ['red hair', 'blue eyes'], 'edited direct input must replace the existing tag contents');

console.log('extra tag presets, backup, Firebase and dedupe contract: OK');
