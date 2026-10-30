import { ref } from 'vue';

/**
 * Consolidated per-folder UI state.
 *
 * One localStorage key holds the sparse overrides for grid size, scroll offset
 * and (optionally) sort/filter/group, plus the global defaults used when a
 * folder has no override. Keeping everything in one map means one JSON
 * parse/serialize and one debounced writer instead of several competing keys.
 */
const STORAGE_KEY = 'lap_custom_folder_view_state_v1';
const LEGACY_GRID_SIZE_KEY = 'lap_custom_grid_size_overrides';
const LEGACY_SCROLL_KEY = 'lap_custom_scroll_positions';
const MAX_ENTRIES = 2000;
const PERSIST_DELAY_MS = 300;

export interface FolderSearchState {
  fileType: number;
  sortType: number;
  sortOrder: number;
  groupBy: number;
}

export interface FolderViewEntry {
  sizePosition?: number;
  scrollTop?: number;
  search?: Partial<FolderSearchState>;
  updatedAt: number;
}

interface FolderViewState {
  v: 1;
  defaultsInitialized: boolean;
  defaults: FolderSearchState;
  folders: Record<string, FolderViewEntry>;
}

function clamp01(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
}

function clampOffset(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(50_000_000, number);
}

function toInt(value: unknown, fallback = 0): number {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? number : fallback;
}

function sanitizeSearch(value: unknown): Partial<FolderSearchState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const clean: Partial<FolderSearchState> = {};
  if ('fileType' in source) clean.fileType = toInt(source.fileType);
  if ('sortType' in source) clean.sortType = toInt(source.sortType);
  if ('sortOrder' in source) clean.sortOrder = toInt(source.sortOrder);
  if ('groupBy' in source) clean.groupBy = toInt(source.groupBy);
  return clean;
}

function sanitizeEntry(value: unknown): FolderViewEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const entry: FolderViewEntry = {
    updatedAt: Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : Date.now(),
  };
  if ('sizePosition' in source) entry.sizePosition = clamp01(source.sizePosition);
  if ('scrollTop' in source) entry.scrollTop = clampOffset(source.scrollTop);
  const search = sanitizeSearch(source.search);
  if (Object.keys(search).length > 0) entry.search = search;
  return entry;
}

function emptySearch(): FolderSearchState {
  return { fileType: 0, sortType: 0, sortOrder: 0, groupBy: 0 };
}

function emptyState(): FolderViewState {
  return {
    v: 1,
    defaultsInitialized: false,
    defaults: emptySearch(),
    folders: {},
  };
}

function parseState(raw: string | null): FolderViewState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const source = parsed as Record<string, unknown>;
    const state = emptyState();
    state.defaults = { ...emptySearch(), ...sanitizeSearch(source.defaults) };
    state.defaultsInitialized = source.defaultsInitialized === true;
    if (source.folders && typeof source.folders === 'object' && !Array.isArray(source.folders)) {
      for (const [key, value] of Object.entries(source.folders as Record<string, unknown>)) {
        const entry = sanitizeEntry(value);
        if (key && entry) state.folders[key] = entry;
      }
    }
    return state;
  } catch {
    return null;
  }
}

function readNumberMap(key: string): Record<string, number> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean: Record<string, number> = {};
    for (const [entryKey, value] of Object.entries(parsed as Record<string, unknown>)) {
      const number = Number(value);
      if (entryKey && Number.isFinite(number)) clean[entryKey] = number;
    }
    return clean;
  } catch {
    return {};
  }
}

function migrateLegacy(state: FolderViewState): boolean {
  if (typeof localStorage === 'undefined') return false;
  const legacySizes = readNumberMap(LEGACY_GRID_SIZE_KEY);
  const legacyScrolls = readNumberMap(LEGACY_SCROLL_KEY);
  if (Object.keys(legacySizes).length === 0 && Object.keys(legacyScrolls).length === 0) return false;

  const now = Date.now();
  for (const [key, value] of Object.entries(legacySizes)) {
    const entry = state.folders[key] ?? { updatedAt: now };
    if (entry.sizePosition === undefined) entry.sizePosition = clamp01(value);
    entry.updatedAt = now;
    state.folders[key] = entry;
  }
  for (const [key, value] of Object.entries(legacyScrolls)) {
    const entry = state.folders[key] ?? { updatedAt: now };
    if (entry.scrollTop === undefined) entry.scrollTop = clampOffset(value);
    entry.updatedAt = now;
    state.folders[key] = entry;
  }
  return true;
}

