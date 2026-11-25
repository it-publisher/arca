import { AUTO_LANGUAGE, isKnownLanguage } from './languages.js';

const MIB = 1024 * 1024;

export const NOTE_VERSION = 1;
export const NOTE_FORMATS = ['md', 'code', 'text'];
export const ID_PATTERN = /^[\w-]{11}$/;
const MAX_TITLE_LENGTH = 80;

export const LIMITS = Object.freeze({
  maxNoteBytes: MIB,
  maxFileBytes: 50 * MIB,
  maxFilesPerNote: 10,
  maxOwnerEntryBytes: 4096,
});

export const EXPIRY_SECONDS = Object.freeze({
  never: null,
  '1h': 3600,
  '1d': 86400,
  '1w': 604800,
  '30d': 2592000,
});

// Notes are meant to be short-lived drafts, so they expire by default.
export const DEFAULT_EXPIRY = '30d';

/** language applies to "code" notes only: a highlight.js id or "auto". */
export function buildNote({ text = '', format = 'md', files = [], language = AUTO_LANGUAGE }) {
  if (typeof text !== 'string') throw new TypeError('Note text must be a string');
  if (!NOTE_FORMATS.includes(format)) throw new Error(`Unknown note format: ${format}`);
  if (!text.trim() && files.length === 0) throw new Error('Note is empty');
  if (format !== 'code') return { v: NOTE_VERSION, format, text, files };
  if (!isKnownLanguage(language)) throw new Error(`Unknown language: ${language}`);
  return { v: NOTE_VERSION, format, text, files, language };
}

export function parseNote(data) {
  if (data?.v !== NOTE_VERSION) throw new Error('Unsupported note version');
  const isValid = typeof data.text === 'string'
    && NOTE_FORMATS.includes(data.format)
    && Array.isArray(data.files);
  if (!isValid) throw new Error('Malformed note');
  // An unknown language (e.g. from a newer client) degrades to auto-detection, not an error.
  if (data.format === 'code' && !isKnownLanguage(data.language)) return { ...data, language: AUTO_LANGUAGE };
  return data;
}

export function getNoteTitle(text, files = []) {
  const firstLine = text.split('\n').find((line) => line.trim());
  if (firstLine) return firstLine.replace(/^#+\s*/, '').trim().slice(0, MAX_TITLE_LENGTH);
  return files[0]?.name ?? 'Без названия';
}
