import { randomBytes } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { HttpError } from './http.js';

// Uploaded files that never got attached to a note are removed after this delay.
const ORPHAN_TTL_MS = 60 * 60 * 1000;
// A burned note's attachments stay downloadable this long, so the reader can save them.
export const BURNED_FILES_TTL_MS = 10 * 60 * 1000;

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    payload BLOB NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    burn_after_read INTEGER NOT NULL DEFAULT 0,
    burned_at INTEGER,
    owner_entry BLOB
  );
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
    size INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS files_note_id ON files(note_id);
  CREATE INDEX IF NOT EXISTS notes_expires_at ON notes(expires_at);
`;

const ALIVE = '(n.expires_at IS NULL OR n.expires_at > :now)';

function prepareStatements(db) {
  const sql = (text) => db.prepare(text);
  return {
    insertNote: sql(`INSERT INTO notes (id, owner, payload, created_at, expires_at, burn_after_read, owner_entry)
      VALUES (?, ?, ?, ?, ?, ?, ?)`),
    listOwnerNotes: sql(`SELECT n.id, n.created_at AS createdAt, n.expires_at AS expiresAt,
        n.burn_after_read AS burnAfterRead, n.burned_at IS NOT NULL AS isBurned, n.owner_entry AS entry
      FROM notes n WHERE n.owner = :owner AND n.owner_entry IS NOT NULL AND ${ALIVE}
      ORDER BY n.created_at DESC LIMIT 500`),
    insertFile: sql('INSERT INTO files (id, owner, size, created_at) VALUES (?, ?, ?, ?)'),
    attachFile: sql('UPDATE files SET note_id = ? WHERE id = ? AND owner = ? AND note_id IS NULL'),
    getNote: sql(`SELECT n.owner, n.payload, n.created_at AS createdAt, n.expires_at AS expiresAt,
        n.burn_after_read AS burnAfterRead
      FROM notes n WHERE n.id = :id AND n.burned_at IS NULL AND ${ALIVE}`),
    burnNote: sql(`UPDATE notes SET payload = x'', burned_at = :now, expires_at = :filesUntil
      WHERE id = :id`),
    // Burn-after-read notes are never edited: the reader may already hold the only copy.
    updateNote: sql(`UPDATE notes AS n SET payload = :payload, owner_entry = :ownerEntry
      WHERE n.id = :id AND n.owner = :owner AND n.burn_after_read = 0 AND ${ALIVE}`),
    getFile: sql(`SELECT f.id, f.size FROM files f JOIN notes n ON n.id = f.note_id
      WHERE f.id = :id AND ${ALIVE}`),
    listNoteFiles: sql('SELECT id FROM files WHERE note_id = ?'),
    listExpiredNotes: sql('SELECT id FROM notes WHERE expires_at <= ?'),
    listOrphanFiles: sql('SELECT id FROM files WHERE note_id IS NULL AND created_at <= ?'),
    deleteNote: sql('DELETE FROM notes WHERE id = ?'),
    deleteFile: sql('DELETE FROM files WHERE id = ?'),
  };
}

/** Adds columns introduced after a database was created. */
function migrate(db) {
  const columns = new Set(db.prepare('PRAGMA table_info(notes)').all().map((column) => column.name));
  if (!columns.has('owner_entry')) db.exec('ALTER TABLE notes ADD COLUMN owner_entry BLOB');
}

export function createId() {
  return randomBytes(8).toString('base64url');
}

export async function openStore(dataDir) {
  const filesDir = path.join(dataDir, 'files');
  await mkdir(filesDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'arca.db'));
  db.exec(SCHEMA);
  migrate(db);
  const sql = prepareStatements(db);

  const getFilePath = (id) => path.join(filesDir, id);
  const removeFiles = (ids) => Promise.all(ids.map((id) => rm(getFilePath(id), { force: true })));
  const getNote = (id, now = Date.now()) => sql.getNote.get({ id, now });

  function inTransaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function createNote({ id, owner, payload, ownerEntry, fileIds, expiresAt, isBurnAfterRead }) {
    inTransaction(() => {
      sql.insertNote.run(id, owner, payload, Date.now(), expiresAt, isBurnAfterRead ? 1 : 0, ownerEntry);
      for (const fileId of fileIds) {
        const { changes } = sql.attachFile.run(id, fileId, owner);
        if (changes !== 1) throw new HttpError(400, `File ${fileId} is not available`);
      }
    });
  }

  /** Returns the note once and wipes its payload in the same transaction, so two readers can't both get it. */
  function burnNote(id, now = Date.now()) {
    return inTransaction(() => {
      const note = getNote(id, now);
      if (!note?.burnAfterRead) return undefined;
      const filesUntil = now + BURNED_FILES_TTL_MS;
      sql.burnNote.run({ id, now, filesUntil });
      return { ...note, expiresAt: filesUntil };
    });
  }

  async function deleteNote(id) {
    const fileIds = sql.listNoteFiles.all(id).map((row) => row.id);
    sql.deleteNote.run(id);
    await removeFiles(fileIds);
  }

  async function cleanup(now = Date.now()) {
    for (const { id } of sql.listExpiredNotes.all(now)) await deleteNote(id);
    const orphanIds = sql.listOrphanFiles.all(now - ORPHAN_TTL_MS).map((row) => row.id);
    for (const id of orphanIds) sql.deleteFile.run(id);
    await removeFiles(orphanIds);
  }

  return {
    getFilePath,
    getNote,
    createNote,
    burnNote,
    deleteNote,
    cleanup,
    addFile: (id, owner, size) => sql.insertFile.run(id, owner, size, Date.now()),
    getFile: (id, now = Date.now()) => sql.getFile.get({ id, now }),
    listOwnerNotes: (owner, now = Date.now()) => sql.listOwnerNotes.all({ owner, now }),
    /** Returns false when the note is missing, expired, burn-after-read or someone else's. */
    updateNote: ({ id, owner, payload, ownerEntry }, now = Date.now()) => (
      sql.updateNote.run({ id, owner, payload, ownerEntry, now }).changes === 1
    ),
    close: () => db.close(),
  };
}
