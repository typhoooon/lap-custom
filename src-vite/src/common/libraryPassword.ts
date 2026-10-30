/**
 * Frontend-only library password helpers.
 *
 * This is a deterrent for casual access inside the app, not disk encryption.
 * The salt and PBKDF2 hash live in the app's persisted config (localStorage),
 * so anyone with filesystem/devtools access can remove or replace a lock.
 */

export interface LibraryLockRecord {
  v: 1;
  alg: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  hash: string;
  createdAt: number;
}

const DEFAULT_ITERATIONS = 120000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

function requireCrypto(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('PASSWORD_CRYPTO_UNAVAILABLE');
  }
  return globalThis.crypto.subtle;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const subtle = requireCrypto();
  const material = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function createLockRecord(
  password: string,
  options: { iterations?: number } = {},
): Promise<LibraryLockRecord> {
  if (!password) throw new Error('PASSWORD_EMPTY');
  const iterations = Math.max(1000, Math.min(1_000_000, Math.round(Number(options.iterations) || DEFAULT_ITERATIONS)));
  const salt = new Uint8Array(SALT_BYTES);
  globalThis.crypto.getRandomValues(salt);
  const hash = await derive(password, salt, iterations);
  return {
    v: 1,
    alg: 'PBKDF2-SHA256',
    iterations,
    salt: bytesToBase64(salt),
    hash: bytesToBase64(hash),
    createdAt: Date.now(),
  };
}

export async function verifyPassword(record: LibraryLockRecord, password: string): Promise<boolean> {
  if (!isValidLockRecord(record) || !password) return false;
  const expected = base64ToBytes(record.hash);
  const actual = await derive(password, base64ToBytes(record.salt), record.iterations);
  return constantTimeEqual(actual, expected);
}

export function isValidLockRecord(record: unknown): record is LibraryLockRecord {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  const candidate = record as Partial<LibraryLockRecord>;
  if (candidate.v !== 1 || candidate.alg !== 'PBKDF2-SHA256') return false;
  if (!Number.isFinite(candidate.iterations)) return false;
  const iterations = Number(candidate.iterations);
  if (iterations < 1000 || iterations > 1_000_000) return false;
  if (typeof candidate.salt !== 'string' || typeof candidate.hash !== 'string') return false;
  try {
    return base64ToBytes(candidate.salt).length === SALT_BYTES
      && base64ToBytes(candidate.hash).length === HASH_BYTES;
  } catch {
    return false;
  }
}
