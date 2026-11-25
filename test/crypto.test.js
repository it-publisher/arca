import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DecryptionError, decryptBytes, decryptJson, encryptBytes, encryptJson,
  fromBase64Url, generateKey, importKey, toBase64Url,
} from '../shared/crypto.js';

test('base64url roundtrip for large binary data', () => {
  const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => (i * 31) % 256);
  assert.deepEqual(fromBase64Url(toBase64Url(bytes)), bytes);
});

test('decrypts JSON with a key restored from its encoded form', async () => {
  const { key, encodedKey } = await generateKey();
  const blob = await encryptJson(key, { text: 'привет' });
  assert.deepEqual(await decryptJson(await importKey(encodedKey), blob), { text: 'привет' });
});

test('fails loudly with a wrong key', async () => {
  const { key } = await generateKey();
  const { key: otherKey } = await generateKey();
  const blob = await encryptBytes(key, new Uint8Array([1, 2, 3]));
  await assert.rejects(decryptBytes(otherKey, blob), DecryptionError);
});

test('detects tampered ciphertext', async () => {
  const { key } = await generateKey();
  const blob = await encryptBytes(key, new Uint8Array([1, 2, 3]));
  blob[blob.length - 1] ^= 1;
  await assert.rejects(decryptBytes(key, blob), DecryptionError);
});

test('rejects malformed keys', async () => {
  await assert.rejects(importKey('short'), DecryptionError);
  await assert.rejects(importKey('not base64!'), DecryptionError);
});
