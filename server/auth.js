import { createHash, timingSafeEqual } from 'node:crypto';

// Hashing gives equal-length buffers, which timingSafeEqual requires.
const digest = (value) => createHash('sha256').update(value).digest();

export function createAuthenticator(users) {
  const entries = [...users].map(([name, token]) => ({ name, hash: digest(token) }));

  return function authenticate(req) {
    const match = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '');
    if (!match) return null;
    const hash = digest(match[1]);
    return entries.find((entry) => timingSafeEqual(entry.hash, hash))?.name ?? null;
  };
}
