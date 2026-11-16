const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('function character2EditType()');
const end = html.indexOf('function buildPrompts()', start);
assert.ok(start >= 0 && end > start, 'independent character 2 helpers must exist');

const values = {
  character2EditType: 'male',
  maleCharacter: 'original adult man',
  maleAppearance: 'short black hair, brown eyes',
  maleOutfit: 'suit',
  maleAction: 'standing beside her',
  maleExtra: 'tall, gentle expression',
  girl2Character: 'original adult woman',
  girl2Appearance: 'silver hair, green eyes',
  girl2Outfit: 'dress',
  girl2Action: 'smile',
  girl2Extra: 'hair ribbon'
};
const context = {byId: id => ({value: values[id] ?? ''})};
vm.runInNewContext(`${html.slice(start, end)}\nthis.character2SettingsText=character2SettingsText;`, context);

let text = context.character2SettingsText('male');
assert.ok(text.includes('boy'), 'male copy must include the basic gender tag');
assert.ok(text.includes('original adult man') && text.includes('short black hair'), 'male settings must be copied');
assert.ok(text.includes('tall, gentle expression'), 'male extra tags must be copied');

values.character2EditType = 'girl2';
text = context.character2SettingsText('girl2');
assert.ok(text.includes('girl'), 'girl2 copy must include the basic gender tag');
assert.ok(text.includes('original adult woman') && text.includes('silver hair'), 'girl2 settings must be copied');
assert.ok(!text.includes('original adult man') && !text.includes('short black hair'), 'male settings must not mix into girl2 copy');

// The helper reads only character 2 fields, so copying it cannot modify the main prompt state.
assert.strictEqual(values.maleCharacter, 'original adult man');
assert.strictEqual(values.girl2Character, 'original adult woman');

console.log('independent character 2 settings and copy contract: OK');
