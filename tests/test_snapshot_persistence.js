const assert = require('assert');
const fs = require('fs');

const merge = require('../snapshot-merge.js');
const html = fs.readFileSync('index.html', 'utf8');
const cloud = fs.readFileSync('cloud-sync.js', 'utf8');

const local = [
  { id: 'local-only', name: '端末で保存した設定', date: '2026-11-09T00:00:00.000Z', updatedAt: '2026-11-09T00:00:00.000Z' },
  { id: 'same', name: '端末側の名前', date: '2026-11-08T00:00:00.000Z', updatedAt: '2026-11-09T01:00:00.000Z' }
];
const oldRemote = {
  same: { id: 'same', name: '古いクラウド名', date: '2026-11-08T00:00:00.000Z', updatedAt: '2026-11-08T23:00:00.000Z' },
  'remote-only': { id: 'remote-only', name: '別端末の設定', date: '2026-11-07T00:00:00.000Z', updatedAt: '2026-11-07T00:00:00.000Z' }
};

const merged = merge.merge(local, oldRemote);
assert.deepStrictEqual(merged.map(item => item.id), ['local-only', 'same', 'remote-only']);
assert.strictEqual(merged.find(item => item.id === 'same').name, '端末側の名前', 'older cloud data must not replace local data');
assert.strictEqual(merge.localNeedsUpload(local, oldRemote), true, 'local-only/newer local data must be scheduled for upload');

const newerRemote = {
  same: { id: 'same', name: '新しいクラウド名', date: '2026-11-08T00:00:00.000Z', updatedAt: '2026-11-09T02:00:00.000Z' }
};
assert.strictEqual(merge.merge(local, newerRemote).find(item => item.id === 'same').name, '新しいクラウド名');
assert.strictEqual(merge.localNeedsUpload([{ id: 'same', name: '同じ', date: '2026-11-09T00:00:00.000Z', updatedAt: '2026-11-09T00:00:00.000Z' }], newerRemote), false);

assert(html.includes('<script src="./snapshot-merge.js"></script>'));
assert(html.includes('updatedAt'));
assert(cloud.includes('cloudPull({merge:true})'), 'automatic startup pull must merge local snapshots');
assert(cloud.includes('applyIncomingSnapshots(remoteSnapshots,{merge:true})'), 'live Firebase snapshot events must merge safely');
assert(cloud.includes('hydrateRemoteAssets(assets)'), 'image references must hydrate after the list is persisted');

console.log('snapshot save/reload/restore and stale-cloud protection contract: OK');