function persistedState(): FolderViewState {
  if (typeof localStorage === 'undefined') return emptyState();
  const loaded = parseState(localStorage.getItem(STORAGE_KEY));
  const state = loaded ?? emptyState();
  const migrated = migrateLegacy(state);
  if (migrated) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      localStorage.removeItem(LEGACY_GRID_SIZE_KEY);
      localStorage.removeItem(LEGACY_SCROLL_KEY);
    } catch (error) {
      console.warn('Failed to migrate folder view state:', error);
    }
  }
  return state;
}

let state = persistedState();
let dirty = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

/** Bumped on every in-memory change so computeds can track the plain map. */
export const folderViewRevision = ref(0);

function pruneIfNeeded(): void {
  const keys = Object.keys(state.folders);
  if (keys.length <= MAX_ENTRIES) return;
  keys
    .sort((a, b) => (state.folders[b]?.updatedAt || 0) - (state.folders[a]?.updatedAt || 0))
    .slice(MAX_ENTRIES)
    .forEach((key) => { delete state.folders[key]; });
}

function writeNow(): void {
  if (!dirty || typeof localStorage === 'undefined') return;
  pruneIfNeeded();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    dirty = false;
    // Legacy keys are only removed after the consolidated state is safely saved.
    localStorage.removeItem(LEGACY_GRID_SIZE_KEY);
    localStorage.removeItem(LEGACY_SCROLL_KEY);
  } catch (error) {
    // Quota pressure: drop to a smaller set and retry once, then keep memory.
    try {
      const keys = Object.keys(state.folders);
      keys
        .sort((a, b) => (state.folders[b]?.updatedAt || 0) - (state.folders[a]?.updatedAt || 0))
        .slice(1000)
        .forEach((key) => { delete state.folders[key]; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      dirty = false;
      localStorage.removeItem(LEGACY_GRID_SIZE_KEY);
      localStorage.removeItem(LEGACY_SCROLL_KEY);
    } catch (retryError) {
      console.warn('Failed to save folder view state:', retryError, error);
    }
  }
}

function markDirty(): void {
  dirty = true;
  // Debounce: continuous scrolling/slider input produces one trailing write.
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    writeNow();
  }, PERSIST_DELAY_MS);
}

export function flushFolderView(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  writeNow();
}

export function makeFolderViewKey(
  libraryId: unknown,
  albumId: unknown,
  folderPath: unknown,
): string {
  const id = Number(albumId || 0);
  if (!id) return '';
  return `${libraryId || ''}:${id}:${folderPath || ''}`;
}

export function getFolderView(key: string): FolderViewEntry | undefined {
  folderViewRevision.value;
  return key ? state.folders[key] : undefined;
}

export function patchFolderView(key: string, patch: Partial<FolderViewEntry>): void {
  if (!key) return;
  const current = state.folders[key] ?? { updatedAt: 0 };
  const next: FolderViewEntry = {
    ...current,
    updatedAt: Date.now(),
  };
  if (patch.sizePosition !== undefined) next.sizePosition = clamp01(patch.sizePosition);
  if (patch.scrollTop !== undefined) next.scrollTop = clampOffset(patch.scrollTop);
  if (patch.search) {
    next.search = { ...(current.search || {}), ...sanitizeSearch(patch.search) };
  }
  state.folders[key] = next;
  folderViewRevision.value++;
  markDirty();
}

export function getSearchDefaults(): FolderSearchState {
  folderViewRevision.value;
  return state.defaults;
}

export function ensureSearchDefaults(values: Partial<FolderSearchState>): void {
  if (state.defaultsInitialized) return;
  state.defaults = { ...emptySearch(), ...sanitizeSearch(values) };
  state.defaultsInitialized = true;
  folderViewRevision.value++;
  markDirty();
}

export function setSearchDefaults(values: Partial<FolderSearchState>): void {
  state.defaults = { ...emptySearch(), ...sanitizeSearch(values) };
  state.defaultsInitialized = true;
  folderViewRevision.value++;
  markDirty();
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushFolderView);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushFolderView();
  });
}
