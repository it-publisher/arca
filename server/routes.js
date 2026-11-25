import { createReadStream, createWriteStream } from 'node:fs';
import { rename, rm, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { ENCRYPTION_OVERHEAD } from '../shared/crypto.js';
import { EXPIRY_SECONDS, ID_PATTERN } from '../shared/note.js';
import { createAuthenticator } from './auth.js';
import { HttpError, limitSize, readJson, sendJson } from './http.js';
import { createId } from './store.js';

const ID = '([\\w-]{11})';
const ALLOWED_EXPIRY = new Set(Object.values(EXPIRY_SECONDS));
const BASE64URL_PATTERN = /^[\w-]+$/;
const JSON_OVERHEAD_BYTES = 16 * 1024;

export function createRoutes({ config, store }) {
  const { limits } = config;
  const authenticate = createAuthenticator(config.users);
  const maxFileBytes = limits.maxFileBytes + ENCRYPTION_OVERHEAD;
  const maxPayloadBytes = limits.maxNoteBytes + ENCRYPTION_OVERHEAD;
  const maxNoteRequestBytes = Math.ceil((maxPayloadBytes * 4) / 3) + JSON_OVERHEAD_BYTES;

  const requireAuth = (handler) => (ctx) => {
    const user = authenticate(ctx.req);
    if (!user) throw new HttpError(401, 'Unauthorized');
    return handler({ ...ctx, user });
  };

  function parseBlob(value, maxBytes, name) {
    if (typeof value !== 'string' || !BASE64URL_PATTERN.test(value)) throw new HttpError(400, `Invalid ${name}`);
    const blob = Buffer.from(value, 'base64url');
    if (blob.length > maxBytes) throw new HttpError(413, `${name} is too large`);
    return blob;
  }

  function parseFileIds(value = []) {
    const isValid = Array.isArray(value)
      && value.length <= limits.maxFilesPerNote
      && value.every((id) => typeof id === 'string' && ID_PATTERN.test(id));
    if (!isValid) throw new HttpError(400, 'Invalid files list');
    return value;
  }

  function parseExpiresAt(expiresIn = null, now = Date.now()) {
    if (!ALLOWED_EXPIRY.has(expiresIn)) throw new HttpError(400, 'Unsupported expiresIn value');
    return expiresIn === null ? null : now + expiresIn * 1000;
  }

  async function uploadFile({ req, res, user }) {
    const declaredSize = Number(req.headers['content-length']);
    if (!Number.isFinite(declaredSize)) throw new HttpError(411, 'Content-Length is required');
    if (declaredSize > maxFileBytes) throw new HttpError(413, 'File is too large');
    if (declaredSize < ENCRYPTION_OVERHEAD) throw new HttpError(400, 'File is empty');

    const id = createId();
    const finalPath = store.getFilePath(id);
    const tempPath = `${finalPath}.part`;
    try {
      await pipeline(req, limitSize(maxFileBytes), createWriteStream(tempPath, { flags: 'wx' }));
      const { size } = await stat(tempPath);
      await rename(tempPath, finalPath);
      store.addFile(id, user, size);
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
    sendJson(res, 201, { id });
  }

  async function createNote({ req, res, user }) {
    const body = await readJson(req, maxNoteRequestBytes);
    const id = createId();
    store.createNote({
      id,
      owner: user,
      payload: parseBlob(body.payload, maxPayloadBytes, 'payload'),
      ownerEntry: parseBlob(body.ownerEntry, limits.maxOwnerEntryBytes, 'ownerEntry'),
      fileIds: parseFileIds(body.files),
      expiresAt: parseExpiresAt(body.expiresIn),
      isBurnAfterRead: body.burnAfterRead === true,
    });
    sendJson(res, 201, { id });
  }

  function sendNote(res, note) {
    sendJson(res, 200, {
      payload: Buffer.from(note.payload).toString('base64url'),
      createdAt: note.createdAt,
      expiresAt: note.expiresAt,
      burnAfterRead: Boolean(note.burnAfterRead),
    });
  }

  function getNote({ res, params: [id] }) {
    const note = store.getNote(id);
    if (!note) throw new HttpError(404, 'Note not found');
    // GET has no side effects: link previewers and scanners must not burn the note.
    // The content of a burn-after-read note is only handed out by POST /open.
    if (note.burnAfterRead) {
      sendJson(res, 200, { burnAfterRead: true, createdAt: note.createdAt, expiresAt: note.expiresAt });
      return;
    }
    sendNote(res, note);
  }

  async function editNote({ req, res, params: [id], user }) {
    const body = await readJson(req, maxNoteRequestBytes);
    const isUpdated = store.updateNote({
      id,
      owner: user,
      payload: parseBlob(body.payload, maxPayloadBytes, 'payload'),
      ownerEntry: parseBlob(body.ownerEntry, limits.maxOwnerEntryBytes, 'ownerEntry'),
    });
    if (!isUpdated) throw new HttpError(404, 'Note not found');
    res.writeHead(204).end();
  }

  function listOwnNotes({ res, user }) {
    const notes = store.listOwnerNotes(user).map((note) => ({
      id: note.id,
      createdAt: note.createdAt,
      expiresAt: note.expiresAt,
      burnAfterRead: Boolean(note.burnAfterRead),
      isBurned: Boolean(note.isBurned),
      entry: Buffer.from(note.entry).toString('base64url'),
    }));
    sendJson(res, 200, { notes });
  }

  function openBurnNote({ res, params: [id] }) {
    const note = store.burnNote(id);
    if (!note) throw new HttpError(404, 'Note not found');
    sendNote(res, note);
  }

  async function removeNote({ res, params: [id], user }) {
    const note = store.getNote(id);
    // 404 for foreign notes too: don't reveal which ids exist.
    if (!note || note.owner !== user) throw new HttpError(404, 'Note not found');
    await store.deleteNote(id);
    res.writeHead(204).end();
  }

  async function downloadFile({ res, params: [id] }) {
    const file = store.getFile(id);
    if (!file) throw new HttpError(404, 'File not found');
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': file.size,
      'Cache-Control': 'no-store',
    });
    await pipeline(createReadStream(store.getFilePath(id)), res);
  }

  return [
    { method: 'GET', pattern: /^\/api\/me$/, handler: requireAuth(({ res, user }) => sendJson(res, 200, { user })) },
    { method: 'POST', pattern: /^\/api\/files$/, handler: requireAuth(uploadFile) },
    { method: 'POST', pattern: /^\/api\/notes$/, handler: requireAuth(createNote) },
    { method: 'GET', pattern: /^\/api\/notes$/, handler: requireAuth(listOwnNotes) },
    { method: 'GET', pattern: new RegExp(`^/api/notes/${ID}$`), handler: getNote },
    { method: 'POST', pattern: new RegExp(`^/api/notes/${ID}/open$`), handler: openBurnNote },
    { method: 'PUT', pattern: new RegExp(`^/api/notes/${ID}$`), handler: requireAuth(editNote) },
    { method: 'DELETE', pattern: new RegExp(`^/api/notes/${ID}$`), handler: requireAuth(removeNote) },
    { method: 'GET', pattern: new RegExp(`^/api/files/${ID}$`), handler: downloadFile },
  ];
}
