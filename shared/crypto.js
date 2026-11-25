// Shared by the browser and the CLI: both expose WebCrypto as globalThis.crypto.
const ALGORITHM = 'AES-GCM';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const CHUNK_SIZE = 0x8000;

export const ENCRYPTION_OVERHEAD = IV_BYTES + TAG_BYTES;

export class DecryptionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DecryptionError';
  }
}

export function toBase64Url(bytes) {
  let binary = '';
  // Chunked to avoid "too many arguments" on large arrays.
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function fromBase64Url(text) {
  // A length of 4n+1 can never be produced by base64 encoding.
  if (typeof text !== 'string' || !/^[\w-]*$/.test(text) || text.length % 4 === 1) {
    throw new DecryptionError('Invalid base64url string');
  }
  const base64 = text.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function importRawKey(raw) {
  return crypto.subtle.importKey('raw', raw, ALGORITHM, false, ['encrypt', 'decrypt']);
}

export async function generateKey() {
  const raw = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
  return { key: await importRawKey(raw), encodedKey: toBase64Url(raw) };
}

export async function importKey(encodedKey) {
  const raw = fromBase64Url(encodedKey);
  if (raw.length !== KEY_BYTES) throw new DecryptionError('Invalid key length');
  return importRawKey(raw);
}

export async function encryptBytes(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, data));
  const result = new Uint8Array(IV_BYTES + cipher.length);
  result.set(iv);
  result.set(cipher, IV_BYTES);
  return result;
}

export async function decryptBytes(key, blob) {
  if (blob.length < ENCRYPTION_OVERHEAD) throw new DecryptionError('Encrypted data is too short');
  const iv = blob.subarray(0, IV_BYTES);
  try {
    const plain = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, blob.subarray(IV_BYTES));
    return new Uint8Array(plain);
  } catch (error) {
    throw new DecryptionError(`Decryption failed: wrong key or corrupted data (${error.name})`);
  }
}

export function encryptJson(key, value) {
  return encryptBytes(key, new TextEncoder().encode(JSON.stringify(value)));
}

export async function decryptJson(key, blob) {
  return JSON.parse(new TextDecoder().decode(await decryptBytes(key, blob)));
}
