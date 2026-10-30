export interface PreviewSelectionItem {
  id: string;
  hovered: boolean;
  priority: number;
}

/**
 * Pick which visible previews may run. Hovered items always win, then items
 * closest to the viewport centre. Kept as a pure function so the scheduler's
 * fairness/cap logic can be tested without a DOM or Pinia.
 */
export function selectPreviewCandidates<T extends PreviewSelectionItem>(
  list: T[],
  limit: number,
): T[] {
  return [...list]
    .sort((a, b) => {
      const hovered = Number(b.hovered) - Number(a.hovered);
      if (hovered !== 0) return hovered;
      return b.priority - a.priority;
    })
    .slice(0, Math.max(0, Math.floor(limit)));
}
