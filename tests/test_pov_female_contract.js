const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

// Existing POV values remain available for saved presets and older backups.
for (const value of ['value="normal"', 'value="povhand"', 'value="povhold"', 'value="povlook"', 'value="faceless"']) {
  assert.ok(html.includes(value), `existing POV value missing: ${value}`);
}

// Female POV presets live under the ③ second-character controls.
for (const value of ['fpovlook', 'fpovhold', 'fpovhand', 'fpovup', 'fpovdown', 'fpovbody']) {
  assert.ok(html.includes(`value="${value}"`), `female POV option missing: ${value}`);
  assert.ok(html.includes(`data-female-pov="${value}"`), `female POV shortcut missing: ${value}`);
}
for (const text of [
  '女性主観・相手を見る',
  '女性主観・相手と手をつなぐ',
  '女性主観・自分の手だけ映す',
  '女性主観・相手を見上げる',
  '女性主観・相手を見下ろす',
  '女性主観・自分の身体の一部を映す'
]) assert.ok(html.includes(text), `female POV label missing: ${text}`);

const secondCharacterPanel = html.slice(html.indexOf('id="malePanel"'), html.indexOf('</section>', html.indexOf('id="malePanel"')));
const existingPovPanel = html.slice(html.indexOf('id="povPanel"'), html.indexOf('</section>', html.indexOf('id="povPanel"')));
assert.ok(secondCharacterPanel.includes('data-female-pov="fpovlook"'), 'female POV must live in section ③');
assert.ok(!existingPovPanel.includes('data-female-pov='), 'section ④ must not own female POV controls');
assert.ok(existingPovPanel.includes('data-pov="povhand"'), 'existing male POV controls must remain in section ④');

assert.ok(html.includes("function isFemalePovMode"));
assert.ok(html.includes('id="character2Pov"'));
assert.ok(html.includes('function syncCharacter2Pov()'));
assert.ok(html.includes("kind:'femalePov'"));
assert.ok(html.includes("return {count:'2girls',tags:femalePov.tags"));
assert.ok(html.includes('girl A as first-person camera'));
assert.ok(html.includes('girl B in front of camera'));
assert.ok(html.includes("p.kind==='femalePov'?[p.count,p.tags]"), 'female POV must be visible in the preview');
assert.ok(html.includes("p.kind==='femalePov'?p:getPov()"), 'female POV copy must use the active composition');
assert.ok(html.includes("if(comp.kind==='femalePov'){"));
assert.ok(html.includes('if(comp.femalePrompt)female.push(comp.femalePrompt)'));
assert.ok(html.includes("if(isFemalePovMode(mode)){byId('maleMode').value='girl2';byId('viewMode').value='normal'}"));
assert.ok(html.includes("if(isFemalePovMode()&&mode!=='girl2'){byId('character2Pov').value='normal';byId('viewMode').value='normal'}"));
assert.ok(html.includes("function migratePovState(state)"));
assert.ok(html.includes('syncViewMode();'));

// The existing state capture path already carries viewMode/maleMode into presets,
// Firebase state, JSON backup, and structured TXT state.
assert.ok(html.includes("'viewMode','maleMode','character2Pov'"));
assert.ok(html.includes('state:captureSettings()'));
assert.ok(html.includes('JSON.stringify({format:\'NAI-Prompt-Studio-TXT-State\''));

console.log('female POV presets, composition coupling, and persistence contract: OK');
