import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createLockRecord,
  isValidLockRecord,
  verifyPassword,
} from '../src/common/libraryPassword.ts';

const FAST = { iterations: 1000 };

test('correct password verifies; wrong password fails', async () => {
  const record = await createLockRecord('correct horse battery staple', FAST);
  assert.equal(await verifyPassword(record, 'correct horse battery staple'), true);
  assert.equal(await verifyPassword(record, 'wrong password'), false);
  assert.equal(await verifyPassword(record, ''), false);
});

test('each lock uses a fresh salt and hash', async () => {
  const a = await createLockRecord('same password', FAST);
  const b = await createLockRecord('same password', FAST);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
  assert.equal(await verifyPassword(a, 'same password'), true);
  assert.equal(await verifyPassword(b, 'same password'), true);
});

test('unicode passwords round-trip', async () => {
  const password = '照片库-密码-🔐';
  const record = await createLockRecord(password, FAST);
  assert.equal(await verifyPassword(record, password), true);
  assert.equal(await verifyPassword(record, '照片库-密码'), false);
});

test('empty passwords are rejected when creating a lock', async () => {
  await assert.rejects(() => createLockRecord('', FAST), /PASSWORD_EMPTY/);
});

test('corrupt lock records are rejected instead of locking the user out', async () => {
  const record = await createLockRecord('password', FAST);
  assert.equal(isValidLockRecord(record), true);

  assert.equal(isValidLockRecord(null), false);
  assert.equal(isValidLockRecord([]), false);
  assert.equal(isValidLockRecord({ ...record, v: 2 }), false);
  assert.equal(isValidLockRecord({ ...record, alg: 'SHA-1' }), false);
  assert.equal(isValidLockRecord({ ...record, iterations: 10 }), false);
  assert.equal(isValidLockRecord({ ...record, salt: 'AAAA' }), false);
  assert.equal(isValidLockRecord({ ...record, hash: 'AAAA' }), false);
  assert.equal(await verifyPassword({ ...record, salt: 'AAAA' }, 'password'), false);
});

test('a stored iteration count is honored', async () => {
  const record = await createLockRecord('password', { iterations: 2000 });
  assert.equal(record.iterations, 2000);
  assert.equal(await verifyPassword(record, 'password'), true);
});
