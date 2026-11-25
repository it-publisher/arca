import path from 'node:path';
import { LIMITS } from '../shared/note.js';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const MIN_TOKEN_LENGTH = 24;

function parsePort(raw) {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid ARCA_PORT: ${raw}`);
  return port;
}

/** ARCA_USERS="name:token,name2:token2" → Map(name → token) */
function parseUsers(raw) {
  if (!raw) throw new Error('ARCA_USERS is required, format: "name:token,name2:token2" (token: npm run token)');
  const users = new Map();
  raw.split(',').forEach((entry, index) => {
    const [name, token] = entry.trim().split(':');
    // Error messages mention the index, never the entry itself: it contains a secret.
    if (!name || !token) throw new Error(`ARCA_USERS entry #${index + 1} must look like name:token`);
    if (token.length < MIN_TOKEN_LENGTH) {
      throw new Error(
        `ARCA_USERS entry #${index + 1} ("${name}"): token must be at least ${MIN_TOKEN_LENGTH} chars. `
        + 'Generate one with: npm run token',
      );
    }
    users.set(name, token);
  });
  return users;
}

export function loadConfig(env = process.env) {
  return {
    host: env.ARCA_HOST ?? '127.0.0.1',
    port: parsePort(env.ARCA_PORT ?? '3000'),
    dataDir: path.resolve(ROOT_DIR, env.ARCA_DATA_DIR ?? 'data'),
    distDir: path.join(ROOT_DIR, 'dist'),
    users: parseUsers(env.ARCA_USERS),
    limits: LIMITS,
  };
}
