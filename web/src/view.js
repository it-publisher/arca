import './style.css';
import {
  ApiError, fetchFile, fetchNote, listNotes, updateNote,
} from '../../shared/client.js';
import { DecryptionError } from '../../shared/crypto.js';
import { extensionForLanguage, getLanguageLabel } from '../../shared/languages.js';
import { getNoteTitle } from '../../shared/note.js';
import { renderNoteText } from './render.js';
import { getAccessCode } from './storage.js';
import {
  $, copyText, createExpiryBadge, createIconButton, downloadBlob, el, formatBytes, formatDate,
  renderIconButtons, showToast, toFileName,
} from './ui.js';

// The note on screen; replaced in place after an edit.
const state = { id: '', encodedKey: '', note: null, usedLanguage: null };

const INLINE_IMAGE_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml',
]);

function describeError(error) {
  if (error instanceof ApiError && error.status === 404) {
    return 'Заметка не найдена: её удалили, она сгорела по сроку или уже была прочитана.';
  }
  if (error instanceof DecryptionError) {
    return 'Не удалось расшифровать. Проверь, что ссылка скопирована целиком, вместе с частью после #.';
  }
  console.error(error);
  return `Ошибка: ${error.message}`;
}

function showError(message) {
  const errorBox = $('#error');
  errorBox.textContent = message;
  errorBox.hidden = false;
}

/** Shows the "open once" screen and resolves when the reader clicks it. */
function waitForBurnConfirmation() {
  $('#loading').hidden = true;
  const gate = $('#burn-gate');
  gate.hidden = false;
  return new Promise((resolve) => {
    $('#burn-open').addEventListener('click', () => {
      gate.hidden = true;
      $('#loading').hidden = false;
      resolve(true);
    }, { once: true });
  });
}

/** Caches the decrypted blob, but retries after a failure. */
function cachedLoader(load) {
  let promise = null;
  return () => {
    promise ??= load().catch((error) => {
      promise = null;
      throw error;
    });
    return promise;
  };
}

function renderText() {
  const { note } = state;
  const hasText = Boolean(note.text.trim());
  document.title = `${getNoteTitle(note.text, note.files)} — Arca`;
  $('#content').hidden = !hasText;
  $('#copy-text').hidden = !hasText;
  $('#download-text').hidden = !hasText;
  // Code needs room for long lines; prose reads better in a narrower column.
  document.querySelector('.note-page').classList.toggle('is-wide', note.format === 'code');
  const badge = $('#language-badge');
  badge.hidden = true;
  if (!hasText) return;
  const usedLanguage = renderNoteText($('#content'), note.text, note.format, note.language);
  // For auto-detected code the reader sees which language was guessed.
  state.usedLanguage = usedLanguage;
  if (usedLanguage) {
    badge.textContent = getLanguageLabel(usedLanguage);
    badge.hidden = false;
  }
}

function renderNote({ createdAt, expiresAt, burnAfterRead }) {
  $('#meta').textContent = formatDate(createdAt);
  $('#burned').hidden = !burnAfterRead;
  // A burned link is dead, so there is nothing to share.
  $('#share-note').hidden = burnAfterRead;
  if (!burnAfterRead) $('#expiry').replaceChildren(createExpiryBadge({ expiresAt }));
  renderText();
  $('#note').hidden = false;
}

// --- Actions ---

async function shareNote() {
  const url = location.href;
  const isTouchDevice = matchMedia('(pointer: coarse)').matches;
  if (!isTouchDevice || !navigator.share) {
    await copyText(url, 'Ссылка скопирована');
    return;
  }
  try {
    await navigator.share({ title: document.title, url });
  } catch (error) {
    if (error.name !== 'AbortError') showToast(`Не удалось поделиться: ${error.message}`);
  }
}

function downloadText() {
  const { note } = state;
  const extensions = { md: 'md', text: 'txt', code: extensionForLanguage(state.usedLanguage) };
  const extension = extensions[note.format];
  downloadBlob(new Blob([note.text]), `${toFileName(getNoteTitle(note.text, note.files))}.${extension}`);
}

