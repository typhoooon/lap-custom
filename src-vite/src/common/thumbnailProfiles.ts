export const THUMBNAIL_PROFILES = {
  // The high end is deliberately larger than the thumbnail bitmap so a wide
  // window can show only two or three columns; the quality profile still
  // bounds how much upscaling is allowed.
  256: { minGridSize: 60, maxGridSize: 300 },
  512: { minGridSize: 120, maxGridSize: 560 },
  1024: { minGridSize: 240, maxGridSize: 560 },
} as const;

export type ThumbnailSize = keyof typeof THUMBNAIL_PROFILES;

export function normalizeThumbnailSize(value: unknown): ThumbnailSize {
  const size = Number(value);
  return size === 256 || size === 1024 ? size : 512;
}

export function thumbnailProfile(value: unknown) {
  return THUMBNAIL_PROFILES[normalizeThumbnailSize(value)];
}

export function normalizeGridSizePosition(value: unknown): number {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

export function gridSizeFromPosition(position: unknown, thumbnailSize: unknown): number {
  const profile = thumbnailProfile(thumbnailSize);
  const normalizedPosition = normalizeGridSizePosition(position);
  return Math.round(profile.minGridSize + normalizedPosition * (profile.maxGridSize - profile.minGridSize));
}

export function gridSizePositionFromGridSize(gridSize: unknown, thumbnailSize: unknown): number {
  const profile = thumbnailProfile(thumbnailSize);
  const current = Math.min(profile.maxGridSize, Math.max(profile.minGridSize, Number(gridSize) || profile.minGridSize));
  return (current - profile.minGridSize) / (profile.maxGridSize - profile.minGridSize);
}
