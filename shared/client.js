// API client shared by the web UI and the CLI. Everything is encrypted before it leaves this module.
//
// An access code is "<token>.<historyKey>". Only the token is ever sent to the server; the history
// key stays on the device and encrypts the owner's list of notes (each note's key + title).
import {
  DecryptionError, decryptBytes, decryptJson, encryptBytes, encryptJson,
  fromBase64Url, generateKey, importKey, toBase64Url,
} from './crypto.js';
import { buildNote, getNoteTitle, ID_PATTERN, parseNote } from './note.js';

const ACCESS_CODE_PATTERN = /^([\w-]{24,})\.([\w-]{43})$/;
const OWNER_ENTRY_VERSION = 1;

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function readErrorMessage(response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return `HTTP ${response.status}`;
  const body = await response.json();
  return body.error ?? `HTTP ${response.status}`;
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new ApiError(response.status, await readErrorMessage(response));
  return response;
}

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

export function parseAccessCode(accessCode) {
  const match = ACCESS_CODE_PATTERN.exec(typeof accessCode === 'string' ? accessCode.trim() : '');
  if (!match) throw new Error('Invalid access code, expected "<token>.<key>"');
  return { token: match[1], historyKey: match[2] };
}

/** Appends a fresh history key to a server token. Generate once per person and keep it like a password. */
export async function createAccessCode(token) {
  const { encodedKey } = await generateKey();
  const accessCode = `${token}.${encodedKey}`;
  parseAccessCode(accessCode); // fails fast on a malformed token
  return accessCode;
}

async function openAccessCode(accessCode) {
  const { token, historyKey } = parseAccessCode(accessCode);
  return { token, ownerKey: await importKey(historyKey) };
}

function encryptOwnerEntry(ownerKey, encodedKey, text, files) {
  return encryptJson(ownerKey, { v: OWNER_ENTRY_VERSION, key: encodedKey, title: getNoteTitle(text, files) });
}

async function uploadFile({ baseUrl, token, key, file }) {
  const response = await request(`${baseUrl}/api/files`, {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/octet-stream' },
    body: await encryptBytes(key, file.data),
  });
  const { id } = await response.json();
  return { id, name: file.name, type: file.type || 'application/octet-stream', size: file.data.length };
}

/** files: [{ name, type, data: Uint8Array }] */
export async function publishNote({
  baseUrl = '', accessCode, text = '', format = 'md', language, files = [], expiresIn = null, burnAfterRead = false,
}) {
  const { token, ownerKey } = await openAccessCode(accessCode);
  const { key, encodedKey } = await generateKey();
  const fileEntries = [];
  for (const file of files) {
    fileEntries.push(await uploadFile({ baseUrl, token, key, file }));
  }
  const payload = await encryptJson(key, buildNote({ text, format, language, files: fileEntries }));
  const ownerEntry = await encryptOwnerEntry(ownerKey, encodedKey, text, fileEntries);
  const response = await request(`${baseUrl}/api/notes`, {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: toBase64Url(payload),
      ownerEntry: toBase64Url(ownerEntry),
      files: fileEntries.map((f) => f.id),
      expiresIn,
      burnAfterRead,
    }),
  });
  const { id } = await response.json();
  return { id, encodedKey, path: `/n/${id}#${encodedKey}` };
}

/**
 * The owner's live notes, newest first. Entries written with another history key can't be read
 * and are only counted, so a mismatched access code is noticeable instead of silently empty.
 */
export async function listNotes({ baseUrl = '', accessCode }) {
  const { token, ownerKey } = await openAccessCode(accessCode);
  const response = await request(`${baseUrl}/api/notes`, { headers: authHeader(token) });
  const { notes } = await response.json();
  const items = [];
  let unreadableCount = 0;
  for (const note of notes) {
    try {
      const entry = await decryptJson(ownerKey, fromBase64Url(note.entry));
      items.push({
        id: note.id,
        key: entry.key,
        title: entry.title,
        createdAt: note.createdAt,
        expiresAt: note.expiresAt,
        isBurnAfterRead: note.burnAfterRead,
        isBurned: note.isBurned,
      });
    } catch (error) {
      if (!(error instanceof DecryptionError)) throw error;
      unreadableCount += 1;
    }
  }
  return { items, unreadableCount };
}

/**
 * A burn-after-read note is opened (and destroyed) only after confirmBurn() resolves true;
 * returns null if the reader declines.
 */
export async function fetchNote({ baseUrl = '', id, encodedKey, confirmBurn = async () => true }) {
  const key = await importKey(encodedKey);
  const noteUrl = `${baseUrl}/api/notes/${encodeURIComponent(id)}`;
  let data = await (await request(noteUrl)).json();
  if (data.burnAfterRead) {
    if (!(await confirmBurn())) return null;
    data = await (await request(`${noteUrl}/open`, { method: 'POST' })).json();
  }
  const note = parseNote(await decryptJson(key, fromBase64Url(data.payload)));
  return { note, key, createdAt: data.createdAt, expiresAt: data.expiresAt, burnAfterRead: data.burnAfterRead };
}

export async function fetchFile({ baseUrl = '', id, key }) {
  const response = await request(`${baseUrl}/api/files/${encodeURIComponent(id)}`);
  return decryptBytes(key, new Uint8Array(await response.arrayBuffer()));
}

/**
 * Replaces the note's text in place: same link, same key, attachments kept as they are.
 * Only the owner can do it, and not for burn-after-read notes.
 */
export async function updateNote({ baseUrl = '', accessCode, id, encodedKey, text, format, language, files }) {
  const { token, ownerKey } = await openAccessCode(accessCode);
  const key = await importKey(encodedKey);
  const payload = await encryptJson(key, buildNote({ text, format, language, files }));
  const ownerEntry = await encryptOwnerEntry(ownerKey, encodedKey, text, files);
  await request(`${baseUrl}/api/notes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: toBase64Url(payload), ownerEntry: toBase64Url(ownerEntry) }),
  });
}

export async function deleteNote({ baseUrl = '', accessCode, id }) {
  const { token } = parseAccessCode(accessCode);
  await request(`${baseUrl}/api/notes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
}

/** Validates the code locally, then the token on the server. Returns the user name. */
export async function checkAccess({ baseUrl = '', accessCode }) {
  const { token } = await openAccessCode(accessCode);
  const response = await request(`${baseUrl}/api/me`, { headers: authHeader(token) });
  const { user } = await response.json();
  return user;
}

export function parseNoteUrl(rawUrl) {
  const url = new URL(rawUrl);
  const id = url.pathname.replace(/^\/n\//, '');
  const encodedKey = url.hash.slice(1);
  if (!url.pathname.startsWith('/n/') || !ID_PATTERN.test(id) || !encodedKey) {
    throw new Error('Expected a note URL like https://host/n/<id>#<key>');
  }
  return { baseUrl: url.origin, id, encodedKey };
}
