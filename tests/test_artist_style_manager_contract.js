const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const cloud = fs.readFileSync('cloud-sync.js', 'utf8');
const store = fs.readFileSync('image-store.js', 'utf8');

// The existing image-backed look buttons are moved into a closed, remembered accordion.
for (const token of ['savedStylePresets', '保存済み絵柄プリセット', 'stylePresetCount', 'nai_style_preset_accordion_v1', 'setupStylePresetAccordion']) {
  assert.ok(html.includes(token), `missing style preset accordion contract: ${token}`);
}

// Artist tags have their own ordered, enabled state and are appended once by style output.
for (const token of ['ARTIST_TAGS_KEY', 'ARTIST_PRESETS_KEY', 'normalizeArtistTags', 'buildArtistTags', 'addArtistTagsFromInput', 'disableAllArtistTags', 'artistTagsList', 'artistPresetsList', 'saveArtistPreset']) {
  assert.ok(html.includes(token), `missing artist tag manager contract: ${token}`);
}
assert.ok(html.includes("if(id==='styleArtist')continue"), 'legacy artist select must not duplicate dedicated artist tags');
assert.ok(html.includes('artistTags=normalizeArtistTags(data.artistTags)'), 'state restore must include artist tags');
assert.ok(html.includes('state.artistTags=normalizeArtistTags(artistTags)'), 'state export must include artist tags');
assert.ok(html.includes('artistTagPresets:normalizeArtistTagPresets(artistTagPresets)'), 'JSON backup must include artist presets');
assert.ok(html.includes('window.NAIImageStore.put(file'), 'reference images must use IndexedDB image storage');
assert.ok(!html.includes('localStorage.setItem(ARTIST_TAGS_KEY,JSON.stringify(artistTags.map'), 'artist image bytes must not be put in localStorage');

// Existing custom look storage carries the dedicated tags without invalidating older records.
assert.ok(html.includes('result.artistTags=normalizeArtistTags(source.artistTags)'));
assert.ok(html.includes("look.artistTags=artistTags"));
assert.ok(html.includes("look.artistTags?.length?look.artistTags:splitArtistTagText"));

// Cloud sync has a separate collection and uploads reference assets by ID.
for (const token of ['artistTagPresets', "root.child('artistTagPresets')", 'uploadArtistPresetAssets', 'hydrateRemoteArtistAssets', 'nai:artisttagspresetschanged']) {
  assert.ok(cloud.includes(token), `missing Firebase artist preset contract: ${token}`);
}
assert.ok(store.includes('window.NAIImageStore={put,get,remove,has,MAX_BYTES}'));

console.log('artist tags, style accordion, image references, backup and Firebase contract: OK');