function setEditing(isEditing) {
  $('#editor').hidden = !isEditing;
  // Invisible rather than hidden: the header keeps its height and doesn't jump.
  $('#note-actions').classList.toggle('is-invisible', isEditing);
  if (isEditing) {
    $('#content').hidden = true;
    $('#edit-text').value = state.note.text;
    $('#edit-text').spellcheck = state.note.format !== 'code';
    $('#edit-text').focus();
  } else {
    renderText();
  }
}

async function saveEdit() {
  const text = $('#edit-text').value;
  if (!text.trim() && state.note.files.length === 0) {
    showToast('Заметка пустая');
    return;
  }
  const saveButton = $('#edit-save');
  saveButton.disabled = true;
  try {
    const { note } = state;
    await updateNote({
      accessCode: getAccessCode(), id: state.id, encodedKey: state.encodedKey, text, format: note.format, language: note.language, files: note.files,
    });
    state.note = { ...note, text };
    setEditing(false);
    showToast('Сохранено — ссылка та же');
  } catch (error) {
    showToast(describeError(error), 5000);
  } finally {
    saveButton.disabled = false;
  }
}

/** The edit button appears only for the author, logged in on this device. */
async function revealEditForOwner(burnAfterRead) {
  const accessCode = getAccessCode();
  if (!accessCode || burnAfterRead) return;
  try {
    const { items } = await listNotes({ accessCode });
    $('#edit-note').hidden = !items.some((item) => item.id === state.id);
  } catch (error) {
    // Reading must keep working even if the ownership check fails.
    console.error('Ownership check failed:', error);
  }
}

function bindActions() {
  renderIconButtons();
  $('#share-note').addEventListener('click', shareNote);
  $('#copy-text').addEventListener('click', () => copyText(state.note.text, 'Текст скопирован'));
  $('#download-text').addEventListener('click', downloadText);
  $('#edit-note').addEventListener('click', () => setEditing(true));
  $('#edit-cancel').addEventListener('click', () => setEditing(false));
  $('#edit-save').addEventListener('click', saveEdit);
  $('#edit-text').addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setEditing(false);
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) saveEdit();
  });
}

async function appendImagePreview(item, loadBlob, alt) {
  try {
    const blob = await loadBlob();
    item.append(el('img', { src: URL.createObjectURL(blob), alt, className: 'preview-image' }));
  } catch (error) {
    item.append(el('p', { className: 'notice notice-error', textContent: describeError(error) }));
  }
}

async function handleDownload(file, loadBlob, button) {
  button.disabled = true;
  try {
    downloadBlob(await loadBlob(), file.name);
  } catch (error) {
    showToast(describeError(error), 5000);
  } finally {
    button.disabled = false;
  }
}

function createFileItem(file, key) {
  const loadBlob = cachedLoader(async () => new Blob([await fetchFile({ id: file.id, key })], { type: file.type }));
  const download = createIconButton('download', `Скачать ${file.name}`);
  download.addEventListener('click', () => handleDownload(file, loadBlob, download));

  const item = el('li', { className: 'file-card' }, [
    el('div', { className: 'file-item' }, [
      el('span', { className: 'name', textContent: file.name, title: file.name }),
      el('span', { className: 'muted small', textContent: formatBytes(file.size) }),
      download,
    ]),
  ]);
  if (INLINE_IMAGE_TYPES.has(file.type)) appendImagePreview(item, loadBlob, file.name);
  return item;
}

function renderFiles(files, key) {
  if (!files.length) return;
  $('#files').replaceChildren(...files.map((file) => createFileItem(file, key)));
  $('#files-section').hidden = false;
}

async function init() {
  state.id = location.pathname.split('/').at(-1);
  state.encodedKey = location.hash.slice(1);
  bindActions();
  try {
    if (!state.encodedKey) throw new DecryptionError('Missing key in URL fragment');
    const result = await fetchNote({ id: state.id, encodedKey: state.encodedKey, confirmBurn: waitForBurnConfirmation });
    state.note = result.note;
    renderNote(result);
    renderFiles(result.note.files, result.key);
    revealEditForOwner(result.burnAfterRead);
  } catch (error) {
    showError(describeError(error));
  } finally {
    $('#loading').hidden = true;
  }
}

init();
