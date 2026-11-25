import './style.css';
import { ApiError, deleteNote, listNotes, publishNote } from '../../shared/client.js';
import { AUTO_LANGUAGE, LANGUAGES } from '../../shared/languages.js';
import { EXPIRY_SECONDS, LIMITS } from '../../shared/note.js';
import { renderNoteText } from './render.js';
import {
  clearAccessCode, clearDraft, getAccessCode, loadDraft, saveDraft,
} from './storage.js';
import {
  $, copyText, createExpiryBadge, el, formatBytes, formatShortDate, showToast,
} from './ui.js';

const DRAFT_SAVE_DELAY_MS = 400;

const accessCode = getAccessCode();
const attachments = []; // [{ file: File, previewUrl: string | null }]
let draftTimer;

const ui = {
  text: $('#text'),
  preview: $('#preview'),
  format: $('#format'),
  language: $('#language'),
  expires: $('#expires'),
  burn: $('#burn'),
  publish: $('#publish'),
  draftStatus: $('#draft-status'),
  dropzone: $('#dropzone'),
  fileInput: $('#file-input'),
  attachments: $('#attachments'),
  result: $('#result'),
  resultUrl: $('#result-url'),
  history: $('#history'),
};

function handleError(error) {
  const isBadCode = (error instanceof ApiError && error.status === 401) || /Invalid access code/.test(error.message);
  if (isBadCode) {
    clearAccessCode();
    location.replace('/login');
    return;
  }
  console.error(error);
  showToast(`Ошибка: ${error.message}`, 5000);
}

// --- Draft autosave ---

function scheduleDraftSave() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    if (!ui.text.value.trim()) {
      clearDraft();
      ui.draftStatus.textContent = '';
      return;
    }
    saveDraft({ text: ui.text.value, format: ui.format.value, language: ui.language.value });
    ui.draftStatus.textContent = 'Черновик сохранён в браузере';
  }, DRAFT_SAVE_DELAY_MS);
}

function restoreDraft() {
  const draft = loadDraft();
  if (!draft?.text) return;
  ui.text.value = draft.text;
  ui.format.value = draft.format ?? 'md';
  ui.language.value = draft.language ?? AUTO_LANGUAGE;
  syncFormatControls();
  ui.draftStatus.textContent = 'Черновик восстановлен';
}

// --- Attachments ---

function addFiles(files) {
  for (const file of files) {
    if (attachments.length >= LIMITS.maxFilesPerNote) {
      showToast(`Не больше ${LIMITS.maxFilesPerNote} файлов`);
      break;
    }
    if (file.size > LIMITS.maxFileBytes) {
      showToast(`${file.name}: больше ${formatBytes(LIMITS.maxFileBytes)}`);
      continue;
    }
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    attachments.push({ file, previewUrl });
  }
  renderAttachments();
}

function removeAttachment(index) {
  const [removed] = attachments.splice(index, 1);
  if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
  renderAttachments();
}

function createAttachmentItem({ file, previewUrl }, index) {
  const extension = file.name.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE';
  const remove = el('button', { type: 'button', className: 'link', textContent: 'Убрать' });
  remove.addEventListener('click', () => removeAttachment(index));
  return el('li', { className: 'file-item' }, [
    previewUrl ? el('img', { src: previewUrl, alt: '' }) : el('span', { className: 'file-icon', textContent: extension }),
    el('span', { className: 'name', textContent: file.name, title: file.name }),
    el('span', { className: 'muted small', textContent: formatBytes(file.size) }),
    remove,
  ]);
}

function renderAttachments() {
  ui.attachments.replaceChildren(...attachments.map(createAttachmentItem));
}

function bindFileInputs() {
  document.addEventListener('dragover', (event) => {
    event.preventDefault();
    ui.dropzone.classList.add('is-active');
  });
  document.addEventListener('dragleave', (event) => {
    if (!event.relatedTarget) ui.dropzone.classList.remove('is-active');
  });
  document.addEventListener('drop', (event) => {
    event.preventDefault();
    ui.dropzone.classList.remove('is-active');
    addFiles(event.dataTransfer.files);
  });
  ui.fileInput.addEventListener('change', () => {
    addFiles(ui.fileInput.files);
    ui.fileInput.value = '';
  });
  document.addEventListener('paste', (event) => {
    const { files, types } = event.clipboardData;
    // Office apps put both text and an image on the clipboard: let the text win.
    if (!files.length || types.includes('text/plain')) return;
    event.preventDefault();
    addFiles(files);
  });
}

// --- Editor ---

function fillLanguageSelect() {
  const options = [{ id: AUTO_LANGUAGE, label: 'Автоопределение' }, ...LANGUAGES];
  ui.language.replaceChildren(...options.map(({ id, label }) => el('option', { value: id, textContent: label })));
}

