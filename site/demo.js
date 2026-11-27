// Live encryption demo: the same crypto module Arca uses, entirely in this page. Nothing is sent anywhere.
import { decryptBytes, encryptBytes, generateKey, toBase64Url } from './crypto.js';

const MAX_CIPHER_CHARS = 280;
const DEBOUNCE_MS = 150;

const root = document.getElementById('demo');
const ui = {
  input: document.getElementById('demo-input'),
  key: document.getElementById('demo-key'),
  cipher: document.getElementById('demo-cipher'),
  size: document.getElementById('demo-size'),
  linkBase: document.getElementById('demo-link-base'),
  linkKey: document.getElementById('demo-link-key'),
  decrypted: document.getElementById('demo-decrypted'),
  regenerate: document.getElementById('demo-regenerate'),
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
let current = null;
let timer;
let runId = 0;

/** 11 base64url chars, like real note ids. */
function createNoteId() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(8)));
}

async function rotateKey() {
  current = { ...(await generateKey()), noteId: createNoteId() };
  ui.key.textContent = current.encodedKey;
  ui.linkBase.textContent = `https://arca.example.com/n/${current.noteId}`;
  ui.linkKey.textContent = `#${current.encodedKey}`;
}

async function render() {
  runId += 1;
  const thisRun = runId;
  const sealed = await encryptBytes(current.key, encoder.encode(ui.input.value));
  const opened = decoder.decode(await decryptBytes(current.key, sealed));
  if (thisRun !== runId) return; // a newer keystroke already started its own run
  const cipher = toBase64Url(sealed);
  ui.cipher.textContent = cipher.length > MAX_CIPHER_CHARS ? `${cipher.slice(0, MAX_CIPHER_CHARS)}…` : cipher;
  ui.size.textContent = `${sealed.length} ${root.dataset.bytesLabel}`;
  ui.decrypted.textContent = opened || '—';
}

function scheduleRender() {
  clearTimeout(timer);
  timer = setTimeout(() => render().catch(showError), DEBOUNCE_MS);
}

function showError(error) {
  console.error('Encryption demo failed:', error);
  ui.cipher.textContent = error.message;
}

async function start() {
  if (!root) return;
  if (!globalThis.crypto?.subtle) {
    showError(new Error('WebCrypto is unavailable: open the page over HTTPS'));
    return;
  }
  await rotateKey();
  await render();
  ui.input.addEventListener('input', scheduleRender);
  ui.regenerate.addEventListener('click', () => rotateKey().then(render).catch(showError));
}

start().catch(showError);
