import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const NOTE_PAGE = /^\/n\/[\w-]{11}$/;

function resolvePage(pathname) {
  if (pathname === '/') return 'index.html';
  if (pathname === '/login') return 'login.html';
  if (NOTE_PAGE.test(pathname)) return 'note.html';
  return pathname.slice(1);
}

async function statFile(filePath) {
  try {
    const stats = await stat(filePath);
    return stats.isFile() ? stats : null;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
}

export function createStaticHandler(distDir) {
  const root = path.resolve(distDir);

  return async function serveStatic(pathname, res) {
    const filePath = path.resolve(root, resolvePage(pathname));
    if (!filePath.startsWith(root + path.sep)) return false;
    const stats = await statFile(filePath);
    if (!stats) return false;

    // Vite puts content-hashed bundles in /assets, so they can be cached forever.
    const isHashedAsset = pathname.startsWith('/assets/');
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    await pipeline(createReadStream(filePath), res);
    return true;
  };
}
