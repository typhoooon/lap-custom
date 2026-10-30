import { ref } from 'vue';

/**
 * Per-folder grid-size overrides.
 *
 * The Settings/toolbar value remains the default. When "remember grid size per
 * folder" is enabled, moving the slider inside a folder stores its 0–1 slider
 * position here, keyed by library + album + folder path.
 */
const STORAGE_KEY = 'lap_custom_grid_size_overrides';
const MAX_ENTRIES = 2000;

function clampPosition(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
}

function readStorage(): Record<string, number> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!key || !Number.isFinite(Number(value))) continue;
      clean[key] = clampPosition(value);
    }
    return clean;
  } catch {
    return {};
  }
}

const storedPositions = ref<Record<string, number>>(readStorage());

function writeStorage(next: Record<string, number>): void {
  storedPositions.value = next;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('Failed to save grid size override:', error);
  }
}

export function getStoredGridSizePosition(key: string): number | null {
  if (!key) return null;
  const value = storedPositions.value[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function setStoredGridSizePosition(key: string, position: number): void {
  if (!key) return;
  const next = { ...storedPositions.value };
  delete next[key];
  next[key] = clampPosition(position);
  const entries = Object.entries(next);
  writeStorage(entries.length > MAX_ENTRIES
    ? Object.fromEntries(entries.slice(entries.length - MAX_ENTRIES))
    : next);
}

export function clearStoredGridSizePosition(key: string): void {
  if (!key || !(key in storedPositions.value)) return;
  const next = { ...storedPositions.value };
  delete next[key];
  writeStorage(next);
}
