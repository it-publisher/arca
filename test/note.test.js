import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extensionForLanguage, languageFromFileName } from '../shared/languages.js';
import { buildNote, parseNote } from '../shared/note.js';

test('code notes carry a language, other formats do not', () => {
  assert.equal(buildNote({ text: 'x', format: 'code', language: 'python' }).language, 'python');
  assert.equal(buildNote({ text: 'x', format: 'code' }).language, 'auto');
  assert.equal(buildNote({ text: 'x', format: 'md', language: 'python' }).language, undefined);
});

test('unknown languages are rejected when building, tolerated when reading', () => {
  assert.throws(() => buildNote({ text: 'x', format: 'code', language: 'cobol' }), /Unknown language/);
  const parsed = parseNote({ v: 1, format: 'code', text: 'x', files: [], language: 'cobol' });
  assert.equal(parsed.language, 'auto');
});

test('language detection from file names', () => {
  assert.equal(languageFromFileName('deploy/run.sh'), 'bash');
  assert.equal(languageFromFileName('index.HTML'), 'xml');
  assert.equal(languageFromFileName('Dockerfile'), 'dockerfile');
  assert.equal(languageFromFileName('server.log'), 'plaintext');
  assert.equal(languageFromFileName('notes.txt'), null);
  assert.equal(languageFromFileName('README'), null);
  assert.equal(extensionForLanguage('python'), 'py');
  assert.equal(extensionForLanguage('auto'), 'txt');
});
