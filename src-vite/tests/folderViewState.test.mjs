import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};

// Seed the two legacy keys; importing the module should migrate them.
store.set('lap_custom_grid_size_overrides', JSON.stringify({ 'lib:1:/a': 0.4 }));
store.set('lap_custom_scroll_positions', JSON.stringify({ 'lib:1:/a': 1234 }));

const {
  makeFolderViewKey,
  getFolderView,
  patchFolderView,
  ensureSearchDefaults,
  setSearchDefaults,
  getSearchDefaults,
  flushFolderView,
} = await import('../src/common/folderViewState.ts');

test('folder keys are only created for real albums', () => {
  assert.equal(makeFolderViewKey('lib', 0, '/a'), '');
  assert.equal(makeFolderViewKey('lib', 7, '/a'), 'lib:7:/a');
});

test('legacy size/scroll values migrate into one entry', () => {
  const entry = getFolderView('lib:1:/a');
  assert.equal(entry?.sizePosition, 0.4);
  assert.equal(entry?.scrollTop, 1234);
});

test('defaults initialize once and can be replaced explicitly', () => {
  ensureSearchDefaults({ fileType: 2, sortType: 3, sortOrder: 1, groupBy: 4 });
  assert.deepEqual(getSearchDefaults(), { fileType: 2, sortType: 3, sortOrder: 1, groupBy: 4 });
  ensureSearchDefaults({ fileType: 99, sortType: 99, sortOrder: 99, groupBy: 99 });
  assert.equal(getSearchDefaults().fileType, 2);

  setSearchDefaults({ fileType: 1, sortType: 0, sortOrder: 0, groupBy: 0 });
  assert.deepEqual(getSearchDefaults(), { fileType: 1, sortType: 0, sortOrder: 0, groupBy: 0 });
});

test('patches merge per folder and the consolidated key replaces legacy keys', () => {
  patchFolderView('lib:2:/b', { sizePosition: 2, scrollTop: -5 });
  patchFolderView('lib:2:/b', { search: { sortType: 3, sortOrder: 1 } });
  const entry = getFolderView('lib:2:/b');
  assert.equal(entry?.sizePosition, 1);
  assert.equal(entry?.scrollTop, 0);
  assert.equal(entry?.search?.sortType, 3);
  assert.equal(entry?.search?.sortOrder, 1);

  flushFolderView();
  const saved = JSON.parse(store.get('lap_custom_folder_view_state_v1'));
  assert.equal(saved.folders['lib:2:/b'].search.sortType, 3);
  assert.equal(store.has('lap_custom_grid_size_overrides'), false);
  assert.equal(store.has('lap_custom_scroll_positions'), false);
});
