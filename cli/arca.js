#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import {
  checkAccess, deleteNote, fetchFile, fetchNote, listNotes, parseNoteUrl, publishNote,
} from '../shared/client.js';
import { isKnownLanguage, languageFromFileName, LANGUAGES } from '../shared/languages.js';
import { DEFAULT_EXPIRY, EXPIRY_SECONDS, ID_PATTERN } from '../shared/note.js';

const USAGE = `Usage:
  arca login                  save server URL and access code (once)
  arca                        write a note in $EDITOR, publish it on save & quit
  arca [file]                 publish a file (or stdin) as an encrypted note, print its URL
  arca get <url> [-o dir]     decrypt a note to stdout, save attachments to dir
  arca ls                     list your live notes: url, expiry, title (tab-separated)
  arca rm <url|id>            delete one of your notes

Options:
  -a, --attach <file>         attach a file (repeatable)
  -e, --expires <ttl>         ${Object.keys(EXPIRY_SECONDS).join(' | ')} (default: ${DEFAULT_EXPIRY})
  -b, --burn                  burn after reading: the link opens only once
  -t, --text                  plain text instead of markdown
  -l, --lang <id>             code with syntax highlighting: auto | ${LANGUAGES.map((l) => l.id).join(' | ')}
                              (files: detected by extension, e.g. .py .sh .html .json .diff)
  -o, --out <dir>             where "get" saves attachments

Environment (override the config saved by "arca login"):
  ARCA_URL                    e.g. https://arca.example.com
  ARCA_CODE                   your access code ("<token>.<key>")
  EDITOR                      editor for interactive mode (default: vi; Zed: "zed --wait")

The interactive draft lives in ~/.local/state/arca/draft.md until it is published,
so closing the terminal mid-edit loses nothing: run "arca" again to continue.
`;

const MIME_TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
  '.txt': 'text/plain', '.md': 'text/markdown', '.json': 'application/json', '.csv': 'text/csv',
};
const MARKDOWN_FILE = /\.(md|markdown)$/i;

const CONFIG_DIR = path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config'), 'arca');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const STATE_DIR = path.join(process.env.XDG_STATE_HOME || path.join(homedir(), '.local', 'state'), 'arca');
const DRAFT_PATH = path.join(STATE_DIR, 'draft.md');
const DEFAULT_URL = 'http://127.0.0.1:3000';
const KEY_ENTER = ['\r', '\n'];
const KEY_CTRL_C = '\u0003';
const KEY_BACKSPACE = '\u007f';

async function readConfigFile() {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`Cannot read ${CONFIG_PATH}: ${error.message}`);
  }
}

async function loadSettings() {
  const config = await readConfigFile();
  const url = process.env.ARCA_URL || config.url;
  const accessCode = process.env.ARCA_CODE || config.accessCode;
  if (!url || !accessCode) throw new Error('not configured, run: arca login');
  return { baseUrl: url.replace(/\/+$/, ''), accessCode };
}

/** Reads a line without echoing it, so the token never shows up on screen. */
function askHidden(prompt) {
  const { stdin, stderr } = process;
  if (!stdin.isTTY) throw new Error('arca login needs an interactive terminal');
  stderr.write(prompt);
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (callback) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stderr.write('\n');
      callback();
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (KEY_ENTER.includes(char)) return finish(() => resolve(value.trim()));
        if (char === KEY_CTRL_C) return finish(() => reject(new Error('cancelled')));
        value = char === KEY_BACKSPACE ? value.slice(0, -1) : value + char;
      }
    };
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
    stdin.resume();
  });
}

async function askUrl(currentUrl) {
  const defaultUrl = currentUrl || DEFAULT_URL;
  const prompt = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await prompt.question(`Server URL [${defaultUrl}]: `);
    return (answer.trim() || defaultUrl).replace(/\/+$/, '');
  } finally {
    prompt.close();
  }
}

async function loginCommand() {
  const config = await readConfigFile();
  const url = await askUrl(config.url);
  const accessCode = await askHidden('Access code (input hidden): ');
  if (!accessCode) throw new Error('access code is empty');
  const user = await checkAccess({ baseUrl: url, accessCode });
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(CONFIG_PATH, `${JSON.stringify({ url, accessCode }, null, 2)}\n`, { mode: 0o600 });
  await chmod(CONFIG_PATH, 0o600);
  process.stderr.write(`Logged in as "${user}". Saved to ${CONFIG_PATH}\n`);
}

/**
 * A fixed draft path survives a closed terminal: the next run reopens it, and the editor's
 * own swap-file recovery finds unsaved text. The draft is removed only after publishing.
 */