/** Language picker only for code; spellcheck only for prose. */
function syncFormatControls() {
  const isCode = ui.format.value === 'code';
  ui.language.hidden = !isCode;
  ui.text.spellcheck = !isCode;
}

function setMode(mode) {
  const isPreview = mode === 'preview';
  for (const tab of document.querySelectorAll('.tab')) {
    tab.setAttribute('aria-selected', String(tab.dataset.mode === mode));
  }
  ui.text.hidden = isPreview;
  ui.preview.hidden = !isPreview;
  if (isPreview) renderNoteText(ui.preview, ui.text.value, ui.format.value, ui.language.value);
  else ui.text.focus();
}

function resetEditor() {
  ui.text.value = '';
  ui.burn.checked = false;
  clearDraft();
  ui.draftStatus.textContent = '';
  for (const { previewUrl } of attachments) if (previewUrl) URL.revokeObjectURL(previewUrl);
  attachments.length = 0;
  renderAttachments();
  setMode('write');
}

async function readAttachment({ file }) {
  return { name: file.name, type: file.type, data: new Uint8Array(await file.arrayBuffer()) };
}

async function handlePublish() {
  const text = ui.text.value;
  if (!text.trim() && attachments.length === 0) {
    showToast('Заметка пустая');
    return;
  }
  const expiresIn = EXPIRY_SECONDS[ui.expires.value];
  const isBurnAfterRead = ui.burn.checked;
  ui.publish.disabled = true;
  try {
    const files = await Promise.all(attachments.map(readAttachment));
    const { path } = await publishNote({
      accessCode, text, files, format: ui.format.value, language: ui.language.value, expiresIn, burnAfterRead: isBurnAfterRead,
    });
    const url = `${location.origin}${path}`;
    ui.resultUrl.value = url;
    ui.result.hidden = false;
    resetEditor();
    await copyText(url, 'Ссылка скопирована');
    await renderHistory();
  } catch (error) {
    handleError(error);
  } finally {
    ui.publish.disabled = false;
  }
}

// --- History ---

async function handleDelete(item) {
  if (!confirm(`Удалить «${item.title}»? Ссылка перестанет работать.`)) return;
  try {
    await deleteNote({ accessCode, id: item.id });
  } catch (error) {
    const isAlreadyGone = error instanceof ApiError && error.status === 404;
    if (!isAlreadyGone) return handleError(error);
  }
  await renderHistory();
}

function createHistoryItem(item) {
  const remove = el('button', { type: 'button', className: 'link', textContent: 'Удалить' });
  remove.addEventListener('click', () => handleDelete(item));
  return el('li', { className: 'history-item' }, [
    el('a', { href: `/n/${item.id}#${item.key}`, textContent: item.title, title: item.title }),
    el('div', { className: 'history-meta' }, [
      el('span', { className: 'muted small', textContent: formatShortDate(item.createdAt) }),
      createExpiryBadge(item),
      remove,
    ]),
  ]);
}

const mutedLine = (text) => el('li', { className: 'muted small', textContent: text });

async function renderHistory() {
  try {
    const { items, unreadableCount } = await listNotes({ accessCode });
    const children = items.length ? items.map(createHistoryItem) : [mutedLine('Пока пусто')];
    // Entries made with another access code: same account, different history key.
    if (unreadableCount) children.push(mutedLine(`Ещё ${unreadableCount} — созданы с другим кодом доступа`));
    ui.history.replaceChildren(...children);
  } catch (error) {
    handleError(error);
    ui.history.replaceChildren(mutedLine('Не удалось загрузить список'));
  }
}

// --- Init ---

function init() {
  if (!accessCode) {
    location.replace('/login');
    return;
  }
  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
  }
  ui.text.addEventListener('input', scheduleDraftSave);
  fillLanguageSelect();
  syncFormatControls();
  for (const control of [ui.format, ui.language]) {
    control.addEventListener('change', () => {
      syncFormatControls();
      scheduleDraftSave();
      if (!ui.preview.hidden) setMode('preview');
    });
  }
  ui.publish.addEventListener('click', handlePublish);
  $('#copy-url').addEventListener('click', () => copyText(ui.resultUrl.value));
  $('#logout').addEventListener('click', () => {
    clearAccessCode();
    location.replace('/login');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) handlePublish();
  });
  bindFileInputs();
  restoreDraft();
  ui.history.replaceChildren(mutedLine('Загрузка…'));
  renderHistory();
  // The list changes from other devices and the CLI too.
  window.addEventListener('focus', renderHistory);
}

init();
