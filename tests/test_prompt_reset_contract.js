const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

// UI controls exist outside the collapsible section list so existing panel keys stay stable.
assert(html.includes('id="promptResetPanel"'));
assert(html.includes('id="resetScene"'));
assert(html.includes('id="resetNewPrompt"'));
assert(html.includes('id="undoPromptReset"'));
assert(html.includes('id="clearTags"'));

// Complete clear covers manual/pasted and per-character additions, while retaining UC.
assert(html.includes('function clearAdditionalTags()'));
assert(html.includes("byId('pasteTags').value=''"));
assert(html.includes("byId('femaleExtras').value=''"));
assert(html.includes("byId('maleExtra').value=''"));
assert(html.includes("byId('girl2Extra').value=''"));
assert(html.includes("const negativeSearchTags=[...searchAddedArray('negative')]") || html.includes("const negativeSearchTags = [...searchAddedArray('negative')]") );
assert(html.includes('searchAddedTags.negative=negativeSearchTags'));
assert(html.includes('絵柄・キャラ名・シーン設定・UCは保持されています'));

// Reset semantics and confirmation are explicit and use the existing state snapshot.
assert(html.includes("const RESET_UNDO_KEY='nai_prompt_reset_undo_v1'"));
assert(html.includes('function saveResetUndo()'));
assert(html.includes('function resetScenePrompt()'));
assert(html.includes('function resetNewPrompt()'));
assert(html.includes('function undoPromptReset()'));
assert(html.includes("if(!confirm('シーン設定と追加タグをリセットしますか？キャラ名・絵柄・2人目の有効状態は保持されます。'))return;"));
assert(html.includes("if(!confirm('新しいプロンプトを作成しますか？絵柄とUCは保持され、キャラ2は未使用になります。'))return;"));
assert(html.includes("byId('maleMode').value='none'"));
assert(html.includes('applySettings(previous)'));
assert(html.includes('resetUndoState=null;persistResetUndo()'));

// Existing persistence paths remain the source of truth for snapshots, import/export and cloud sync.
assert(html.includes('function captureSettings()'));
assert(html.includes('function applySettings(state)'));
assert(html.includes('const SNAPSHOTS_KEY='));
assert(html.includes('state:captureSettings()') || html.includes('captureSettings(),customLooks'));
assert(html.includes("localStorage.setItem('nai_prompt_studio_v13'"));
assert(html.includes("loadState();readResetUndo();"));

console.log('prompt reset, complete clear, undo, and compatibility contract: OK');
