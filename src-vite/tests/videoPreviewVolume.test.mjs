import { test } from 'node:test';
import assert from 'node:assert/strict';

// The module reads localStorage at import time; install a minimal stub first.
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

const {
  getStoredPreviewVolume,
  setStoredPreviewVolume,
  clearStoredPreviewVolume,
} = await import('../src/common/videoPreviewVolume.ts');

test('per-file preview volumes are isolated and clamped', () => {
  setStoredPreviewVolume('lib1:1', 0.2);
  setStoredPreviewVolume('lib1:2', 2);
  setStoredPreviewVolume('lib2:1', -1);

  assert.equal(getStoredPreviewVolume('lib1:1'), 0.2);
  assert.equal(getStoredPreviewVolume('lib1:2'), 1);
  assert.equal(getStoredPreviewVolume('lib2:1'), 0);
  assert.equal(getStoredPreviewVolume('lib1:missing'), null);

  clearStoredPreviewVolume('lib1:1');
  assert.equal(getStoredPreviewVolume('lib1:1'), null);
});
