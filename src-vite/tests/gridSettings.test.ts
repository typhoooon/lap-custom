import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGridSettings } from '../src/common/gridSettings.ts';

test('missing fork settings receive defaults', () => {
  const grid = normalizeGridSettings({ style: 2 });
  assert.equal(grid.style, 2);
  assert.equal(grid.rememberScrollPosition, true);
  assert.equal(grid.perFolderSize, false);
  assert.deepEqual(grid.balanced, {
    portraitBoost: 0.3,
    maxRowHeightMultiplier: 1.5,
  });
  assert.deepEqual(grid.enhancedMasonry, {
    maxSpan: 2,
    adaptiveSpan: true,
    spanThreshold: 1.4,
  });
  assert.equal(grid.videoAutoplay, true);
  assert.equal(grid.videoAutoplayLimit, 8);
  assert.equal(grid.videoSingleAudio, true);
  assert.equal(grid.videoPreviewLoop, true);
  assert.equal(grid.videoPreviewVolume, 0.8);
  assert.equal(grid.videoPreviewCountdown, false);
});

test('out-of-range and corrupt values are clamped', () => {
  const grid = normalizeGridSettings({
    style: 99,
    balanced: { portraitBoost: 5, maxRowHeightMultiplier: -1 },
    enhancedMasonry: { maxSpan: 9, adaptiveSpan: false, spanThreshold: 'bad' },
    videoAutoplay: false,
    videoAutoplayLimit: 100,
    videoSingleAudio: false,
    videoPreviewLoop: false,
    videoPreviewVolume: 3,
    videoPreviewCountdown: true,
    videoPreviewProgressBar: false,
    rememberScrollPosition: false,
    perFolderSize: true,
  });
  assert.equal(grid.style, 5);
  assert.equal(grid.balanced.portraitBoost, 0.8);
  assert.equal(grid.balanced.maxRowHeightMultiplier, 1);
  assert.equal(grid.enhancedMasonry.maxSpan, 3);
  assert.equal(grid.enhancedMasonry.adaptiveSpan, false);
  assert.equal(grid.enhancedMasonry.spanThreshold, 1.4);
  assert.equal(grid.videoAutoplay, false);
  assert.equal(grid.videoAutoplayLimit, 64);
  assert.equal(grid.videoSingleAudio, false);
  assert.equal(grid.videoPreviewLoop, false);
  assert.equal(grid.videoPreviewVolume, 1);
  assert.equal(grid.videoPreviewCountdown, true);
  assert.equal(grid.videoPreviewProgressBar, false);
  assert.equal(grid.rememberScrollPosition, false);
  assert.equal(grid.perFolderSize, true);
});

test('explicit false/zero values are preserved where valid', () => {
  const grid = normalizeGridSettings({
    style: 0,
    balanced: { portraitBoost: 0, maxRowHeightMultiplier: 1 },
    enhancedMasonry: { maxSpan: 1, adaptiveSpan: true, spanThreshold: 1 },
    videoAutoplay: true,
    videoAutoplayLimit: 4,
    videoPreviewLoop: true,
    videoPreviewVolume: 0,
  });
  assert.equal(grid.balanced.portraitBoost, 0);
  assert.equal(grid.enhancedMasonry.maxSpan, 1);
  assert.equal(grid.videoAutoplayLimit, 4);
  assert.equal(grid.videoPreviewVolume, 0);

  // Zero is a valid limit: no explicit cap (visibility still applies).
  const unlimited = normalizeGridSettings({ videoAutoplayLimit: 0 });
  assert.equal(unlimited.videoAutoplayLimit, 0);
});
