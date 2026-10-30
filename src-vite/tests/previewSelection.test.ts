import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectPreviewCandidates } from '../src/common/previewSelection.ts';

const item = (id: string, hovered: boolean, priority: number) => ({ id, hovered, priority });

test('hovered previews win over higher priority ones', () => {
  const selected = selectPreviewCandidates(
    [item('a', false, 1), item('b', true, 0.1), item('c', false, 0.9)],
    2,
  );
  assert.deepEqual(selected.map((entry) => entry.id), ['b', 'a']);
});

test('visible previews are ordered by priority then capped', () => {
  const selected = selectPreviewCandidates(
    [item('low', false, 0.1), item('high', false, 0.9), item('mid', false, 0.5)],
    2,
  );
  assert.deepEqual(selected.map((entry) => entry.id), ['high', 'mid']);
});

test('limit changes and degenerate inputs are handled', () => {
  const items = [item('a', false, 0.2), item('b', false, 0.8)];
  assert.deepEqual(selectPreviewCandidates(items, 0), []);
  assert.deepEqual(selectPreviewCandidates(items, -5), []);
  assert.deepEqual(selectPreviewCandidates([], 8), []);
  assert.equal(selectPreviewCandidates(items, 99).length, 2);
});

test('selection is deterministic for equal priorities', () => {
  const items = [item('first', false, 1), item('second', false, 1)];
  assert.deepEqual(
    selectPreviewCandidates(items, 1).map((entry) => entry.id),
    ['first'],
  );
});
