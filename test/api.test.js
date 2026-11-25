import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../server/app.js';
import { BURNED_FILES_TTL_MS, openStore } from '../server/store.js';
import {
  createAccessCode, deleteNote, fetchFile, fetchNote, listNotes, publishNote, updateNote,
} from '../shared/client.js';
import { toBase64Url } from '../shared/crypto.js';
import { LIMITS } from '../shared/note.js';

const TOKENS = { alice: 'a'.repeat(32), bob: 'b'.repeat(32) };
const HOUR_MS = 3600 * 1000;

const CODES = {};

let server;
let store;
let baseUrl;
let dataDir;

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'arca-test-'));
  store = await openStore(dataDir);
  const config = {
    distDir: dataDir,
    users: new Map(Object.entries(TOKENS)),
    limits: { ...LIMITS, maxFileBytes: 1024 },
  };
  server = createApp({ config, store });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  for (const [user, token] of Object.entries(TOKENS)) CODES[user] = await createAccessCode(token);
});

after(async () => {
  server.closeAllConnections();
  server.close();
  store.close();
  await rm(dataDir, { recursive: true, force: true });
});

const publishAs = (user, options) => publishNote({ baseUrl, accessCode: CODES[user], ...options });

function uploadRawFile(user, size) {
  return fetch(`${baseUrl}/api/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKENS[user]}`, 'Content-Type': 'application/octet-stream' },
    body: new Uint8Array(size),
  });
}

test('publishes and reads an encrypted note with a file', async () => {
  const image = new Uint8Array([1, 2, 3, 4]);
  const { id, encodedKey } = await publishAs('alice', {
    text: '# Секрет',
    files: [{ name: 'a.png', type: 'image/png', data: image }],
  });
  const { note, key } = await fetchNote({ baseUrl, id, encodedKey });
  assert.equal(note.text, '# Секрет');
  assert.equal(note.files[0].name, 'a.png');
  assert.deepEqual(await fetchFile({ baseUrl, id: note.files[0].id, key }), image);
});

test('server stores only ciphertext', async () => {
  const marker = 'plaintext-marker-42';
  const { id } = await publishAs('alice', { text: marker, format: 'text' });
  const { payload } = store.getNote(id);
  assert.ok(!Buffer.from(payload).includes(marker));
});

test('rejects requests without a valid token', async () => {
  await assert.rejects(
    publishNote({ baseUrl, accessCode: await createAccessCode('x'.repeat(32)), text: 'hi' }),
    { name: 'ApiError', status: 401 },
  );
});

test('rejects files above the limit', async () => {
  const files = [{ name: 'big.bin', type: '', data: new Uint8Array(2048) }];
  await assert.rejects(publishAs('alice', { text: 'x', files }), { status: 413 });
});

