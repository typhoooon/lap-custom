/**
 * Pure normalization for persisted grid settings. Kept separate from the Pinia
 * store so it can be unit tested without the `@` alias or a browser.
 */

export function clampSetting(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

/**
 * Normalize fork-specific grid settings loaded from an older persisted state.
 * Mutates and returns the grid object (matching how the store hydrates).
 */
export function normalizeGridSettings(grid: any): any {
  if (!grid || typeof grid !== 'object') return grid;

  grid.style = Math.round(clampSetting(grid.style, 0, 5, 0));

  const balanced = grid.balanced && typeof grid.balanced === 'object' ? grid.balanced : {};
  grid.balanced = {
    portraitBoost: clampSetting(balanced.portraitBoost, 0, 0.8, 0.3),
    maxRowHeightMultiplier: clampSetting(balanced.maxRowHeightMultiplier, 1, 2, 1.5),
  };

  const enhanced = grid.enhancedMasonry && typeof grid.enhancedMasonry === 'object'
    ? grid.enhancedMasonry
    : {};
  grid.enhancedMasonry = {
    maxSpan: Math.round(clampSetting(enhanced.maxSpan, 1, 3, 2)),
    adaptiveSpan: enhanced.adaptiveSpan !== false,
    spanThreshold: clampSetting(enhanced.spanThreshold, 1, 3, 1.4),
  };

  grid.videoAutoplay = grid.videoAutoplay !== false;
  // 0 means "no explicit cap"; visibility still limits playback to the screen.
  grid.videoAutoplayLimit = Math.round(clampSetting(grid.videoAutoplayLimit, 0, 64, 8));
  grid.videoSingleAudio = grid.videoSingleAudio !== false;
  grid.videoPreviewLoop = grid.videoPreviewLoop !== false;
  grid.videoPreviewVolume = clampSetting(grid.videoPreviewVolume, 0, 1, 0.8);

  return grid;
}
