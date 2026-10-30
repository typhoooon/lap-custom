export interface PreviewSelectionItem {
  id: string;
  hovered: boolean;
  priority: number;
  /** The user explicitly asked this preview to play. */
  manual?: boolean;
}

/**
 * Pick which visible previews may run. Explicitly started items win so a click
 * is never starved by the cap, then hovered items, then items closest to the
 * viewport centre. Kept as a pure function so the scheduler's fairness/cap
 * logic can be tested without a DOM or Pinia.
 */
export function selectPreviewCandidates<T extends PreviewSelectionItem>(
  list: T[],
  limit: number,
): T[] {
  return [...list]
    .sort((a, b) => {
      const manual = Number(Boolean(b.manual)) - Number(Boolean(a.manual));
      if (manual !== 0) return manual;
      const hovered = Number(b.hovered) - Number(a.hovered);
      if (hovered !== 0) return hovered;
      return b.priority - a.priority;
    })
    .slice(0, Math.max(0, Math.floor(limit)));
}
