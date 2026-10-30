import { ref } from 'vue';

/**
 * Per-file thumbnail preview volume overrides.
 *
 * The Settings value remains the default. A slider moved on one thumbnail only
 * changes that file (keyed by library + catalog file id), so a very loud clip
 * stays quiet on the next visit instead of resetting to the default.
 */
const STORAGE_KEY = 'lap_custom_video_preview_volumes';
const MAX_ENTRIES = 2000;

function clampVolume(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.8;
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
      clean[key] = clampVolume(value);
    }
    return clean;
  } catch {
    return {};
  }
}

const storedVolumes = ref<Record<string, number>>(readStorage());

function writeStorage(next: Record<string, number>): void {
  storedVolumes.value = next;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('Failed to save thumbnail preview volume:', error);
  }
}

export function getStoredPreviewVolume(key: string): number | null {
  if (!key) return null;
  const value = storedVolumes.value[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function setStoredPreviewVolume(key: string, volume: number): void {
  if (!key) return;
  const next = { ...storedVolumes.value };
  // Re-insert so the most recently touched entries survive the soft cap.
  delete next[key];
  next[key] = clampVolume(volume);
  const entries = Object.entries(next);
  writeStorage(entries.length > MAX_ENTRIES
    ? Object.fromEntries(entries.slice(entries.length - MAX_ENTRIES))
    : next);
}

export function clearStoredPreviewVolume(key: string): void {
  if (!key || !(key in storedVolumes.value)) return;
  const next = { ...storedVolumes.value };
  delete next[key];
  writeStorage(next);
}
