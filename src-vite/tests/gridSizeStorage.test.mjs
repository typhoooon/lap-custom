import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

const {
  getStoredGridSizePosition,
  setStoredGridSizePosition,
  clearStoredGridSizePosition,
} = await import('../src/common/gridSizeOverrides.ts');
const {
  getStoredScrollTop,
  setStoredScrollTop,
} = await import('../src/common/scrollPositions.ts');

test('grid size overrides are per folder and clamped', () => {
  setStoredGridSizePosition('lib1:7:/a', 0.4);
  setStoredGridSizePosition('lib1:8:/a', 2);
  setStoredGridSizePosition('lib1:9:/a', -1);

  assert.equal(getStoredGridSizePosition('lib1:7:/a'), 0.4);
  assert.equal(getStoredGridSizePosition('lib1:8:/a'), 1);
  assert.equal(getStoredGridSizePosition('lib1:9:/a'), 0);
  assert.equal(getStoredGridSizePosition('missing'), null);

  clearStoredGridSizePosition('lib1:7:/a');
  assert.equal(getStoredGridSizePosition('lib1:7:/a'), null);
});

test('scroll offsets are per context and non-negative', () => {
  setStoredScrollTop('lib1:7:/a', 1234);
  setStoredScrollTop('lib1:8:/a', -50);

  assert.equal(getStoredScrollTop('lib1:7:/a'), 1234);
  assert.equal(getStoredScrollTop('lib1:8:/a'), 0);
  assert.equal(getStoredScrollTop('missing'), null);
});
