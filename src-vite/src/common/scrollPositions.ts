import { ref } from 'vue';

/**
 * Last vertical scroll offset per album/folder, used when "restore the last
 * position when switching albums" is enabled.
 */
const STORAGE_KEY = 'lap_custom_scroll_positions';
const MAX_ENTRIES = 2000;

function clampOffset(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(50_000_000, number);
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
      clean[key] = clampOffset(value);
    }
    return clean;
  } catch {
    return {};
  }
}

const storedOffsets = ref<Record<string, number>>(readStorage());

function writeStorage(next: Record<string, number>): void {
  storedOffsets.value = next;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('Failed to save scroll position:', error);
  }
}

export function getStoredScrollTop(key: string): number | null {
  if (!key) return null;
  const value = storedOffsets.value[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function setStoredScrollTop(key: string, offset: number): void {
  if (!key) return;
  const next = { ...storedOffsets.value };
  delete next[key];
  next[key] = clampOffset(offset);
  const entries = Object.entries(next);
  writeStorage(entries.length > MAX_ENTRIES
    ? Object.fromEntries(entries.slice(entries.length - MAX_ENTRIES))
    : next);
}
