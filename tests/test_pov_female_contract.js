const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

// Existing POV values remain available for saved presets and older backups.
for (const value of ['value="normal"', 'value="povhand"', 'value="povhold"', 'value="povlook"', 'value="faceless"']) {
  assert.ok(html.includes(value), `existing POV value missing: ${value}`);
}

// Female POV presets live under the ③ second-character controls.
for (const value of ['fpovlook', 'fpovhold', 'fpovholdbothback', 'fpovhand', 'fpovup', 'fpovdown', 'fpovbody']) {
  assert.ok(html.includes(`value="${value}"`), `female POV option missing: ${value}`);
  assert.ok(html.includes(`data-female-pov="${value}"`), `female POV shortcut missing: ${value}`);
}
for (const value of ['fpovlook', 'fpovhold', 'fpovholdbothback', 'fpovhand', 'fpovup', 'fpovdown', 'fpovbody']) {
  const start = html.indexOf(`${value}:{tags:`);
  const end = html.indexOf('\n', start);
  const definition = html.slice(start, end < 0 ? html.length : end);
  assert.ok(definition.includes('girl B point of view'), `${value} must use girl B as the camera role`);
  assert.ok(definition.includes('girl A'), `${value} must keep girl A as the on-screen subject`);
}
for (const text of [
  '女性主観・相手を見る',
  '女性主観・相手と手をつなぐ',
  '女性主観・後ろ向きで両手をつなぐ',
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

for (const [value, label] of [['normal', '指定なし'], ['front', '正面向き'], ['side', '横向き'], ['back', '背中を向ける'], ['overShoulder', '背中を向けて振り返る']]) {
  assert.ok(html.includes(`value="${value}"`), `character 2 facing option missing: ${value}`);
  assert.ok(html.includes(label), `character 2 facing label missing: ${label}`);
}
assert.ok(html.includes('id="character2Facing"'));
assert.ok(html.includes('id="character2FacingWarning"'));

assert.ok(html.includes("function isFemalePovMode"));
assert.ok(html.includes('id="character2Pov"'));
assert.ok(html.includes('function syncCharacter2Pov()'));
assert.ok(html.includes("kind:'femalePov'"));
assert.ok(html.includes("tags:[femalePov.tags,femaleOverlay.tags].filter(Boolean).join(', ')"), 'female POV must retain compatible section ④ tags');
assert.ok(html.includes('function femalePovViewOverlay'));
assert.ok(html.includes("povhand')return {tags:'pov hands, one hand reaching from bottom foreground, looking at viewer'"));
assert.ok(html.includes("povhold')return {tags:'pov hands, holding hands, looking at viewer'"));
assert.ok(html.includes('④「男性の顔を映さない」は女性主観の画面外カメラ'));
assert.ok(html.includes("const character2FacingModes"));
assert.ok(html.includes("front:{tags:'facing viewer'"));
assert.ok(html.includes("side:{tags:'from side, profile'"));
assert.ok(html.includes("back:{tags:'from behind, facing away, back to viewer'"));
assert.ok(html.includes("overShoulder:{tags:'from behind, looking back, over shoulder'"));
assert.ok(html.includes('function getCharacter2Facing()'));
assert.ok(html.includes('facingTags:getCharacter2Facing().tags'));
assert.ok(html.includes("if(comp.kind==='femalePov'&&comp.facingTags)push(female,comp.facingTags)"));
assert.ok(html.includes('cameraPrompt'));
assert.ok(html.includes('girl B as first-person camera'));
assert.ok(html.includes('girl A in front of camera'));
assert.ok(html.includes("fpovholdbothback:{tags:'pov, first-person pov from girl B"));
assert.ok(html.includes("targetPrompt:'standing, reaching back, arms behind back, holding hands'"));
assert.ok(html.includes("forcedFacing:'back'"));
assert.ok(html.includes('handsOnly:true'));
assert.ok(html.includes('includeCharacter2Details:false'));
assert.ok(html.includes('function femalePovShowsCameraPart'));
assert.ok(html.includes('function femalePovCharacter2Specific'));
assert.ok(html.includes('pushMany(male,femalePovCharacter2Specific())'));
assert.ok(html.includes("if(girl2Tags.length)pushMany(male,girl2Tags,extraSource)"));
assert.ok(html.includes('return girl2Specific()'), 'female POV must preserve character 2 tags in the character 2 output');
assert.ok(!html.includes('femalePovIncludesCharacter2Details'), 'female POV must not suppress character 2 tags by visibility mode');
assert.ok(!html.includes("female.push('girl A as first-person camera')"), 'camera role must not be assigned to character 1');
assert.ok(html.includes('画面には1人目の女の子Aが映り、2人目の女の子Bがカメラ側'));
assert.ok(html.includes('function character2FacingConflicts(mode)'));
assert.ok(html.includes('手動タグは保持'));
assert.ok(html.includes('let femalePovRestoreState=null,lastCharacter2Pov=\'normal\''));
assert.ok(html.includes('femalePovRestoreState={maleMode:byId(\'maleMode\').value,viewMode:byId(\'viewMode\').value}'));
assert.ok(html.includes('byId(\'maleMode\').value=restore.maleMode;byId(\'viewMode\').value=restore.viewMode'));
assert.ok(!html.includes("if(mode!=='normal'&&isFemalePovMode())byId('character2Pov').value='normal'"), '④ changes must not disable female POV');
assert.ok(html.includes("p.kind==='femalePov'?[p.count,p.tags]"), 'female POV must be visible in the preview');
assert.ok(html.includes("p.kind==='femalePov'?p:getPov()"), 'female POV copy must use the active composition');
assert.ok(html.includes("if(comp.kind==='femalePov'){"));
assert.ok(html.includes('if(!wasFemale&&!femalePovRestoreState)femalePovRestoreState'));
assert.ok(html.includes("if(isFemalePovMode()&&mode!=='girl2'){byId('character2Pov').value='normal';lastCharacter2Pov='normal';femalePovRestoreState=null}"));
assert.ok(html.includes("function migratePovState(state)"));
assert.ok(html.includes('syncViewMode();'));

// The existing state capture path already carries viewMode/maleMode into presets,
// Firebase state, JSON backup, and structured TXT state.
assert.ok(html.includes("'viewMode','maleMode','character2Pov','character2Facing'"));
assert.ok(html.includes('state:captureSettings()'));
assert.ok(html.includes('JSON.stringify({format:\'NAI-Prompt-Studio-TXT-State\''));

console.log('female POV presets, composition coupling, and persistence contract: OK');
