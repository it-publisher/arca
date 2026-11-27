// Captures site screenshots from a throwaway local Arca instance filled with demo notes.
// Needs `npm run build` and Google Chrome. Usage: npm run site:screens
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAccessCode, publishNote } from '../shared/client.js';
import { DEMO_DRAFT, DEMO_NOTES } from './demo-notes.js';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 3999;
const DEBUG_PORT = 9333;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.join(import.meta.dirname, 'assets', 'screens');
const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false };
const THEMES = ['light', 'dark'];

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

async function waitForUrl(url, attempts = 50) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // Not listening yet: retry below.
    }
    await wait(100);
  }
  throw new Error(`${url} did not come up`);
}

function startProcess(command, args, { env = {}, isQuiet = false } = {}) {
  const stderr = isQuiet ? 'ignore' : 'inherit';
  const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'ignore', stderr] });
  child.on('error', (error) => { throw error; });
  return child;
}

/** Minimal CDP client over the page's WebSocket: send() resolves with the command result. */
async function connectToPage() {
  const targets = await (await waitForUrl(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
  const page = targets.find((target) => target.type === 'page');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((done, fail) => { socket.onopen = done; socket.onerror = fail; });
  let nextId = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (!pending.has(message.id)) return;
    const { resolve: done, reject: fail } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) fail(new Error(message.error.message));
    else done(message.result);
  };
  const send = (method, params = {}) => new Promise((done, fail) => {
    nextId += 1;
    pending.set(nextId, { resolve: done, reject: fail });
    socket.send(JSON.stringify({ id: nextId, method, params }));
  });
  return { send, close: () => socket.close() };
}

async function capture(page, { url, name, theme, width = VIEWPORT.width, height = VIEWPORT.height }) {
  await page.send('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, width, height });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
  await page.send('Page.navigate', { url: 'about:blank' });
  await page.send('Page.navigate', { url });
  await wait(900);
  const { data } = await page.send('Page.captureScreenshot', { format: 'webp', quality: 86 });
  const file = path.join(OUT_DIR, `${name}-${theme}.webp`);
  await writeFile(file, Buffer.from(data, 'base64'));
  console.info(`saved ${path.relative(process.cwd(), file)}`);
}

async function publishDemoNotes(accessCode) {
  const links = {};
  for (const note of DEMO_NOTES) {
    const { path: notePath } = await publishNote({ baseUrl: BASE_URL, accessCode, ...note.options });
    links[note.name] = `${BASE_URL}${notePath}`;
  }
  return links;
}

async function main() {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'arca-screens-'));
  const profileDir = await mkdtemp(path.join(tmpdir(), 'arca-chrome-'));
  const token = randomBytes(32).toString('base64url');
  const server = startProcess(process.execPath, ['server/index.js'], {
    env: { ARCA_USERS: `demo:${token}`, ARCA_PORT: String(PORT), ARCA_HOST: '127.0.0.1', ARCA_DATA_DIR: dataDir },
  });
  const chrome = startProcess(CHROME, [
    '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profileDir}`,
    '--hide-scrollbars', '--no-first-run', '--lang=ru-RU', 'about:blank',
  ], { isQuiet: true }); // Chrome floods stderr with harmless GPU warnings.
  try {
    await waitForUrl(`${BASE_URL}/login`);
    const accessCode = await createAccessCode(token);
    const links = await publishDemoNotes(accessCode);
    await mkdir(OUT_DIR, { recursive: true });

    const page = await connectToPage();
    const login = `localStorage.setItem('arca:access-code', ${JSON.stringify(accessCode)});
      localStorage.setItem('arca:draft', ${JSON.stringify(JSON.stringify(DEMO_DRAFT))});`;
    await page.send('Page.navigate', { url: `${BASE_URL}/login` });
    await wait(500);
    await page.send('Runtime.evaluate', { expression: login });

    for (const theme of THEMES) {
      await capture(page, { url: `${BASE_URL}/`, name: 'editor', theme });
      // Narrower viewports for the showcase: they are shown smaller on the site, so text stays readable.
      await capture(page, { url: links.article, name: 'note', theme, width: 1100, height: 800 });
      await capture(page, { url: links.script, name: 'code', theme, width: 1100, height: 640 });
      await capture(page, { url: links.secret, name: 'burn', theme, width: 1100, height: 420 });
    }
    page.close();
  } finally {
    chrome.kill();
    server.kill();
    await wait(300);
    await rm(dataDir, { recursive: true, force: true });
    await rm(profileDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('Screenshots failed:', error);
  process.exit(1);
});
