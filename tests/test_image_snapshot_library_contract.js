const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const store = fs.readFileSync('image-store.js', 'utf8');
const cloud = fs.readFileSync('cloud-sync.js', 'utf8');

for (const id of ['saveImportedSnapshot', 'snapshotSort', 'snapshotList', 'snapshotImageFile']) {
  assert.ok(html.includes(`id="${id}"`), `snapshot UI missing: ${id}`);
}
assert.ok(html.includes('<script src="./image-store.js"></script>'));
assert.ok(html.includes('firebase-storage-compat.js'));
assert.ok(html.includes('function saveImportedSnapshot()'));
assert.ok(html.includes('imageId'));
assert.ok(html.includes('NAIImageStore.put'));
assert.ok(html.includes('保存した画像・設定'));

for (const name of ['indexedDB', 'function open()', 'async function put', 'async function get', 'async function remove']) {
  assert.ok(store.includes(name), `image store contract missing: ${name}`);
}
for (const name of ['uploadSnapshotAsset', 'hydrateRemoteAssets', 'firebase.storage', 'imageId', 'metadata']) {
  assert.ok(cloud.includes(name), `cloud asset contract missing: ${name}`);
}

// Legacy snapshots remain accepted through the existing imageData path.
assert.ok(html.includes("isSavedImage(snap.imageData)?snap.imageData:''"));
assert.ok(html.includes("imageId:isImageId(snap.imageId)?snap.imageId:''"));
assert.ok(html.includes('metadata:normalizeSnapshotMetadata(snap.metadata)'));

console.log('image/settings snapshot library contract: OK');
