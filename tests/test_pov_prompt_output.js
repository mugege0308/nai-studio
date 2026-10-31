const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf(' const povModes={');
const end = html.indexOf('function refreshPov(){', start);
assert.ok(start >= 0 && end > start, 'prompt functions must remain embedded in index.html');

const values = {
  maleMode: 'girl2', character2Pov: 'fpovlook', viewMode: 'povhold', character2Facing: 'normal',
  character: 'on-screen girl', outfit: '', pose: '', scene: '', expression: '', camera: '',
  extras: '', femaleExtras: 'blue eyes, shy smile', pasteTags: '',
  girl2Character: 'camera girl', girl2Appearance: 'silver hair', girl2Outfit: 'dress',
  girl2Action: 'holding hands', girl2Extra: 'hand reaching from foreground',
  useQuality: false, useSolo: true
};
const context = {
  byId: id => ({ value: values[id] ?? '', checked: Boolean(values[id]) }),
  buildStyle: () => '',
  extraTags: [], femaleTags: [], maleTags: [], girl2Tags: ['camera-side hand tag']
};
vm.runInNewContext(`${html.slice(start, end)}\nthis.buildPrompts=buildPrompts;this.getComposition=getComposition;`, context);

let result = context.buildPrompts();
assert.ok(result.base.includes('pov hands'), '④ hand/POV tags must remain in the common prompt');
assert.ok(result.female.includes('blue eyes'), 'character 1 manual tags must remain');
assert.ok(!result.female.includes('camera girl') && !result.female.includes('silver hair'), 'character 2 tags must not mix into character 1');
assert.ok(result.male.includes('camera girl'), 'character 2 name must remain in character 2 output');
assert.ok(result.male.includes('silver hair'), 'character 2 appearance must remain in character 2 output');
assert.ok(result.male.includes('holding hands'), 'character 2 action must remain in character 2 output');
assert.ok(result.male.includes('camera-side hand tag'), 'character 2 additional tags must remain in character 2 output');

values.character2Pov = 'fpovholdbothback';
values.character2Facing = 'back';
result = context.buildPrompts();
assert.ok(result.base.includes('holding hands'), 'female POV hand action must remain in the common prompt');
assert.ok(result.female.includes('from behind, facing away, back to viewer'), 'back-facing tags must target character 1');
assert.ok(result.female.includes('arms behind back'), 'back-facing double-hand preset must remain on character 1');
assert.ok(result.male.includes('only hands visible in foreground'), 'camera-side hand visibility must remain on character 2');

console.log('female POV final prompt routing: OK');