async function writeInEditor() {
  const editor = process.env.VISUAL || process.env.EDITOR || 'vi';
  await mkdir(STATE_DIR, { recursive: true, mode: 0o700 });
  await writeFile(DRAFT_PATH, '', { flag: 'a', mode: 0o600 }); // creates it, keeps an existing draft
  await chmod(DRAFT_PATH, 0o600);
  // shell: true so EDITOR may carry arguments, e.g. "zed --wait".
  const result = spawnSync(`${editor} "${DRAFT_PATH}"`, { stdio: 'inherit', shell: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Editor "${editor}" exited with code ${result.status}, draft kept`);
  return readFile(DRAFT_PATH, 'utf8');
}

const clearDraft = () => rm(DRAFT_PATH, { force: true });

/** Returns the note text and whether it came from the persistent draft. */
async function readInput(filePath) {
  if (filePath) return { text: await readFile(filePath, 'utf8'), isDraft: false };
  if (process.stdin.isTTY) return { text: await writeInEditor(), isDraft: true };
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return { text: Buffer.concat(chunks).toString('utf8'), isDraft: false };
}

async function readAttachment(filePath) {
  return {
    name: path.basename(filePath),
    type: MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    data: new Uint8Array(await readFile(filePath)),
  };
}

/** -t wins, then -l, then the file extension; stdin defaults to Markdown. */
function resolveFormat(filePath, options) {
  if (options.text) return { format: 'text' };
  if (options.lang) {
    if (!isKnownLanguage(options.lang)) throw new Error(`Unknown --lang "${options.lang}", see arca -h`);
    return { format: 'code', language: options.lang };
  }
  if (!filePath || MARKDOWN_FILE.test(filePath)) return { format: 'md' };
  const language = languageFromFileName(filePath);
  return language ? { format: 'code', language } : { format: 'text' };
}

async function publishCommand(filePath, options) {
  const { baseUrl, accessCode } = await loadSettings();
  if (!Object.hasOwn(EXPIRY_SECONDS, options.expires)) {
    throw new Error(`Unknown --expires value "${options.expires}"`);
  }
  const { format, language } = resolveFormat(filePath, options);
  const { text, isDraft } = await readInput(filePath);
  if (!text.trim() && options.attach.length === 0) {
    if (isDraft) await clearDraft();
    process.stderr.write('arca: note is empty, nothing published\n');
    return;
  }
  const { path: notePath } = await publishNote({
    baseUrl,
    accessCode,
    text,
    format,
    language,
    files: await Promise.all(options.attach.map(readAttachment)),
    expiresIn: EXPIRY_SECONDS[options.expires],
    burnAfterRead: options.burn,
  });
  if (isDraft) await clearDraft();
  process.stdout.write(`${baseUrl}${notePath}\n`);
}

// Attachment names come from the note author: strip any path parts.
const toSafeFileName = (name, fallback) => path.basename(name).replace(/^\.+/, '') || fallback;

async function getCommand(url, outDir) {
  if (!url) throw new Error('Usage: arca get <url> [-o dir]');
  const { baseUrl, id, encodedKey } = parseNoteUrl(url);
  const { note, key, burnAfterRead } = await fetchNote({ baseUrl, id, encodedKey });
  if (burnAfterRead) process.stderr.write('arca: burn-after-read note, it is now deleted from the server\n');
  process.stdout.write(note.text);
  if (!note.files.length) return;
  if (!outDir) {
    process.stderr.write(`\n${note.files.length} attachment(s), use -o <dir> to save them\n`);
    return;
  }
  await mkdir(outDir, { recursive: true });
  for (const file of note.files) {
    const target = path.join(outDir, toSafeFileName(file.name, file.id));
    await writeFile(target, await fetchFile({ baseUrl, id: file.id, key }), { flag: 'wx' });
    process.stderr.write(`saved ${target}\n`);
  }
}

function formatExpiry({ expiresAt, isBurnAfterRead, isBurned }) {
  if (isBurned) return 'read';
  if (isBurnAfterRead) return 'once';
  return expiresAt ? new Date(expiresAt).toISOString().slice(0, 10) : 'never';
}

async function listCommand() {
  const { baseUrl, accessCode } = await loadSettings();
  const { items, unreadableCount } = await listNotes({ baseUrl, accessCode });
  for (const item of items) {
    process.stdout.write(`${baseUrl}/n/${item.id}#${item.key}\t${formatExpiry(item)}\t${item.title}\n`);
  }
  if (unreadableCount) process.stderr.write(`arca: ${unreadableCount} note(s) made with another access code\n`);
}

async function removeCommand(target) {
  if (!target) throw new Error('Usage: arca rm <url|id>');
  const id = ID_PATTERN.test(target) ? target : parseNoteUrl(target).id;
  const { baseUrl, accessCode } = await loadSettings();
  await deleteNote({ baseUrl, accessCode, id });
  process.stderr.write(`arca: deleted ${id}\n`);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      attach: { type: 'string', short: 'a', multiple: true, default: [] },
      expires: { type: 'string', short: 'e', default: DEFAULT_EXPIRY },
      burn: { type: 'boolean', short: 'b', default: false },
      text: { type: 'boolean', short: 't', default: false },
      lang: { type: 'string', short: 'l' },
      out: { type: 'string', short: 'o' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) return process.stdout.write(USAGE);
  if (positionals[0] === 'login') return loginCommand();
  if (positionals[0] === 'get') return getCommand(positionals[1], values.out);
  if (positionals[0] === 'ls') return listCommand();
  if (positionals[0] === 'rm') return removeCommand(positionals[1]);
  return publishCommand(positionals[0], values);
}

main().catch((error) => {
  process.stderr.write(`arca: ${error.message}\n`);
  process.exit(1);
});