test("does not let a user attach someone else's file", async () => {
  const { id: fileId } = await (await uploadRawFile('alice', 64)).json();
  const response = await fetch(`${baseUrl}/api/notes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKENS.bob}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payload: toBase64Url(new Uint8Array(64)), ownerEntry: toBase64Url(new Uint8Array(64)), files: [fileId],
    }),
  });
  assert.equal(response.status, 400);
});

test('rejects unsupported expiry values', async () => {
  await assert.rejects(publishAs('alice', { text: 'x', expiresIn: 42 }), { status: 400 });
});

test('only the owner can delete a note', async () => {
  const { id, encodedKey } = await publishAs('alice', { text: 'mine' });
  await assert.rejects(deleteNote({ baseUrl, accessCode: CODES.bob, id }), { status: 404 });
  await deleteNote({ baseUrl, accessCode: CODES.alice, id });
  await assert.rejects(fetchNote({ baseUrl, id, encodedKey }), { status: 404 });
});

test('expired notes disappear together with their files', async () => {
  const files = [{ name: 'f.txt', type: 'text/plain', data: new Uint8Array([7]) }];
  const { id, encodedKey } = await publishAs('alice', { text: 'temp', files, expiresIn: 3600 });
  const { note } = await fetchNote({ baseUrl, id, encodedKey });
  const filePath = store.getFilePath(note.files[0].id);

  assert.equal(store.getNote(id, Date.now() + 2 * HOUR_MS), undefined);
  await store.cleanup(Date.now() + 2 * HOUR_MS);
  await assert.rejects(stat(filePath), { code: 'ENOENT' });
});

test('sends security headers on every response', async () => {
  const response = await fetch(`${baseUrl}/api/notes/AAAAAAAAAAA`);
  assert.equal(response.status, 404);
  const csp = response.headers.get('content-security-policy');
  assert.match(csp, /default-src 'none'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.match(csp, /img-src 'self' blob: data:;/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});

test('burn-after-read: GET reveals no content, so link previewers cannot burn the note', async () => {
  const { id } = await publishAs('alice', { text: 'secret', burnAfterRead: true });
  const response = await fetch(`${baseUrl}/api/notes/${id}`);
  const body = await response.json();
  assert.equal(body.burnAfterRead, true);
  assert.equal(body.payload, undefined);
});

test('burn-after-read: declining keeps the note, opening works exactly once', async () => {
  const { id, encodedKey } = await publishAs('alice', { text: 'once', burnAfterRead: true });
  assert.equal(await fetchNote({ baseUrl, id, encodedKey, confirmBurn: async () => false }), null);

  const { note } = await fetchNote({ baseUrl, id, encodedKey });
  assert.equal(note.text, 'once');
  await assert.rejects(fetchNote({ baseUrl, id, encodedKey }), { status: 404 });
  assert.equal(store.getNote(id), undefined);
});

test('burn-after-read: attachments stay downloadable for a grace period only', async () => {
  const data = new Uint8Array([9, 9, 9]);
  const files = [{ name: 'a.bin', type: '', data }];
  const { id, encodedKey } = await publishAs('alice', { text: 'with file', files, burnAfterRead: true });
  const { note, key } = await fetchNote({ baseUrl, id, encodedKey });

  assert.deepEqual(await fetchFile({ baseUrl, id: note.files[0].id, key }), data);
  const afterGrace = Date.now() + BURNED_FILES_TTL_MS + 1000;
  assert.equal(store.getFile(note.files[0].id, afterGrace), undefined);
  await store.cleanup(afterGrace);
  await assert.rejects(stat(store.getFilePath(note.files[0].id)), { code: 'ENOENT' });
});

test('history: any device with the access code sees and opens its notes', async () => {
  const { id } = await publishAs('alice', { text: '# Синхронизация\n\nтело' });
  const { items, unreadableCount } = await listNotes({ baseUrl, accessCode: CODES.alice });
  const item = items.find((entry) => entry.id === id);
  assert.equal(unreadableCount, 0);
  assert.equal(item.title, 'Синхронизация');
  const { note } = await fetchNote({ baseUrl, id, encodedKey: item.key });
  assert.equal(note.text, '# Синхронизация\n\nтело');
});

test('history: users see only their own notes', async () => {
  const { id } = await publishAs('alice', { text: 'alice only' });
  const { items } = await listNotes({ baseUrl, accessCode: CODES.bob });
  assert.ok(!items.some((entry) => entry.id === id));
});

test('history: the server stores titles and note keys only encrypted', async () => {
  const marker = 'history-title-marker-77';
  const { encodedKey } = await publishAs('alice', { text: marker });
  const response = await fetch(`${baseUrl}/api/notes`, { headers: { Authorization: `Bearer ${TOKENS.alice}` } });
  const raw = JSON.stringify(await response.json());
  for (const { entry } of JSON.parse(raw).notes) {
    const bytes = Buffer.from(entry, 'base64url');
    assert.ok(!bytes.includes(marker) && !bytes.includes(encodedKey));
  }
});

test('history: a different history key cannot read entries and is reported', async () => {
  await publishAs('alice', { text: 'keyed' });
  const otherCode = await createAccessCode(TOKENS.alice);
  const { items, unreadableCount } = await listNotes({ baseUrl, accessCode: otherCode });
  assert.equal(items.length, 0);
  assert.ok(unreadableCount > 0);
});

test('history: expired notes drop out of the list', async () => {
  const { id } = await publishAs('alice', { text: 'short-lived', expiresIn: 3600 });
  await store.cleanup(Date.now() + 2 * HOUR_MS);
  const { items } = await listNotes({ baseUrl, accessCode: CODES.alice });
  assert.ok(!items.some((entry) => entry.id === id));
});

test('rejects malformed access codes before any request', async () => {
  await assert.rejects(publishNote({ baseUrl, accessCode: TOKENS.alice, text: 'x' }), /Invalid access code/);
});

test('edit: owner rewrites the text in place, link and attachments stay', async () => {
  const files = [{ name: 'keep.bin', type: '', data: new Uint8Array([5, 6]) }];
  const { id, encodedKey } = await publishAs('alice', { text: '# Было', files });
  const { note } = await fetchNote({ baseUrl, id, encodedKey });

  await updateNote({ baseUrl, accessCode: CODES.alice, id, encodedKey, text: '# Стало', format: 'md', files: note.files });
  const { note: edited, key } = await fetchNote({ baseUrl, id, encodedKey });
  assert.equal(edited.text, '# Стало');
  assert.deepEqual(await fetchFile({ baseUrl, id: edited.files[0].id, key }), new Uint8Array([5, 6]));

  const { items } = await listNotes({ baseUrl, accessCode: CODES.alice });
  assert.equal(items.find((item) => item.id === id).title, 'Стало');
});

test('edit: other users cannot edit', async () => {
  const { id, encodedKey } = await publishAs('alice', { text: 'mine' });
  await assert.rejects(
    updateNote({ baseUrl, accessCode: CODES.bob, id, encodedKey, text: 'hacked', format: 'md', files: [] }),
    { status: 404 },
  );
  assert.equal((await fetchNote({ baseUrl, id, encodedKey })).note.text, 'mine');
});

test('edit: burn-after-read notes cannot be edited', async () => {
  const { id, encodedKey } = await publishAs('alice', { text: 'once', burnAfterRead: true });
  await assert.rejects(
    updateNote({ baseUrl, accessCode: CODES.alice, id, encodedKey, text: 'changed', format: 'md', files: [] }),
    { status: 404 },
  );
});

test('code notes keep their language through publish and edit', async () => {
  const { id, encodedKey } = await publishAs('alice', { text: 'print(1)', format: 'code', language: 'python' });
  const { note } = await fetchNote({ baseUrl, id, encodedKey });
  assert.equal(note.language, 'python');
  await updateNote({ baseUrl, accessCode: CODES.alice, id, encodedKey, text: 'print(2)', format: 'code', language: note.language, files: [] });
  const { note: edited } = await fetchNote({ baseUrl, id, encodedKey });
  assert.deepEqual([edited.text, edited.language], ['print(2)', 'python']);
});
