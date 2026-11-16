const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

assert(html.includes('id="maleDetailMode"'), 'male detail mode selector is missing');
assert(html.includes('value="detailed" selected'), 'existing detailed behavior must remain the default');
assert(html.includes('value="auto"'), 'auto male mode option is missing');
assert(html.includes("'maleDetailMode'"), 'male detail mode must be part of persisted state');
assert(html.includes("copy.maleDetailMode!=='auto'&&copy.maleDetailMode!=='detailed"), 'old saved states need a detailed-mode fallback');
assert(html.includes("if(detailMode==='detailed')"), 'male appearance fields must be gated by detail mode');
assert(html.includes('id="character2EditType"'), 'independent character 2 edit selector is missing');
assert(html.includes('function character2SettingsText'), 'independent character 2 copy text is missing');
assert(html.includes('id="character2StoredPreview"'), 'independent character 2 preview is missing');
assert(html.includes('id="copyCharacter2Settings"'), 'independent character 2 copy button is missing');
assert(html.includes("copy.character2EditType=copy.maleMode==='girl2'?'girl2':'male'"), 'legacy settings need an edit-type fallback');
assert(html.includes("byId('maleDetailMode').addEventListener('change',refresh)"), 'mode changes must refresh prompt output');
assert(html.includes("push(male,'boy')"), 'basic male presence tag must remain in the individual prompt');
assert(html.includes('maleAction'), 'male action/position settings must remain available');

console.log('male auto/detail mode contract: OK');
