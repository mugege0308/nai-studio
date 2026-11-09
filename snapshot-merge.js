/* Conflict-safe merge helpers for image/settings snapshots.
 * The browser keeps the local record until a newer remote record is available.
 * This is deliberately metadata-only; original image bytes remain in IndexedDB.
 */
(function (root, factory) {
  const api = factory();
  if (root) root.NAISnapshotMerge = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function itemsOf(value) {
    if (Array.isArray(value)) return value.filter(item => item && typeof item === 'object');
    return Object.values(value || {}).filter(item => item && typeof item === 'object');
  }

  function idOf(item) {
    return typeof item?.id === 'string' && item.id ? item.id : '';
  }

  function timeOf(item) {
    const value = item?.updatedAt || item?.date || '';
    const time = Date.parse(String(value));
    return Number.isFinite(time) ? time : 0;
  }

  function same(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) { return false; }
  }

  function choose(local, remote) {
    const localTime = timeOf(local), remoteTime = timeOf(remote);
    // A tie is resolved locally. This prevents an old/equal-timestamp cloud
    // event from erasing a just-saved local snapshot during startup.
    return remoteTime > localTime ? remote : local;
  }

  function merge(localValue, remoteValue) {
    const local = itemsOf(localValue), remote = itemsOf(remoteValue);
    const localById = new Map(local.map(item => [idOf(item), item]).filter(([id]) => id));
    const remoteById = new Map(remote.map(item => [idOf(item), item]).filter(([id]) => id));
    const result = local.map(item => {
      const remoteItem = remoteById.get(idOf(item));
      return remoteItem ? choose(item, remoteItem) : item;
    });
    for (const item of remote) if (idOf(item) && !localById.has(idOf(item))) result.push(item);
    return result;
  }

  function localNeedsUpload(localValue, remoteValue) {
    const remoteById = new Map(itemsOf(remoteValue).map(item => [idOf(item), item]).filter(([id]) => id));
    return itemsOf(localValue).some(local => {
      const id = idOf(local), remote = remoteById.get(id);
      if (!id || !remote) return Boolean(id);
      return choose(local, remote) === local && !same(local, remote);
    });
  }

  return { timeOf, merge, localNeedsUpload };
});
