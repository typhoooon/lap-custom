import { ref, shallowRef } from 'vue';
import {
  createLockRecord,
  isValidLockRecord,
  verifyPassword,
  type LibraryLockRecord,
} from '@/common/libraryPassword';

export interface LibraryUnlockRequest {
  token: number;
  libraryId: string;
  libraryName: string;
  resolve: (ok: boolean) => void;
}

export const libraryUnlockRequest = shallowRef<LibraryUnlockRequest | null>(null);

const STORAGE_KEY = 'lap_custom_library_locks';
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const temporaryUnlocks = new Map<string, number>();
let requestToken = 0;

function readStorage(): Record<string, LibraryLockRecord> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const clean: Record<string, LibraryLockRecord> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      // A corrupt record only disables that lock; it must never brick startup.
      if (isValidLockRecord(value)) clean[key] = value;
    }
    return clean;
  } catch {
    return {};
  }
}

function writeStorage(next: Record<string, LibraryLockRecord>): void {
  locks.value = next;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('Failed to save library lock:', error);
  }
}

// A dedicated localStorage key (instead of the Pinia config store) avoids the
// cross-window race where a settings-window write could overwrite the whole
// persisted config and silently drop a lock.
const locks = ref<Record<string, LibraryLockRecord>>(readStorage());

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) locks.value = readStorage();
  });
}

export function reloadLibraryLocks(): void {
  locks.value = readStorage();
}

export function getLibraryLock(libraryId: string): LibraryLockRecord | null {
  if (!libraryId) return null;
  return locks.value[libraryId] || null;
}

export function isLibraryLocked(libraryId: string): boolean {
  return getLibraryLock(libraryId) !== null;
}

function hasTemporaryUnlock(libraryId: string): boolean {
  const expiresAt = temporaryUnlocks.get(libraryId);
  if (!expiresAt) return false;
  if (expiresAt > Date.now()) return true;
  temporaryUnlocks.delete(libraryId);
  return false;
}

export function grantTemporaryUnlock(libraryId: string, ttlMs = 60_000): void {
  if (!libraryId) return;
  temporaryUnlocks.set(libraryId, Date.now() + Math.max(1000, ttlMs));
}

export function clearTemporaryUnlock(libraryId: string): void {
  temporaryUnlocks.delete(libraryId);
}

export async function setLibraryPassword(libraryId: string, password: string): Promise<LibraryLockRecord> {
  const record = await createLockRecord(password);
  // Re-read before writing so a lock set in another window is not dropped.
  writeStorage({ ...readStorage(), [libraryId]: record });
  grantTemporaryUnlock(libraryId);
  return record;
}

export async function verifyLibraryPassword(libraryId: string, password: string): Promise<boolean> {
  const record = getLibraryLock(libraryId);
  if (!record) return true;
  try {
    return await verifyPassword(record, password);
  } catch {
    return false;
  }
}

export function removeLibraryPassword(libraryId: string): void {
  const next = readStorage();
  if (!(libraryId in next)) return;
  delete next[libraryId];
  writeStorage(next);
  temporaryUnlocks.delete(libraryId);
}

export function requestLibraryUnlock(libraryId: string, libraryName = libraryId): Promise<boolean> {
  if (!isLibraryLocked(libraryId) || hasTemporaryUnlock(libraryId)) {
    return Promise.resolve(true);
  }

  // Only one prompt can be open at a time. A newer request supersedes an older
  // one (the older caller is told it was declined rather than left hanging).
  const previous = libraryUnlockRequest.value;
  if (previous) previous.resolve(false);

  return new Promise<boolean>((resolve) => {
    libraryUnlockRequest.value = {
      token: ++requestToken,
      libraryId,
      libraryName,
      resolve,
    };
  });
}

export function resolveLibraryUnlock(ok: boolean): void {
  const request = libraryUnlockRequest.value;
  if (!request) return;
  libraryUnlockRequest.value = null;
  if (ok) grantTemporaryUnlock(request.libraryId);
  request.resolve(ok);
}

/**
 * Gate a library switch. Returns true when the caller may proceed.
 */
export async function ensureLibraryUnlocked(libraryId: string, libraryName = libraryId): Promise<boolean> {
  if (!isLibraryLocked(libraryId)) return true;
  if (hasTemporaryUnlock(libraryId)) return true;
  return requestLibraryUnlock(libraryId, libraryName);
}
